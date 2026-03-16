import type { AgentAuditLog } from './types.js'
import { nowIso, randomId } from './utils.js'

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
    this.events.push(event)
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
      created_at: nowIso()
    }

    await this.sink.log(event)
    return event
  }

  list(): AgentAuditLog[] {
    return this.sink.list()
  }
}
