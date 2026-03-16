import { Logger } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import { AuthService } from '../auth/auth.service.js'
import { NotesService } from './notes.service.js'
import { NotesRealtimeService } from './notes-realtime.service.js'

type SocketActor = {
  userId: string
  workspaceId: string
  name: string
  email: string
}

type JoinDocumentPayload = {
  document_id?: string
  note_id?: string
  state?: 'viewing' | 'editing'
}

type UpdateDocumentPayload = {
  document_id: string
  note_id?: string
  update: number[]
  snapshot?: {
    contentMd: string
    contentHtml: string | null
    excerpt?: string
  }
}

type AwarenessPayload = {
  document_id: string
  note_id?: string
  state?: 'viewing' | 'editing'
  update?: number[]
}

@WebSocketGateway({
  namespace: '/notes',
  cors: {
    origin: true,
    credentials: true
  }
})
export class NotesCollaborationGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(NotesCollaborationGateway.name)

  constructor(
    private readonly auth: AuthService,
    private readonly notes: NotesService,
    private readonly realtime: NotesRealtimeService
  ) {}

  @SubscribeMessage('ydoc:document:join')
  handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: JoinDocumentPayload
  ): void {
    try {
      const actor = this.resolveActor(socket)
      const noteId = this.resolveNoteId(payload)
      const note = this.notes.getNoteForRealtime(actor, noteId)
      const documentId = payload.document_id || this.realtime.toDocumentId(note.id)
      const registry = this.realtime.getOrCreateDocument(note.id)

      socket.data.noteDocumentId = documentId
      socket.join(this.realtime.toRoom(documentId))
      const sessions = this.realtime.addUser(documentId, socket.id, actor, payload.state || 'viewing')
      socket.emit('ydoc:document:state', {
        document_id: documentId,
        state: this.realtime.encodeState(documentId),
        sessions
      })
      this.server.to(this.realtime.toRoom(documentId)).emit('note:presence', {
        noteId,
        activeUsers: sessions
      })

      this.logger.debug(`Socket ${socket.id} joined ${registry.documentId} as ${actor.userId}`)
    } catch (error) {
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Failed to join note collaboration'
      })
    }
  }

  @SubscribeMessage('ydoc:document:state')
  handleState(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: JoinDocumentPayload
  ): void {
    try {
      const actor = this.resolveActor(socket)
      const noteId = this.resolveNoteId(payload)
      const note = this.notes.getNoteForRealtime(actor, noteId)
      const documentId = payload.document_id || this.realtime.toDocumentId(noteId)
      this.realtime.getOrCreateDocument(note.id)
      socket.emit('ydoc:document:state', {
        document_id: documentId,
        state: this.realtime.encodeState(documentId),
        sessions: this.realtime.listUsers(documentId)
      })
    } catch (error) {
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Failed to load note state'
      })
    }
  }

  @SubscribeMessage('ydoc:document:update')
  handleUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: UpdateDocumentPayload
  ): void {
    try {
      const actor = this.resolveActor(socket)
      const noteId = this.resolveNoteId(payload)
      if (!this.notes.canWriteNote(actor, noteId)) {
        socket.emit('error', { message: 'Write access required' })
        return
      }

      const documentId = payload.document_id || this.realtime.toDocumentId(noteId)
      this.realtime.applyUpdate(documentId, payload.update)
      this.realtime.updateUserState(documentId, socket.id, 'editing')
      socket.to(this.realtime.toRoom(documentId)).emit('ydoc:document:update', {
        document_id: documentId,
        note_id: noteId,
        update: payload.update,
        socket_id: socket.id
      })
      this.server.to(this.realtime.toRoom(documentId)).emit('note:presence', {
        noteId,
        activeUsers: this.realtime.listUsers(documentId)
      })

      if (payload.snapshot) {
        this.realtime.scheduleSave(documentId, payload.snapshot, (snapshot) => {
          this.notes.applyCollaborativeContent(actor, noteId, snapshot)
        })
      }
    } catch (error) {
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Failed to sync note update'
      })
    }
  }

  @SubscribeMessage('ydoc:awareness:update')
  handleAwareness(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: AwarenessPayload
  ): void {
    try {
      const noteId = this.resolveNoteId(payload)
      const documentId = payload.document_id || this.realtime.toDocumentId(noteId)
      const sessions = this.realtime.updateUserState(documentId, socket.id, payload.state || 'viewing')
      if (Array.isArray(payload.update)) {
        socket.to(this.realtime.toRoom(documentId)).emit('ydoc:awareness:update', {
          document_id: documentId,
          note_id: noteId,
          update: payload.update
        })
      }
      this.server.to(this.realtime.toRoom(documentId)).emit('note:presence', {
        noteId,
        activeUsers: sessions
      })
    } catch {}
  }

  @SubscribeMessage('ydoc:document:leave')
  handleLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: JoinDocumentPayload
  ): void {
    this.leaveDocument(socket, payload)
  }

  handleDisconnect(socket: Socket): void {
    const documentId = this.getCurrentDocumentId(socket)
    if (!documentId) return
    this.leaveDocument(socket, { document_id: documentId })
  }

  private leaveDocument(socket: Socket, payload: JoinDocumentPayload): void {
    const documentId = payload.document_id || this.getCurrentDocumentId(socket)
    if (!documentId) return

    const noteId = documentId.startsWith('note:') ? documentId.slice(5) : payload.note_id
    socket.leave(this.realtime.toRoom(documentId))
    socket.data.noteDocumentId = undefined
    const sessions = this.realtime.removeUser(documentId, socket.id)
    this.realtime.cleanup(documentId)
    if (noteId) {
      this.server.to(this.realtime.toRoom(documentId)).emit('note:presence', {
        noteId,
        activeUsers: sessions
      })
    }
  }

  private resolveActor(socket: Socket): SocketActor {
    const authPayload = socket.handshake.auth ?? {}
    const accessToken = typeof authPayload.accessToken === 'string' ? authPayload.accessToken.trim() : ''
    const tokenUser = this.auth.resolveUserByAccessToken(accessToken)
    const fallbackUserId = typeof authPayload.userId === 'string' ? authPayload.userId.trim() : ''
    const fallbackWorkspaceId = typeof authPayload.workspaceId === 'string' ? authPayload.workspaceId.trim() : ''

    const resolvedUser = tokenUser || this.auth.getOrCreateUser(fallbackUserId || 'user_demo')

    return {
      userId: resolvedUser.id,
      workspaceId: fallbackWorkspaceId || resolvedUser.defaultWorkspaceId,
      name: resolvedUser.name,
      email: resolvedUser.email
    }
  }

  private resolveNoteId(payload: JoinDocumentPayload | UpdateDocumentPayload | AwarenessPayload): string {
    if (payload.note_id?.trim()) return payload.note_id.trim()
    if (payload.document_id?.startsWith('note:')) return payload.document_id.slice(5)
    throw new Error('note_id is required')
  }

  private getCurrentDocumentId(socket: Socket): string | null {
    const value = socket.data.noteDocumentId
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
}
