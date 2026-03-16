'use client'

import type { OpenPortProjectCollaborationState, OpenPortProjectEvent } from '@openport/product-contracts'
import { io, type Socket } from 'socket.io-client'
import type { OpenPortSession } from './openport-api'
import { getPublicSocketBaseUrl } from './runtime-env'

type RealtimeCallbacks = {
  onPresence: (state: OpenPortProjectCollaborationState) => void
  onEvent: (event: OpenPortProjectEvent) => void
}

export class OpenPortProjectRealtime {
  private socket: Socket | null = null

  constructor(
    private readonly projectId: string,
    private readonly session: OpenPortSession,
    private readonly callbacks: RealtimeCallbacks
  ) {}

  connect(): void {
    this.socket = io(`${getPublicSocketBaseUrl()}/projects`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: {
        accessToken: this.session.accessToken,
        userId: this.session.userId,
        workspaceId: this.session.workspaceId
      }
    })

    this.socket.on('connect', () => {
      this.socket?.emit('project:join', {
        project_id: this.projectId,
        state: 'viewing'
      })
    })

    this.socket.on('project:presence', (payload: OpenPortProjectCollaborationState) => {
      if (payload.projectId !== this.projectId) return
      this.callbacks.onPresence(payload)
    })

    this.socket.on('project:event', (payload: OpenPortProjectEvent) => {
      if (payload.projectId !== this.projectId) return
      this.callbacks.onEvent(payload)
    })

    this.socket.connect()
  }

  setState(state: 'viewing' | 'editing'): void {
    this.socket?.emit('project:presence', {
      project_id: this.projectId,
      state
    })
  }

  disconnect(): void {
    this.socket?.emit('project:leave', {
      project_id: this.projectId
    })
    this.socket?.disconnect()
    this.socket = null
  }
}
