'use client'

import { Editor, Extension } from '@tiptap/core'
import type { OpenPortNoteCollaborationState, OpenPortNotePresence } from '@openport/product-contracts'
import { keymap } from 'prosemirror-keymap'
import { io, type Socket } from 'socket.io-client'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { yCursorPlugin, ySyncPlugin, yUndoPlugin, undo, redo } from 'y-prosemirror'
import * as Y from 'yjs'
import type { OpenPortSession } from './openport-api'
import { getPublicSocketBaseUrl } from './runtime-env'

type Snapshot = {
  contentMd: string
  contentHtml: string | null
  excerpt: string
}

type RealtimeCallbacks = {
  onPresence: (state: OpenPortNoteCollaborationState) => void
  onConnection: (state: 'connecting' | 'online' | 'offline') => void
}

function randomColor(): string {
  const palette = ['#0f172a', '#2563eb', '#9333ea', '#059669', '#dc2626', '#d97706']
  return palette[Math.floor(Math.random() * palette.length)] || '#0f172a'
}

export class OpenPortNoteRealtime {
  readonly doc = new Y.Doc()
  readonly awareness = new Awareness(this.doc)

  private socket: Socket | null = null
  private editor: Editor | null = null
  private snapshotGetter: (() => Snapshot) | null = null
  private destroyed = false
  private mode: OpenPortNotePresence['state'] = 'editing'
  private readonly documentId: string
  private readonly userColor = randomColor()

  constructor(
    private readonly noteId: string,
    private readonly session: OpenPortSession,
    private readonly initialHtml: string,
    private readonly callbacks: RealtimeCallbacks
  ) {
    this.documentId = `note:${noteId}`
  }

  getExtension(): Extension {
    return Extension.create({
      name: 'openportYjsCollaboration',
      addProseMirrorPlugins: () => {
        const fragment = this.doc.getXmlFragment('prosemirror')
        return [
          ySyncPlugin(fragment),
          yUndoPlugin(),
          keymap({
            'Mod-z': undo,
            'Mod-y': redo,
            'Mod-Shift-z': redo
          }),
          yCursorPlugin(this.awareness)
        ]
      }
    })
  }

  async connect(): Promise<void> {
    this.callbacks.onConnection('connecting')
    const socketBaseUrl = await this.resolveSocketBaseUrl()
    if (this.destroyed) return

    this.socket = io(`${socketBaseUrl}/notes`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: {
        accessToken: this.session.accessToken,
        userId: this.session.userId,
        workspaceId: this.session.workspaceId,
        name: this.session.name,
        email: this.session.email
      }
    })

    this.bindSocket()
    this.socket.connect()
  }

  setEditor(editor: Editor, snapshotGetter: () => Snapshot): void {
    this.editor = editor
    this.snapshotGetter = snapshotGetter
  }

  setMode(state: OpenPortNotePresence['state']): void {
    this.mode = state
    this.updateLocalAwareness()
  }

  replaceContent(html: string): void {
    this.editor?.commands.setContent(html || '<p></p>', {
      emitUpdate: true
    })
  }

  destroy(): void {
    this.destroyed = true
    if (this.socket?.connected) {
      this.socket.emit('ydoc:document:leave', {
        document_id: this.documentId,
        note_id: this.noteId
      })
    }
    this.socket?.removeAllListeners()
    this.socket?.disconnect()
    this.awareness.destroy()
    this.doc.destroy()
  }

  private bindSocket(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      if (this.destroyed || !this.socket) return
      this.callbacks.onConnection('online')
      this.updateLocalAwareness()
      this.socket.emit('ydoc:document:join', {
        document_id: this.documentId,
        note_id: this.noteId,
        state: this.mode
      })
    })

    this.socket.on('disconnect', () => {
      if (this.destroyed) return
      this.callbacks.onConnection('offline')
    })

    this.socket.on('ydoc:document:state', (payload: { document_id: string; state: number[]; sessions?: OpenPortNotePresence[] }) => {
      if (payload.document_id !== this.documentId || !Array.isArray(payload.state)) return
      const state = Uint8Array.from(payload.state)
      if (state.length > 0) {
        Y.applyUpdate(this.doc, state, 'server')
      } else if (this.editor && !this.editor.getText().trim() && this.initialHtml) {
        this.editor.commands.setContent(this.initialHtml, { emitUpdate: true })
      }
      this.callbacks.onPresence({
        noteId: this.noteId,
        activeUsers: payload.sessions || []
      })
    })

    this.socket.on('ydoc:document:update', (payload: { document_id: string; update: number[]; socket_id?: string }) => {
      if (payload.document_id !== this.documentId || !Array.isArray(payload.update)) return
      Y.applyUpdate(this.doc, Uint8Array.from(payload.update), 'remote')
    })

    this.socket.on('ydoc:awareness:update', (payload: { document_id: string; update: number[] }) => {
      if (payload.document_id !== this.documentId || !Array.isArray(payload.update)) return
      applyAwarenessUpdate(this.awareness, Uint8Array.from(payload.update), 'remote')
    })

    this.socket.on('note:presence', (payload: OpenPortNoteCollaborationState) => {
      if (payload.noteId !== this.noteId) return
      this.callbacks.onPresence(payload)
    })

    this.doc.on('update', (update, origin) => {
      if (origin === 'remote' || origin === 'server' || !this.socket?.connected) return
      this.socket.emit('ydoc:document:update', {
        document_id: this.documentId,
        note_id: this.noteId,
        update: Array.from(update),
        snapshot: this.snapshotGetter?.() || {
          contentMd: '',
          contentHtml: null,
          excerpt: ''
        }
      })
    })

    this.awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown
      ) => {
      if (origin === 'remote' || !this.socket?.connected) return
      const update = encodeAwarenessUpdate(this.awareness, [...added, ...updated, ...removed])
      this.socket.emit('ydoc:awareness:update', {
        document_id: this.documentId,
        note_id: this.noteId,
        state: this.mode,
        update: Array.from(update)
      })
      }
    )
  }

  private updateLocalAwareness(): void {
    this.awareness.setLocalStateField('user', {
      id: this.session.userId,
      name: this.session.name,
      email: this.session.email,
      color: this.userColor,
      mode: this.mode
    })
  }

  private async resolveSocketBaseUrl(): Promise<string> {
    try {
      const response = await fetch('/api/openport/runtime', {
        method: 'GET',
        cache: 'no-store'
      })
      if (response.ok) {
        const payload = await response.json() as { socketBaseUrl?: string }
        if (payload.socketBaseUrl?.trim()) {
          return payload.socketBaseUrl.trim()
        }
      }
    } catch {}

    return getPublicSocketBaseUrl()
  }
}
