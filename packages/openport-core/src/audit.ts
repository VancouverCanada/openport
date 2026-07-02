import type { AgentAuditLog } from './types.js'
import { nowIso, randomId, sha256JcsHex } from './utils.js'

export type AuditInput = {
  appId?: string | null
  keyId?: string | null
  actorUserId?: string | null
  performedByUserId?: string | null
  action: string
  status: 'success' | 'failed' | 'denied'
  code?: string | null
  requestId?: string | null
  draftId?: string | null
  executionId?: string | null
  ip?: string | null
  userAgent?: string | null
  details?: Record<string, unknown> | null
}

export interface AuditSink {
  log: (event: AgentAuditLog) => Promise<void>
  list: () => AgentAuditLog[]
}

export class InMemoryAuditSink implements AuditSink {
  private readonly events: AgentAuditLog[] = []

  async log(event: AgentAuditLog): Promise<void> {
    const previous = this.events[this.events.length - 1] || null
    const prevEventHash = previous?.event_hash || null
    const next: AgentAuditLog = {
      ...event,
      prev_event_hash: prevEventHash,
      event_hash: sha256JcsHex({
        prev_event_hash: prevEventHash,
        id: event.id,
        app_id: event.app_id,
        key_id: event.key_id,
        actor_user_id: event.actor_user_id,
        performed_by_user_id: event.performed_by_user_id,
        action: event.action,
        status: event.status,
        code: event.code,
        request_id: event.request_id,
        draft_id: event.draft_id,
        execution_id: event.execution_id,
        ip: event.ip,
        user_agent: event.user_agent,
        details: event.details,
        created_at: event.created_at
      })
    }
    this.events.push(next)
  }

  list(): AgentAuditLog[] {
    return [...this.events].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
}

export class AuditService {
  constructor(private readonly sink: AuditSink) {}

  async log(input: AuditInput): Promise<AgentAuditLog> {
    const event: AgentAuditLog = {
      id: randomId('aud'),
      app_id: input.appId || null,
      key_id: input.keyId || null,
      actor_user_id: input.actorUserId || null,
      performed_by_user_id: input.performedByUserId || null,
      action: input.action,
      status: input.status,
      code: input.code || null,
      request_id: input.requestId || null,
      draft_id: input.draftId || null,
      execution_id: input.executionId || null,
      ip: input.ip || null,
      user_agent: input.userAgent || null,
      details: input.details || null,
      created_at: nowIso(),
      prev_event_hash: null,
      event_hash: ''
    }

    await this.sink.log(event)
    return event
  }

  list(): AgentAuditLog[] {
    return this.sink.list()
  }
}
