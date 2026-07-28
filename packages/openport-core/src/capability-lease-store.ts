import type { AgentCapabilityLease } from './types.js'

export type CapabilityLeaseConsumptionFailure =
  | 'not_found'
  | 'revoked'
  | 'expired'
  | 'call_budget'
  | 'cost_budget'
  | 'idempotency_mismatch'

export type CapabilityLeaseConsumptionEvidence = {
  requestId?: string | null
  idempotencyKey?: string | null
  proposalFingerprint: string
  proposalToolHash: string
  resourceCount: number
  fieldCount: number
  draftId?: string | null
  executionId?: string | null
}

export type CapabilityLeaseConsumptionInput = {
  costUnits: number
  now?: Date
  evidence?: CapabilityLeaseConsumptionEvidence
}

export type CapabilityLeaseConsumptionResult =
  | {
      ok: true
      lease: AgentCapabilityLease
      replayed: boolean
      auditObligationId?: string
    }
  | {
      ok: false
      reason: CapabilityLeaseConsumptionFailure
      lease: AgentCapabilityLease | null
    }

export interface CapabilityLeaseStateStore {
  saveCapabilityLease(
    input: Omit<AgentCapabilityLease, 'id' | 'created_at' | 'version'> & { id?: string }
  ): AgentCapabilityLease
  getCapabilityLease(leaseId: string): AgentCapabilityLease | null
  revokeCapabilityLease(leaseId: string, revokedAt?: string): AgentCapabilityLease | null
  consumeCapabilityLease(
    leaseId: string,
    input: CapabilityLeaseConsumptionInput
  ): CapabilityLeaseConsumptionResult
}

export type PendingCapabilityLeaseAudit = {
  id: string
  appId: string
  keyId: string
  actorUserId: string
  leaseId: string
  requestDigest: string | null
  createdAt: string
  details: Record<string, unknown>
}

export interface DurableCapabilityLeaseStateStore extends CapabilityLeaseStateStore {
  listPendingCapabilityLeaseAudits(limit?: number): PendingCapabilityLeaseAudit[]
  markCapabilityLeaseAuditDelivered(eventId: string, deliveredAt?: string): boolean
}

export function isDurableCapabilityLeaseStateStore(
  store: CapabilityLeaseStateStore
): store is DurableCapabilityLeaseStateStore {
  const candidate = store as Partial<DurableCapabilityLeaseStateStore>
  return typeof candidate.listPendingCapabilityLeaseAudits === 'function'
    && typeof candidate.markCapabilityLeaseAuditDelivered === 'function'
}
