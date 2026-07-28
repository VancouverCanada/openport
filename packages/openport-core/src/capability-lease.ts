import { AuditService } from './audit.js'
import { ContextRiskEngine } from './context-risk.js'
import { ErrorCodes, type ErrorCode } from './error-codes.js'
import { OpenPortError } from './errors.js'
import { IntentEngine } from './intent-engine.js'
import { InMemoryStore } from './store.js'
import { AgentToolRegistry } from './tool-registry.js'
import {
  isDurableCapabilityLeaseStateStore,
  type CapabilityLeaseStateStore
} from './capability-lease-store.js'
import type {
  AgentCapabilityLease,
  AgentManifestTool,
  AgentRequestContext,
  CapabilityLeaseEffectMode,
  ContextAuthorityMode,
  IntentCertificate,
  IntentReviewMode
} from './types.js'
import { sha256JcsHex } from './utils.js'

const MODE_RANK: Record<CapabilityLeaseEffectMode, number> = {
  read: 1,
  draft: 2,
  preflight: 3,
  execute: 4
}

const MAX_LEASE_TTL_SECONDS = 60 * 60
const DEFAULT_LEASE_TTL_SECONDS = 10 * 60
const MAX_LEASE_CALLS = 100
const MAX_LEASE_COST_UNITS = 1000
const MAX_LEASE_ROWS = 5000
const MAX_EFFECT_AMOUNT = 1_000_000_000

export type CreateCapabilityLeaseInput = {
  sessionId: string
  allowedTools: string[]
  allowedResourceIds?: string[]
  allowedFields?: string[]
  maxRows?: number
  maxEffectAmount?: number
  maxCostUnits?: number
  maxCalls?: number
  effectModeCeiling?: CapabilityLeaseEffectMode
  expiresInSeconds?: number
  parentLeaseId?: string
  intentCertificateId?: string
  contextRiskSnapshotId?: string
  routeDecisionId?: string
  requestId?: string
}

export type CapabilityLeaseProposal = {
  toolName: string
  resourceIds?: string[]
  fields?: string[]
  rows?: number
  effectAmount?: number
  mode: CapabilityLeaseEffectMode
  costUnits?: number
  consume?: boolean
  requestId?: string | null
  idempotencyKey?: string | null
  draftId?: string | null
  executionId?: string | null
  requestFingerprint?: string | null
}

export type CapabilityLeaseDecision = {
  lease: AgentCapabilityLease
  decision: 'allow'
  consumed: boolean
  replayed: boolean
}

function uniqueStrings(values: unknown, maxItems: number, maxLength = 200): string[] {
  if (!Array.isArray(values)) return []
  const result: string[] = []
  for (const value of values) {
    const normalized = String(value || '').trim()
    if (!normalized || normalized.length > maxLength || result.includes(normalized)) continue
    result.push(normalized)
    if (result.length >= maxItems) break
  }
  return result
}

function intersect(left: string[], right: string[]): string[] {
  const allowed = new Set(right)
  return left.filter((value) => allowed.has(value))
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function weakerMode(a: CapabilityLeaseEffectMode, b: CapabilityLeaseEffectMode): CapabilityLeaseEffectMode {
  return MODE_RANK[a] <= MODE_RANK[b] ? a : b
}

function modeFromContext(mode?: ContextAuthorityMode): CapabilityLeaseEffectMode {
  if (mode === 'hidden' || mode === 'read_only') return 'read'
  if (mode === 'draft_only') return 'draft'
  if (mode === 'preflight_required' || mode === 'confirm_required') return 'preflight'
  return 'execute'
}

function modeFromIntent(mode?: IntentReviewMode): CapabilityLeaseEffectMode {
  if (mode === 'draft') return 'draft'
  if (mode === 'preflight' || mode === 'confirm') return 'preflight'
  if (mode === 'deny' || mode === 'clarify') return 'read'
  return 'execute'
}

function intentResourceBounds(certificate: IntentCertificate | null): string[] {
  if (!certificate) return []
  const bounds = certificate.resource_bounds || {}
  return uniqueStrings(
    bounds.ledgerIds || bounds.ledger_ids || bounds.transactionIds || bounds.transaction_ids || bounds.resourceIds || bounds.resource_ids || bounds.ids,
    200
  )
}

function intentMaxAmount(certificate: IntentCertificate | null): number | null {
  if (!certificate) return null
  const bounds = certificate.effect_bounds || {}
  const value = Number(bounds.maxAmount || bounds.max_amount)
  return Number.isFinite(value) && value >= 0 ? value : null
}

export function publicCapabilityLease(lease: AgentCapabilityLease): Record<string, unknown> {
  return {
    id: lease.id,
    sessionId: lease.session_id,
    parentLeaseId: lease.parent_lease_id,
    policyVersion: lease.policy_version,
    allowedTools: lease.allowed_tool_names,
    allowedResourceIds: lease.allowed_resource_ids,
    allowedFields: lease.allowed_fields,
    limits: {
      maxRows: lease.max_rows,
      maxEffectAmount: lease.max_effect_amount,
      effectModeCeiling: lease.effect_mode_ceiling,
      totalCostUnits: lease.total_cost_units,
      remainingCostUnits: lease.remaining_cost_units,
      totalCalls: lease.total_calls,
      remainingCalls: lease.remaining_calls
    },
    version: lease.version,
    expiresAt: lease.expires_at,
    revokedAt: lease.revoked_at
  }
}

function policyVersion(ctx: AgentRequestContext): string {
  return `sha256:${sha256JcsHex({
    appId: ctx.app.id,
    status: ctx.app.status,
    scopes: [...ctx.app.scopes].sort(),
    policy: ctx.app.policy,
    autoExecute: ctx.app.auto_execute
  })}`
}

function fieldSetFromPayload(payload: Record<string, unknown>): string[] {
  const identifiers = new Set([
    'id', 'ledgerId', 'ledger_id', 'transactionId', 'transaction_id', 'resourceId', 'resource_id',
    'projectId', 'project_id', 'ticketId', 'ticket_id', 'inventoryId', 'inventory_id', 'sessionId', 'session_id'
  ])
  return Object.keys(payload).filter((key) => !identifiers.has(key))
}

function resourceSetFromPayload(payload: Record<string, unknown>): string[] {
  const keys = [
    'ledgerId', 'ledger_id', 'transactionId', 'transaction_id', 'resourceId', 'resource_id',
    'projectId', 'project_id', 'ticketId', 'ticket_id', 'inventoryId', 'inventory_id', 'id'
  ]
  const result: string[] = []
  for (const key of keys) {
    const value = payload[key]
    if (value === undefined || value === null) continue
    const normalized = String(value).trim()
    if (normalized && !result.includes(normalized)) result.push(normalized)
  }
  return result
}

export function capabilityProposalFromPayload(input: {
  toolName: string
  payload: Record<string, unknown>
  mode: CapabilityLeaseEffectMode
  consume?: boolean
  costUnits?: number
  requestId?: string | null
  idempotencyKey?: string | null
  draftId?: string | null
  executionId?: string | null
}): CapabilityLeaseProposal {
  const rows = Number(input.payload.limit || input.payload.pageSize || input.payload.maxRows || 1)
  const amount = Number(input.payload.amount_home || input.payload.amount || input.payload.quantity || 0)
  return {
    toolName: input.toolName,
    resourceIds: resourceSetFromPayload(input.payload),
    fields: fieldSetFromPayload(input.payload),
    rows: Number.isFinite(rows) ? Math.max(0, rows) : 1,
    effectAmount: Number.isFinite(amount) ? Math.abs(amount) : 0,
    mode: input.mode,
    costUnits: input.costUnits,
    consume: input.consume,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    draftId: input.draftId,
    executionId: input.executionId,
    requestFingerprint: `sha256:${sha256JcsHex({
      toolName: input.toolName,
      payload: input.payload,
      mode: input.mode,
      costUnits: input.costUnits ?? null
    })}`
  }
}

export function capabilityLeaseAuditDetails(lease: AgentCapabilityLease | null, extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (!lease) return extra
  return {
    ...extra,
    capabilityLeaseId: lease.id,
    capabilityLeaseVersion: lease.version,
    capabilityLeasePolicyVersion: lease.policy_version,
    capabilityLeaseRemainingCalls: lease.remaining_calls,
    capabilityLeaseRemainingCostUnits: lease.remaining_cost_units,
    capabilityLeaseExpiresAt: lease.expires_at,
    rawTaskStored: false,
    rawPolicyStored: false
  }
}

export class CapabilityLeaseEngine {
  private readonly leaseState: CapabilityLeaseStateStore

  constructor(
    private readonly store: InMemoryStore,
    private readonly tools: AgentToolRegistry,
    private readonly audit: AuditService,
    private readonly intent: IntentEngine,
    private readonly contextRisk: ContextRiskEngine,
    leaseState?: CapabilityLeaseStateStore
  ) {
    this.leaseState = leaseState || store
  }

  async createLease(ctx: AgentRequestContext, input: CreateCapabilityLeaseInput): Promise<Record<string, unknown>> {
    const sessionId = String(input.sessionId || '').trim()
    if (!sessionId || sessionId.length > 200) {
      throw new OpenPortError(400, ErrorCodes.COMMON_VALIDATION, 'sessionId is required')
    }

    const requestedTools = uniqueStrings(input.allowedTools, 100)
    if (requestedTools.length === 0) {
      throw new OpenPortError(400, ErrorCodes.AGENT_LEASE_EMPTY, 'At least one allowed tool is required')
    }

    const certificate = this.intent.getCertificateForContext(ctx, input.intentCertificateId)
    const staticTools = this.tools.listManifestTools(ctx)
    const intentTools = this.intent.filterManifest(certificate, staticTools)
    const contextResult = await this.contextRisk.filterManifest(ctx, intentTools, {
      contextRiskSnapshotId: input.contextRiskSnapshotId,
      sessionId
    })
    let eligibleTools = contextResult.tools

    let routeDecisionId: string | null = null
    if (input.routeDecisionId?.trim()) {
      const route = this.store.getRouteDecision(input.routeDecisionId.trim())
      if (!route || route.app_id !== ctx.app.id || route.key_id !== ctx.key.id || route.actor_user_id !== ctx.actorUserId) {
        throw new OpenPortError(404, ErrorCodes.AGENT_ROUTE_NOT_FOUND, 'Route decision not found')
      }
      const routeNames = new Set(route.safe_tool_names)
      eligibleTools = eligibleTools.filter((tool) => routeNames.has(tool.name))
      routeDecisionId = route.id
    }

    let parent: AgentCapabilityLease | null = null
    if (input.parentLeaseId?.trim()) {
      parent = this.getLeaseForContext(ctx, input.parentLeaseId.trim())
      if (parent.revoked_at || Date.parse(parent.expires_at) <= Date.now() || parent.remaining_calls < 1) {
        throw new OpenPortError(409, ErrorCodes.AGENT_LEASE_PARENT_INVALID, 'Parent lease is not active')
      }
    }

    const eligibleNames = eligibleTools.map((tool) => tool.name)
    let allowedTools = intersect(requestedTools, eligibleNames)
    if (parent) allowedTools = intersect(allowedTools, parent.allowed_tool_names)
    if (allowedTools.length === 0) {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: ctx.actorUserId,
        action: 'agent.capability_lease.create',
        status: 'denied',
        code: ErrorCodes.AGENT_LEASE_EMPTY,
        requestId: input.requestId || null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        details: {
          requestedToolCount: requestedTools.length,
          eligibleToolCount: eligibleNames.length,
          rawRequestedToolNamesStored: false,
          rawTaskStored: false
        }
      })
      throw new OpenPortError(403, ErrorCodes.AGENT_LEASE_EMPTY, 'No requested tool is eligible')
    }

    const requestedResources = uniqueStrings(input.allowedResourceIds, 500)
    const intentResources = intentResourceBounds(certificate)
    let allowedResources = intentResources.length > 0
      ? (requestedResources.length > 0 ? intersect(requestedResources, intentResources) : intentResources)
      : requestedResources
    if (parent) allowedResources = intersect(allowedResources, parent.allowed_resource_ids)

    let allowedFields = uniqueStrings(input.allowedFields, 200, 100)
    if (parent) allowedFields = intersect(allowedFields, parent.allowed_fields)

    const staticMaxRows = boundedInteger(ctx.app.auto_execute?.high_risk?.max_export_rows, MAX_LEASE_ROWS, 0, MAX_LEASE_ROWS)
    let maxRows = boundedInteger(input.maxRows, Math.min(100, staticMaxRows), 0, staticMaxRows)
    let maxEffectAmount = boundedNumber(input.maxEffectAmount, 0, 0, MAX_EFFECT_AMOUNT)
    const certificateMaxAmount = intentMaxAmount(certificate)
    if (certificateMaxAmount !== null) maxEffectAmount = Math.min(maxEffectAmount || certificateMaxAmount, certificateMaxAmount)
    let maxCostUnits = boundedNumber(input.maxCostUnits, 10, 0, MAX_LEASE_COST_UNITS)
    let maxCalls = boundedInteger(input.maxCalls, 10, 1, MAX_LEASE_CALLS)
    let ttlSeconds = boundedInteger(input.expiresInSeconds, DEFAULT_LEASE_TTL_SECONDS, 10, MAX_LEASE_TTL_SECONDS)

    let mode: CapabilityLeaseEffectMode = input.effectModeCeiling || 'draft'
    mode = weakerMode(mode, modeFromIntent(certificate?.review_mode))
    for (const tool of eligibleTools.filter((candidate) => allowedTools.includes(candidate.name))) {
      mode = weakerMode(mode, modeFromContext((tool as AgentManifestTool & { mode?: ContextAuthorityMode }).mode))
    }

    if (parent) {
      const parentRemainingSeconds = Math.floor((Date.parse(parent.expires_at) - Date.now()) / 1000)
      if (parentRemainingSeconds < 10) {
        throw new OpenPortError(409, ErrorCodes.AGENT_LEASE_PARENT_INVALID, 'Parent lease expires too soon')
      }
      maxRows = Math.min(maxRows, parent.max_rows)
      maxEffectAmount = Math.min(maxEffectAmount, parent.max_effect_amount)
      maxCostUnits = Math.min(maxCostUnits, parent.remaining_cost_units)
      maxCalls = Math.min(maxCalls, parent.remaining_calls)
      ttlSeconds = Math.min(ttlSeconds, parentRemainingSeconds)
      mode = weakerMode(mode, parent.effect_mode_ceiling)
    }

    const now = Date.now()
    const lease = this.leaseState.saveCapabilityLease({
      app_id: ctx.app.id,
      key_id: ctx.key.id,
      actor_user_id: ctx.actorUserId,
      session_id: sessionId,
      parent_lease_id: parent?.id || null,
      intent_certificate_id: certificate?.id || null,
      context_risk_snapshot_id: contextResult.snapshot?.snapshot_id || null,
      route_decision_id: routeDecisionId,
      policy_version: policyVersion(ctx),
      allowed_tool_names: allowedTools,
      allowed_resource_ids: allowedResources,
      allowed_fields: allowedFields,
      max_rows: maxRows,
      max_effect_amount: maxEffectAmount,
      effect_mode_ceiling: mode,
      total_cost_units: maxCostUnits,
      remaining_cost_units: maxCostUnits,
      total_calls: maxCalls,
      remaining_calls: maxCalls,
      expires_at: new Date(now + ttlSeconds * 1000).toISOString(),
      revoked_at: null
    })

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.capability_lease.create',
      status: 'success',
      requestId: input.requestId || null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: capabilityLeaseAuditDetails(lease, {
        requestedToolCount: requestedTools.length,
        allowedToolCount: allowedTools.length,
        resourceBoundCount: allowedResources.length,
        fieldBoundCount: allowedFields.length,
        parentLeaseId: parent?.id || null,
        intentCertificateId: certificate?.id || null,
        contextRiskSnapshotId: contextResult.snapshot?.snapshot_id || null,
        routeDecisionId,
        rawRequestedToolNamesStored: false
      })
    })

    return { lease: publicCapabilityLease(lease) }
  }

  getPublicLease(ctx: AgentRequestContext, leaseId: string): Record<string, unknown> {
    return { lease: publicCapabilityLease(this.getLeaseForContext(ctx, leaseId)) }
  }

  async revokeLease(ctx: AgentRequestContext, leaseId: string): Promise<Record<string, unknown>> {
    const lease = this.getLeaseForContext(ctx, leaseId)
    const revoked = this.leaseState.revokeCapabilityLease(lease.id)
    if (!revoked) throw new OpenPortError(404, ErrorCodes.AGENT_LEASE_NOT_FOUND, 'Capability lease not found')
    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.capability_lease.revoke',
      status: 'success',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: capabilityLeaseAuditDetails(revoked)
    })
    return { lease: publicCapabilityLease(revoked) }
  }

  filterManifest(ctx: AgentRequestContext, leaseId: string | undefined, tools: AgentManifestTool[]): { tools: AgentManifestTool[]; lease: AgentCapabilityLease | null } {
    if (!leaseId?.trim()) return { tools, lease: null }
    const lease = this.requireActiveCurrentLease(ctx, leaseId.trim())
    const allowed = new Set(lease.allowed_tool_names)
    return { tools: tools.filter((tool) => allowed.has(tool.name)), lease }
  }

  async flushDurableAuditOutbox(limit = 100): Promise<number> {
    if (!isDurableCapabilityLeaseStateStore(this.leaseState)) return 0
    const pending = this.leaseState.listPendingCapabilityLeaseAudits(limit)
    let delivered = 0
    for (const event of pending) {
      await this.audit.log({
        eventId: event.id,
        appId: event.appId,
        keyId: event.keyId,
        actorUserId: event.actorUserId,
        performedByUserId: event.actorUserId,
        action: 'agent.capability_lease.authorize',
        status: 'success',
        details: {
          ...event.details,
          capabilityLeaseId: event.leaseId,
          requestDigest: event.requestDigest,
          rawTaskStored: false,
          rawPolicyStored: false,
          rawRequestStored: false
        }
      })
      if (this.leaseState.markCapabilityLeaseAuditDelivered(event.id)) delivered += 1
    }
    return delivered
  }

  async authorizeAndConsume(ctx: AgentRequestContext, leaseId: string | undefined, proposal: CapabilityLeaseProposal): Promise<CapabilityLeaseDecision | null> {
    if (!leaseId?.trim()) return null
    let lease = this.requireActiveCurrentLease(ctx, leaseId.trim())
    const resourceIds = uniqueStrings(proposal.resourceIds, 100)
    const fields = uniqueStrings(proposal.fields, 200, 100)
    const rows = boundedNumber(proposal.rows, 0, 0, Number.MAX_SAFE_INTEGER)
    const effectAmount = boundedNumber(proposal.effectAmount, 0, 0, Number.MAX_SAFE_INTEGER)
    const costUnits = boundedNumber(proposal.costUnits, 1, 0, MAX_LEASE_COST_UNITS)

    let code: ErrorCode | null = null
    let reason = ''
    if (!lease.allowed_tool_names.includes(proposal.toolName)) {
      code = ErrorCodes.AGENT_LEASE_TOOL_DENIED
      reason = 'tool_outside_lease'
    } else if (resourceIds.some((id) => !lease.allowed_resource_ids.includes(id))) {
      code = ErrorCodes.AGENT_LEASE_RESOURCE_DENIED
      reason = 'resource_outside_lease'
    } else if (fields.some((field) => !lease.allowed_fields.includes(field))) {
      code = ErrorCodes.AGENT_LEASE_FIELD_DENIED
      reason = 'field_outside_lease'
    } else if (rows > lease.max_rows) {
      code = ErrorCodes.AGENT_LEASE_ROW_LIMIT
      reason = 'row_bound_exceeded'
    } else if (effectAmount > lease.max_effect_amount) {
      code = ErrorCodes.AGENT_LEASE_EFFECT_LIMIT
      reason = 'effect_bound_exceeded'
    } else if (MODE_RANK[proposal.mode] > MODE_RANK[lease.effect_mode_ceiling]) {
      code = ErrorCodes.AGENT_LEASE_MODE_LIMIT
      reason = 'effect_mode_exceeded'
    } else if (proposal.consume === false && lease.remaining_calls < 1) {
      code = ErrorCodes.AGENT_LEASE_CALL_BUDGET
      reason = 'call_budget_exceeded'
    } else if (proposal.consume === false && lease.remaining_cost_units < costUnits) {
      code = ErrorCodes.AGENT_LEASE_COST_BUDGET
      reason = 'cost_budget_exceeded'
    }

    if (code) {
      await this.logDenied(ctx, lease, proposal, code, reason)
      throw new OpenPortError(code === ErrorCodes.AGENT_LEASE_CALL_BUDGET || code === ErrorCodes.AGENT_LEASE_COST_BUDGET ? 429 : 403, code, 'Capability lease denied the proposal', { reason })
    }

    let consumed = false
    let replayed = false
    if (proposal.consume !== false) {
      const proposalFingerprint = `sha256:${sha256JcsHex({
        toolName: proposal.toolName,
        resourceIds: [...resourceIds].sort(),
        fields: [...fields].sort(),
        rows,
        effectAmount,
        mode: proposal.mode,
        costUnits,
        requestFingerprint: proposal.requestFingerprint || null
      })}`
      const result = this.leaseState.consumeCapabilityLease(lease.id, {
        costUnits,
        evidence: {
          requestId: proposal.requestId,
          idempotencyKey: proposal.idempotencyKey,
          proposalFingerprint,
          proposalToolHash: `sha256:${sha256JcsHex({ name: proposal.toolName })}`,
          resourceCount: resourceIds.length,
          fieldCount: fields.length,
          draftId: proposal.draftId,
          executionId: proposal.executionId
        }
      })
      if (!result.ok) {
        const mapped = this.consumptionError(result.reason)
        if (result.lease) await this.logDenied(ctx, result.lease, proposal, mapped.code, mapped.reason)
        throw new OpenPortError(mapped.statusCode, mapped.code, 'Capability lease is no longer consumable', { reason: mapped.reason })
      }
      lease = result.lease
      replayed = result.replayed
      consumed = !result.replayed
      if (isDurableCapabilityLeaseStateStore(this.leaseState)) {
        await this.flushDurableAuditOutbox()
      }
    }

    if (proposal.consume === false || !isDurableCapabilityLeaseStateStore(this.leaseState)) {
      await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.capability_lease.authorize',
      status: 'success',
      requestId: proposal.requestId || null,
      draftId: proposal.draftId || null,
      executionId: proposal.executionId || null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: capabilityLeaseAuditDetails(lease, {
        decision: 'allow',
        consumed,
        replayed,
        costUnits,
        proposalToolHash: `sha256:${sha256JcsHex({ name: proposal.toolName })}`,
        resourceCount: resourceIds.length,
        fieldCount: fields.length
      })
      })
    }

    return { lease, decision: 'allow', consumed, replayed }
  }

  private getLeaseForContext(ctx: AgentRequestContext, leaseId: string): AgentCapabilityLease {
    const lease = this.leaseState.getCapabilityLease(leaseId)
    if (!lease || lease.app_id !== ctx.app.id || lease.key_id !== ctx.key.id || lease.actor_user_id !== ctx.actorUserId) {
      throw new OpenPortError(404, ErrorCodes.AGENT_LEASE_NOT_FOUND, 'Capability lease not found')
    }
    return lease
  }

  private requireActiveCurrentLease(ctx: AgentRequestContext, leaseId: string): AgentCapabilityLease {
    const lease = this.getLeaseForContext(ctx, leaseId)
    if (lease.revoked_at) throw new OpenPortError(409, ErrorCodes.AGENT_LEASE_REVOKED, 'Capability lease is revoked')
    if (Date.parse(lease.expires_at) <= Date.now()) throw new OpenPortError(409, ErrorCodes.AGENT_LEASE_EXPIRED, 'Capability lease is expired')
    if (lease.policy_version !== policyVersion(ctx)) throw new OpenPortError(409, ErrorCodes.AGENT_LEASE_POLICY_STALE, 'Capability lease policy snapshot is stale')
    if (lease.parent_lease_id) {
      const parent = this.leaseState.getCapabilityLease(lease.parent_lease_id)
      if (!parent || parent.revoked_at || Date.parse(parent.expires_at) <= Date.now()) {
        throw new OpenPortError(409, ErrorCodes.AGENT_LEASE_PARENT_INVALID, 'Parent capability lease is no longer active')
      }
    }
    if (lease.intent_certificate_id) {
      const certificate = this.store.getIntentCertificate(lease.intent_certificate_id)
      if (!certificate || certificate.app_id !== ctx.app.id || certificate.key_id !== ctx.key.id || certificate.actor_user_id !== ctx.actorUserId) {
        throw new OpenPortError(409, ErrorCodes.AGENT_LEASE_POLICY_STALE, 'Capability lease intent binding is stale')
      }
    }
    if (lease.context_risk_snapshot_id) {
      const original = this.store.getContextRiskSnapshot(lease.context_risk_snapshot_id)
      const current = this.store.getCurrentContextRiskSnapshot({
        app_id: ctx.app.id,
        key_id: ctx.key.id,
        actor_user_id: ctx.actorUserId,
        session_id: lease.session_id
      })
      if (!original || !current || current.snapshot_id !== original.snapshot_id) {
        throw new OpenPortError(409, ErrorCodes.AGENT_LEASE_POLICY_STALE, 'Capability lease context binding is stale')
      }
    }
    if (lease.route_decision_id) {
      const route = this.store.getRouteDecision(lease.route_decision_id)
      if (!route || route.app_id !== ctx.app.id || route.key_id !== ctx.key.id || route.actor_user_id !== ctx.actorUserId) {
        throw new OpenPortError(409, ErrorCodes.AGENT_LEASE_POLICY_STALE, 'Capability lease route binding is stale')
      }
    }
    return lease
  }

  private consumptionError(reason: 'not_found' | 'revoked' | 'expired' | 'call_budget' | 'cost_budget' | 'idempotency_mismatch'): { statusCode: number; code: ErrorCode; reason: string } {
    if (reason === 'revoked') return { statusCode: 409, code: ErrorCodes.AGENT_LEASE_REVOKED, reason: 'lease_revoked' }
    if (reason === 'expired') return { statusCode: 409, code: ErrorCodes.AGENT_LEASE_EXPIRED, reason: 'lease_expired' }
    if (reason === 'call_budget') return { statusCode: 429, code: ErrorCodes.AGENT_LEASE_CALL_BUDGET, reason: 'call_budget_exceeded' }
    if (reason === 'cost_budget') return { statusCode: 429, code: ErrorCodes.AGENT_LEASE_COST_BUDGET, reason: 'cost_budget_exceeded' }
    if (reason === 'idempotency_mismatch') return { statusCode: 409, code: ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH, reason: 'idempotency_payload_mismatch' }
    return { statusCode: 404, code: ErrorCodes.AGENT_LEASE_NOT_FOUND, reason: 'lease_not_found' }
  }

  private async logDenied(ctx: AgentRequestContext, lease: AgentCapabilityLease, proposal: CapabilityLeaseProposal, code: ErrorCode, reason: string): Promise<void> {
    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.capability_lease.authorize',
      status: 'denied',
      code,
      requestId: proposal.requestId || null,
      draftId: proposal.draftId || null,
      executionId: proposal.executionId || null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: capabilityLeaseAuditDetails(lease, {
        decision: 'deny',
        reason,
        proposalToolHash: `sha256:${sha256JcsHex({ name: proposal.toolName })}`,
        rawPayloadStored: false
      })
    })
  }
}
