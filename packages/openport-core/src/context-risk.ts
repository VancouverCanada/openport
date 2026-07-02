import { AuditService } from './audit.js'
import { ErrorCodes, type ErrorCode } from './error-codes.js'
import { OpenPortError } from './errors.js'
import { InMemoryStore } from './store.js'
import type {
  AgentManifestTool,
  AgentRequestContext,
  ContextAuthorityMode,
  ContextRiskLevel,
  ContextRiskSnapshot,
  ContextSegment,
  ContextSourceLabel,
  ContextTrust
} from './types.js'
import { sha256Hex, sha256JcsHex } from './utils.js'

const RISK_RANK: Record<ContextRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
}

const MODE_RANK: Record<ContextAuthorityMode, number> = {
  hidden: 0,
  read_only: 1,
  draft_only: 2,
  preflight_required: 3,
  confirm_required: 4,
  execute_allowed: 5
}

const RISK_SCORE: Record<ContextRiskLevel, number> = {
  low: 0.1,
  medium: 0.55,
  high: 0.82,
  critical: 0.96
}

const UNTRUSTED_SOURCES = new Set<ContextSourceLabel>([
  'untrusted_document',
  'untrusted_web_content',
  'untrusted_tool_output',
  'external_message'
])

const DERIVED_SOURCES = new Set<ContextSourceLabel>([
  'derived_summary',
  'model_plan',
  'product_preview_block',
  'pending_flow_state',
  'compute_result',
  'provider_fallback_output'
])

export type CreateContextSegmentInput = {
  id?: string
  source: ContextSourceLabel
  author?: string | null
  trust?: ContextTrust
  instructionLike?: boolean
  derivedFrom?: string[]
  hash?: string
  content?: string
  ttlSeconds?: number
  createdAt?: string
}

export type CreateContextRiskSnapshotInput = {
  sessionId: string
  segments: CreateContextSegmentInput[]
  expiresInSeconds?: number
}

export type ContextModeDecision = {
  snapshot: ContextRiskSnapshot | null
  mode: ContextAuthorityMode
  code: ErrorCode | null
  reason: string
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function strongerRisk(a: ContextRiskLevel, b: ContextRiskLevel): ContextRiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b
}

function weakerMode(a: ContextAuthorityMode, b: ContextAuthorityMode): ContextAuthorityMode {
  return MODE_RANK[a] <= MODE_RANK[b] ? a : b
}

function riskAtLeast(current: ContextRiskLevel, minimum: ContextRiskLevel): ContextRiskLevel {
  return strongerRisk(current, minimum)
}

function normalizeHash(input: CreateContextSegmentInput): string {
  const provided = input.hash?.trim()
  if (provided) return provided.startsWith('sha256:') ? provided : `sha256:${provided}`
  return `sha256:${sha256Hex(String(input.content || ''))}`
}

function inferTrust(source: ContextSourceLabel, explicit?: ContextTrust): ContextTrust {
  if (explicit) return explicit
  if (source.startsWith('trusted_')) return source === 'trusted_system_policy' || source === 'trusted_admin_policy' ? 'system' : 'trusted'
  if (UNTRUSTED_SOURCES.has(source)) return 'untrusted'
  if (DERIVED_SOURCES.has(source)) return 'derived'
  return 'untrusted'
}

function normalizeSegment(input: CreateContextSegmentInput): ContextSegment {
  return {
    id: String(input.id || `seg_${sha256Hex(`${input.source}:${normalizeHash(input)}`).slice(0, 16)}`),
    source: input.source,
    author: input.author ? String(input.author).slice(0, 120) : null,
    trust: inferTrust(input.source, input.trust),
    instructionLike: input.instructionLike === true,
    derivedFrom: Array.isArray(input.derivedFrom) ? unique(input.derivedFrom.map((item) => String(item)).filter(Boolean)) : [],
    hash: normalizeHash(input),
    ttlSeconds: input.ttlSeconds,
    createdAt: input.createdAt || new Date().toISOString()
  }
}

function baseRiskForSegment(segment: ContextSegment): { risk: ContextRiskLevel; reasons: string[] } {
  let risk: ContextRiskLevel = 'low'
  const reasons: string[] = []

  if (segment.trust === 'untrusted' || UNTRUSTED_SOURCES.has(segment.source)) {
    risk = riskAtLeast(risk, 'medium')
    reasons.push('external_content')
    reasons.push('source_based_minimum_risk')
  }

  if (segment.source === 'untrusted_web_content') {
    risk = riskAtLeast(risk, 'high')
    reasons.push('web_content')
  }

  if (segment.trust === 'derived' || DERIVED_SOURCES.has(segment.source)) {
    risk = riskAtLeast(risk, 'medium')
    reasons.push('derived_context')
  }

  if (segment.source === 'provider_fallback_output') {
    reasons.push('provider_fallback_inherits_provenance')
  }

  if (segment.instructionLike && segment.trust !== 'trusted' && segment.trust !== 'system') {
    risk = riskAtLeast(risk, 'high')
    reasons.push('instruction_like_fragment')
  }

  return { risk, reasons }
}

function computeSnapshotRisk(segments: ContextSegment[]): Pick<ContextRiskSnapshot, 'risk' | 'score' | 'source_labels' | 'segment_hashes' | 'reasons'> {
  if (segments.length === 0) {
    return {
      risk: 'low',
      score: RISK_SCORE.low,
      source_labels: [],
      segment_hashes: [],
      reasons: ['empty_context']
    }
  }

  const byId = new Map(segments.map((segment) => [segment.id, segment]))
  const riskById = new Map<string, ContextRiskLevel>()
  const reasons: string[] = []
  let aggregate: ContextRiskLevel = 'low'

  for (const segment of segments) {
    const base = baseRiskForSegment(segment)
    riskById.set(segment.id, base.risk)
    aggregate = strongerRisk(aggregate, base.risk)
    reasons.push(...base.reasons)
  }

  for (const segment of segments) {
    if (!segment.derivedFrom || segment.derivedFrom.length === 0) continue
    for (const sourceId of segment.derivedFrom) {
      const sourceRisk = riskById.get(sourceId)
      if (!sourceRisk) {
        aggregate = riskAtLeast(aggregate, 'medium')
        reasons.push('provenance_missing')
        continue
      }
      const next = strongerRisk(riskById.get(segment.id) || 'low', sourceRisk)
      riskById.set(segment.id, next)
      aggregate = strongerRisk(aggregate, next)
      const source = byId.get(sourceId)
      if (source && (UNTRUSTED_SOURCES.has(source.source) || source.trust === 'untrusted')) {
        reasons.push('derived_from_untrusted')
      }
    }
  }

  const hasTrusted = segments.some((segment) => segment.trust === 'trusted' || segment.trust === 'system')
  const hasUntrusted = segments.some((segment) => segment.trust === 'untrusted' || UNTRUSTED_SOURCES.has(segment.source))
  if (hasTrusted && hasUntrusted) reasons.push('mixed_trusted_untrusted_context')

  return {
    risk: aggregate,
    score: RISK_SCORE[aggregate],
    source_labels: unique(segments.map((segment) => segment.source)),
    segment_hashes: unique(segments.map((segment) => segment.hash)),
    reasons: unique(reasons.length > 0 ? reasons : ['trusted_context'])
  }
}

function defaultContextPolicy(tool: AgentManifestTool): Required<Record<ContextRiskLevel, ContextAuthorityMode>> {
  if (tool.name === 'ledger.list' || tool.name === 'transaction.list') {
    return {
      low: 'execute_allowed',
      medium: 'execute_allowed',
      high: 'read_only',
      critical: 'hidden'
    }
  }

  if (tool.name === 'transaction.create') {
    return {
      low: 'confirm_required',
      medium: 'draft_only',
      high: 'draft_only',
      critical: 'hidden'
    }
  }

  if (tool.name === 'transaction.update') {
    return {
      low: 'confirm_required',
      medium: 'preflight_required',
      high: 'draft_only',
      critical: 'hidden'
    }
  }

  return {
    low: tool.risk === 'low' ? 'execute_allowed' : tool.risk === 'medium' ? 'confirm_required' : 'preflight_required',
    medium: tool.risk === 'low' ? 'execute_allowed' : tool.risk === 'medium' ? 'draft_only' : 'hidden',
    high: tool.risk === 'low' ? 'read_only' : 'hidden',
    critical: 'hidden'
  }
}

function modeForTool(tool: AgentManifestTool, risk: ContextRiskLevel): ContextAuthorityMode {
  const base = defaultContextPolicy(tool)
  const override = tool.contextRiskPolicy?.[risk]
  return override ? weakerMode(base[risk], override) : base[risk]
}

export function publicContextRiskSnapshot(snapshot: ContextRiskSnapshot): Record<string, unknown> {
  return {
    snapshotId: snapshot.snapshot_id,
    sessionId: snapshot.session_id,
    risk: snapshot.risk,
    score: snapshot.score,
    sourceLabels: snapshot.source_labels,
    segmentHashes: snapshot.segment_hashes,
    reasons: snapshot.reasons,
    createdAt: snapshot.created_at,
    expiresAt: snapshot.expires_at
  }
}

export function contextRiskAuditDetails(snapshot: ContextRiskSnapshot | null, extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (!snapshot) return extra
  return {
    ...extra,
    contextRiskSnapshotId: snapshot.snapshot_id,
    contextRiskLevel: snapshot.risk,
    contextRiskScore: snapshot.score,
    sourceLabels: snapshot.source_labels,
    segmentHashes: snapshot.segment_hashes,
    downgradeReasons: snapshot.reasons,
    rawContextStored: false
  }
}

export class ContextRiskEngine {
  constructor(
    private readonly store: InMemoryStore,
    private readonly audit: AuditService
  ) {}

  async createSnapshot(ctx: AgentRequestContext, input: CreateContextRiskSnapshotInput): Promise<Record<string, unknown>> {
    const sessionId = String(input.sessionId || '').trim()
    if (!sessionId) {
      throw new OpenPortError(400, ErrorCodes.AGENT_CONTEXT_PROVENANCE_MISSING, 'sessionId required')
    }

    const segments = (input.segments || []).map(normalizeSegment)
    const computed = computeSnapshotRisk(segments)
    const snapshot = this.store.saveContextRiskSnapshot({
      app_id: ctx.app.id,
      key_id: ctx.key.id,
      actor_user_id: ctx.actorUserId,
      session_id: sessionId,
      risk: computed.risk,
      score: computed.score,
      source_labels: computed.source_labels,
      segment_hashes: computed.segment_hashes,
      reasons: computed.reasons,
      ttl_ms: input.expiresInSeconds ? Math.trunc(Number(input.expiresInSeconds) * 1000) : undefined
    })

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.context_risk.create',
      status: 'success',
      code: ErrorCodes.AGENT_CONTEXT_AUDIT_REDACTED,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: contextRiskAuditDetails(snapshot, {
        segmentCount: segments.length,
        snapshotHash: `sha256:${sha256JcsHex(publicContextRiskSnapshot(snapshot))}`,
        rawContextStored: false
      })
    })

    return { snapshot: publicContextRiskSnapshot(snapshot) }
  }

  getSnapshotForContext(ctx: AgentRequestContext, snapshotId?: string | null): ContextRiskSnapshot | null {
    const id = snapshotId?.trim()
    if (!id) return null
    const snapshot = this.store.getContextRiskSnapshot(id)
    if (!snapshot) {
      throw new OpenPortError(400, ErrorCodes.AGENT_CONTEXT_SNAPSHOT_NOT_FOUND, 'Context risk snapshot not found')
    }
    if (snapshot.app_id !== ctx.app.id || snapshot.key_id !== ctx.key.id || snapshot.actor_user_id !== ctx.actorUserId) {
      throw new OpenPortError(400, ErrorCodes.AGENT_CONTEXT_SNAPSHOT_CROSS_KEY, 'Context risk snapshot not found for this key')
    }
    return snapshot
  }

  resolveEffectiveSnapshot(ctx: AgentRequestContext, input: { contextRiskSnapshotId?: string | null; sessionId?: string | null } = {}): ContextRiskSnapshot | null {
    const provided = this.getSnapshotForContext(ctx, input.contextRiskSnapshotId)
    const sessionId = String(input.sessionId || provided?.session_id || '').trim()
    const current = sessionId
      ? this.store.getCurrentContextRiskSnapshot({
        app_id: ctx.app.id,
        key_id: ctx.key.id,
        actor_user_id: ctx.actorUserId,
        session_id: sessionId
      })
      : null
    if (!provided) return current
    if (!current) return provided
    return RISK_RANK[current.risk] >= RISK_RANK[provided.risk] ? current : provided
  }

  async filterManifest(ctx: AgentRequestContext, tools: AgentManifestTool[], input: { contextRiskSnapshotId?: string | null; sessionId?: string | null } = {}): Promise<{ tools: Array<AgentManifestTool & { mode?: ContextAuthorityMode }>; snapshot: ContextRiskSnapshot | null }> {
    const snapshot = this.resolveEffectiveSnapshot(ctx, input)
    if (!snapshot) return { tools, snapshot: null }

    const visible: Array<AgentManifestTool & { mode?: ContextAuthorityMode }> = []
    const hidden: string[] = []
    const downgraded: Record<string, ContextAuthorityMode> = {}

    for (const tool of tools) {
      const mode = modeForTool(tool, snapshot.risk)
      if (mode === 'hidden') {
        hidden.push(tool.name)
        continue
      }
      visible.push({ ...tool, mode })
      if (mode !== 'execute_allowed') downgraded[tool.name] = mode
    }

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.manifest.shrink',
      status: 'success',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: contextRiskAuditDetails(snapshot, {
        staticToolCount: tools.length,
        visibleToolCount: visible.length,
        hiddenToolCount: hidden.length,
        hiddenToolNamesHash: hidden.length > 0 ? `sha256:${sha256JcsHex(hidden.sort())}` : null,
        downgradedTools: downgraded,
        rawContextStored: false
      })
    })

    return { tools: visible, snapshot }
  }

  checkToolMode(ctx: AgentRequestContext, tool: AgentManifestTool, input: { contextRiskSnapshotId?: string | null; sessionId?: string | null } = {}): ContextModeDecision {
    const snapshot = this.resolveEffectiveSnapshot(ctx, input)
    if (!snapshot) {
      return { snapshot: null, mode: 'execute_allowed', code: null, reason: 'no_context_snapshot' }
    }

    const mode = modeForTool(tool, snapshot.risk)
    if (mode === 'hidden') {
      return { snapshot, mode, code: ErrorCodes.AGENT_CONTEXT_TOOL_HIDDEN, reason: 'tool_hidden_by_context_risk' }
    }
    if (mode === 'read_only') {
      return { snapshot, mode, code: ErrorCodes.AGENT_CONTEXT_MODE_DOWNGRADED, reason: 'tool_read_only_by_context_risk' }
    }
    if (mode === 'draft_only' || mode === 'preflight_required' || mode === 'confirm_required') {
      return { snapshot, mode, code: ErrorCodes.AGENT_CONTEXT_MODE_DOWNGRADED, reason: 'tool_mode_downgraded_by_context_risk' }
    }
    return { snapshot, mode, code: null, reason: 'context_policy_allows_execute' }
  }
}
