import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets'
import type { Subscription } from 'rxjs'
import type { Server, Socket } from 'socket.io'
import { AuthService } from '../auth/auth.service.js'
import { ProjectEventsService } from './project-events.service.js'
import { ProjectsService, type Actor } from './projects.service.js'

type JoinProjectPayload = {
  project_id?: string
  state?: 'viewing' | 'editing'
}

@WebSocketGateway({
  namespace: '/projects',
  cors: {
    origin: true,
    credentials: true
  }
})
export class ProjectsCollaborationGateway implements OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(ProjectsCollaborationGateway.name)
  private subscription: Subscription | null = null

  constructor(
    private readonly auth: AuthService,
    private readonly projects: ProjectsService,
    private readonly events: ProjectEventsService
  ) {}

  onModuleInit(): void {
    this.subscription = this.events.observe().subscribe((event) => {
      if (event.projectId) {
        this.server.to(this.toProjectRoom(event.projectId)).emit('project:event', event)
      }
      this.server.to(this.toWorkspaceRoom(event.workspaceId)).emit('workspace:event', event)
    })
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe()
  }

  @SubscribeMessage('project:join')
  async handleJoin(@ConnectedSocket() socket: Socket, @MessageBody() payload: JoinProjectPayload): Promise<void> {
    try {
      const actor = this.resolveActor(socket)
      const projectId = this.resolveProjectId(payload)
      await this.projects.get(actor, projectId)
      socket.join(this.toWorkspaceRoom(actor.workspaceId))
      socket.join(this.toProjectRoom(projectId))
      socket.data.projectId = projectId

      const collaboration = this.projects.heartbeatCollaboration(
        this.projects.getCollaborationActor(actor),
        projectId,
        payload.state || 'viewing'
      )

      socket.emit('project:presence', collaboration)
      this.server.to(this.toProjectRoom(projectId)).emit('project:presence', collaboration)
      this.logger.debug(`Socket ${socket.id} joined project ${projectId}`)
    } catch (error) {
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Failed to join project collaboration'
      })
    }
  }

  @SubscribeMessage('project:presence')
  async handlePresence(@ConnectedSocket() socket: Socket, @MessageBody() payload: JoinProjectPayload): Promise<void> {
    try {
      const actor = this.resolveActor(socket)
      const projectId = this.resolveProjectId(payload)
      const collaboration = this.projects.heartbeatCollaboration(
        this.projects.getCollaborationActor(actor),
        projectId,
        payload.state || 'viewing'
      )
      this.server.to(this.toProjectRoom(projectId)).emit('project:presence', collaboration)
    } catch {}
  }

  @SubscribeMessage('project:leave')
  handleLeave(@ConnectedSocket() socket: Socket): void {
    this.leave(socket)
  }

  handleDisconnect(socket: Socket): void {
    this.leave(socket)
  }

  private leave(socket: Socket): void {
    const projectId = typeof socket.data.projectId === 'string' ? socket.data.projectId : null
    if (!projectId) return
    socket.leave(this.toProjectRoom(projectId))
    socket.data.projectId = undefined
  }

  private resolveActor(socket: Socket): Actor {
    const authPayload = socket.handshake.auth ?? {}
    const accessToken = typeof authPayload.accessToken === 'string' ? authPayload.accessToken.trim() : ''
    const tokenUser = this.auth.resolveUserByAccessToken(accessToken)
    const fallbackUserId = typeof authPayload.userId === 'string' ? authPayload.userId.trim() : ''
    const fallbackWorkspaceId = typeof authPayload.workspaceId === 'string' ? authPayload.workspaceId.trim() : ''
    const resolvedUser = tokenUser || this.auth.getOrCreateUser(fallbackUserId || 'user_demo')

    return {
      userId: resolvedUser.id,
      workspaceId: fallbackWorkspaceId || resolvedUser.defaultWorkspaceId
    }
  }

  private resolveProjectId(payload: JoinProjectPayload): string {
    if (payload.project_id?.trim()) return payload.project_id.trim()
    throw new Error('project_id is required')
  }

  private toProjectRoom(projectId: string): string {
    return `project_${projectId}`
  }

  private toWorkspaceRoom(workspaceId: string): string {
    return `workspace_${workspaceId}`
  }
}
