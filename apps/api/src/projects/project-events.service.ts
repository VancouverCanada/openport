import { Injectable } from '@nestjs/common'
import type {
  OpenPortProjectCollaborationState,
  OpenPortProjectEvent,
  OpenPortProjectPresence
} from '@openport/product-contracts'
import { randomUUID } from 'node:crypto'
import { Observable, Subject, filter, map } from 'rxjs'

type CollaborationActor = {
  userId: string
  workspaceId: string
  name: string
  email: string
}

const PROJECT_PRESENCE_TTL_MS = 45_000

@Injectable()
export class ProjectEventsService {
  private readonly events$ = new Subject<OpenPortProjectEvent>()
  private readonly presenceByProject = new Map<string, Map<string, OpenPortProjectPresence>>()
  private readonly workspaceByProject = new Map<string, string>()

  stream(workspaceId: string): Observable<{ data: OpenPortProjectEvent }> {
    return this.events$.pipe(
      filter((event) => event.workspaceId === workspaceId),
      map((event) => ({ data: event }))
    )
  }

  observe(workspaceId?: string): Observable<OpenPortProjectEvent> {
    return workspaceId
      ? this.events$.pipe(filter((event) => event.workspaceId === workspaceId))
      : this.events$.asObservable()
  }

  emit(
    workspaceId: string,
    type: OpenPortProjectEvent['type'],
    projectId: string | null,
    userId: string | null,
    payload: Record<string, unknown> | null = null
  ): void {
    if (projectId) {
      this.workspaceByProject.set(projectId, workspaceId)
    }

    this.events$.next({
      id: `project_event_${randomUUID()}`,
      workspaceId,
      type,
      projectId,
      userId,
      createdAt: new Date().toISOString(),
      payload
    })
  }

  heartbeat(
    actor: CollaborationActor,
    projectId: string,
    state: 'viewing' | 'editing'
  ): OpenPortProjectCollaborationState {
    this.workspaceByProject.set(projectId, actor.workspaceId)
    const registry = this.getOrCreateProjectPresence(projectId)
    registry.set(actor.userId, {
      userId: actor.userId,
      name: actor.name,
      email: actor.email,
      state,
      seenAt: new Date().toISOString()
    })
    const collaboration = this.getCollaborationState(actor.workspaceId, projectId)
    this.emit(actor.workspaceId, 'collaboration.updated', projectId, actor.userId, {
      activeUsers: collaboration.activeUsers.length
    })
    return collaboration
  }

  getCollaborationState(workspaceId: string, projectId: string): OpenPortProjectCollaborationState {
    this.workspaceByProject.set(projectId, workspaceId)
    this.cleanupProjectPresence(projectId)
    return {
      projectId,
      activeUsers: [...(this.presenceByProject.get(projectId)?.values() || [])].sort((left, right) =>
        left.name.localeCompare(right.name)
      )
    }
  }

  private getOrCreateProjectPresence(projectId: string): Map<string, OpenPortProjectPresence> {
    const existing = this.presenceByProject.get(projectId)
    if (existing) return existing
    const next = new Map<string, OpenPortProjectPresence>()
    this.presenceByProject.set(projectId, next)
    return next
  }

  private cleanupProjectPresence(projectId: string): void {
    const registry = this.presenceByProject.get(projectId)
    if (!registry) return

    const threshold = Date.now() - PROJECT_PRESENCE_TTL_MS
    ;[...registry.entries()].forEach(([userId, presence]) => {
      if (new Date(presence.seenAt).getTime() < threshold) {
        registry.delete(userId)
      }
    })

    if (registry.size === 0) {
      this.presenceByProject.delete(projectId)
      this.workspaceByProject.delete(projectId)
    }
  }
}
