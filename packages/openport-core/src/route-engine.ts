import { AuditService } from './audit.js'
import { ContextRiskEngine } from './context-risk.js'
import { ErrorCodes } from './error-codes.js'
import { OpenPortError } from './errors.js'
import { IntentEngine } from './intent-engine.js'
import { InMemoryStore } from './store.js'
import { AgentToolRegistry } from './tool-registry.js'
import type { AgentManifestTool, AgentRequestContext, AgentRouteDecision, ContextAuthorityMode, RouteCandidateEvidence } from './types.js'
import { sha256JcsHex } from './utils.js'

export type RouteCandidateInput = {
  name: string
  score?: number
}

export type CreateRouteInput = {
  candidates: RouteCandidateInput[]
  proposedToolName?: string
  requestId?: string
  intentCertificateId?: string
  contextRiskSnapshotId?: string
  sessionId?: string
  expiresInSeconds?: number
}

type VisibleRouteTool = AgentManifestTool & { mode?: ContextAuthorityMode }

type SafeSetComputation = {
  candidateCount: number
  knownCandidateNames: string[]
  evidence: RouteCandidateEvidence[]
  safeTools: VisibleRouteTool[]
  safeSetHash: string
  reasonCounts: Record<string, number>
  intentCertificateId: string | null
  contextRiskSnapshotId: string | null
}

function candidateHash(name: string): string {
  return `sha256:${sha256JcsHex({ name })}`
}

function toolEnvelopeHash(tool: VisibleRouteTool): string {
  return `sha256:${sha256JcsHex({
    name: tool.name,
    requiredScopes: [...tool.requiredScopes].sort(),
    risk: tool.risk,
    requiresConfirmation: tool.requiresConfirmation,
    contextRiskPolicy: tool.contextRiskPolicy || null,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    mode: tool.mode || null
  })}`
}

function publicTool(tool: VisibleRouteTool): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    risk: tool.risk,
    requiresConfirmation: tool.requiresConfirmation,
    inputSchema: tool.inputSchema,
    ...(tool.mode ? { mode: tool.mode } : {})
  }
}

function normalizeCandidates(candidates: RouteCandidateInput[]): RouteCandidateInput[] {
  if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > 100) {
    throw new OpenPortError(400, ErrorCodes.COMMON_VALIDATION, 'candidates must contain between 1 and 100 tools')
  }

  const seen = new Set<string>()
  const normalized: RouteCandidateInput[] = []
  for (const candidate of candidates) {
    const name = String(candidate?.name || '').trim()
    if (!name || name.length > 200) {
      throw new OpenPortError(400, ErrorCodes.COMMON_VALIDATION, 'candidate tool name is invalid')
    }
    if (seen.has(name)) continue
    seen.add(name)
    normalized.push({
      name,
      ...(Number.isFinite(Number(candidate.score)) ? { score: Number(candidate.score) } : {})
    })
  }
  return normalized
}

export class RouteEngine {
  constructor(
    private readonly store: InMemoryStore,
    private readonly tools: AgentToolRegistry,
    private readonly audit: AuditService,
    private readonly intent: IntentEngine,
    private readonly contextRisk: ContextRiskEngine
  ) {}

  private async computeSafeSet(
    ctx: AgentRequestContext,
    candidatesInput: RouteCandidateInput[],
    opts: { intentCertificateId?: string; contextRiskSnapshotId?: string; sessionId?: string }
  ): Promise<SafeSetComputation> {
    const candidates = normalizeCandidates(candidatesInput)
    const certificate = this.intent.getCertificateForContext(ctx, opts.intentCertificateId)
    const staticTools = this.tools.listManifestTools(ctx)
    const staticNames = new Set(staticTools.map((tool) => tool.name))
    const intentTools = this.intent.filterManifest(certificate, staticTools)
    const intentNames = new Set(intentTools.map((tool) => tool.name))
    const contextResult = await this.contextRisk.filterManifest(ctx, intentTools, opts)
    const visibleByName = new Map(contextResult.tools.map((tool) => [tool.name, tool]))

    const evidence: RouteCandidateEvidence[] = []
    const safeTools: VisibleRouteTool[] = []
    const knownCandidateNames: string[] = []
    const reasonCounts: Record<string, number> = {}

    for (const candidate of candidates) {
      const known = this.tools.getManifestTool(candidate.name)
      const reasons: string[] = []
      if (!known) {
        reasons.push('tool_untrusted_or_unknown')
      } else {
        knownCandidateNames.push(candidate.name)
        if (!staticNames.has(candidate.name)) reasons.push('static_authorization_denied')
        else if (!intentNames.has(candidate.name)) reasons.push('intent_effect_mismatch')
        else if (!visibleByName.has(candidate.name)) reasons.push('context_policy_denied')
      }

      if (reasons.length === 0) {
        const visible = visibleByName.get(candidate.name)
        if (visible) safeTools.push(visible)
        evidence.push({ candidate_hash: candidateHash(candidate.name), status: 'included', reasons: ['eligible'] })
        reasonCounts.eligible = (reasonCounts.eligible || 0) + 1
      } else {
        evidence.push({ candidate_hash: candidateHash(candidate.name), status: 'excluded', reasons })
        for (const reason of reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
      }
    }

    const safeSetHash = `sha256:${sha256JcsHex(safeTools
      .map((tool) => ({ name: tool.name, envelopeHash: toolEnvelopeHash(tool) }))
      .sort((a, b) => a.name.localeCompare(b.name)))}`

    return {
      candidateCount: candidates.length,
      knownCandidateNames,
      evidence,
      safeTools,
      safeSetHash,
      reasonCounts,
      intentCertificateId: certificate?.id || null,
      contextRiskSnapshotId: contextResult.snapshot?.snapshot_id || null
    }
  }

  async createRoute(ctx: AgentRequestContext, input: CreateRouteInput): Promise<Record<string, unknown>> {
    const computed = await this.computeSafeSet(ctx, input.candidates, input)
    const proposal = String(input.proposedToolName || '').trim() || null
    const selected = proposal ? computed.safeTools.find((tool) => tool.name === proposal) || null : null

    if (proposal && !selected) {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: ctx.actorUserId,
        action: 'agent.route.verify',
        status: 'denied',
        code: ErrorCodes.AGENT_ROUTE_SELECTION_OUTSIDE_SAFE_SET,
        requestId: input.requestId || null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        details: {
          safeSetHash: computed.safeSetHash,
          candidateCount: computed.candidateCount,
          includedCount: computed.safeTools.length,
          candidateEvidence: computed.evidence,
          reasonCounts: computed.reasonCounts,
          proposedToolHash: candidateHash(proposal),
          rawRequestStored: false,
          rawExcludedCandidateNamesStored: false
        }
      })
      throw new OpenPortError(403, ErrorCodes.AGENT_ROUTE_SELECTION_OUTSIDE_SAFE_SET, 'Proposed tool is outside the current safe routing set')
    }

    const status: AgentRouteDecision['status'] = selected ? 'selected' : computed.safeTools.length > 0 ? 'ready' : 'clarify'
    const record = this.store.saveRouteDecision({
      app_id: ctx.app.id,
      key_id: ctx.key.id,
      actor_user_id: ctx.actorUserId,
      request_id: input.requestId || null,
      known_candidate_names: computed.knownCandidateNames,
      candidate_evidence: computed.evidence,
      safe_tool_names: computed.safeTools.map((tool) => tool.name),
      safe_set_hash: computed.safeSetHash,
      selected_tool_name: selected?.name || null,
      selected_tool_envelope_hash: selected ? toolEnvelopeHash(selected) : null,
      intent_certificate_id: computed.intentCertificateId,
      context_risk_snapshot_id: computed.contextRiskSnapshotId,
      session_id: input.sessionId || null,
      status,
      ttl_ms: input.expiresInSeconds ? Math.trunc(input.expiresInSeconds * 1000) : undefined
    })

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.route.create',
      status: 'success',
      code: status === 'clarify' ? ErrorCodes.AGENT_ROUTE_SAFE_SET_EMPTY : null,
      requestId: input.requestId || null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: {
        routeId: record.id,
        routeStatus: status,
        safeSetHash: record.safe_set_hash,
        candidateCount: computed.candidateCount,
        includedCount: computed.safeTools.length,
        excludedCount: computed.candidateCount - computed.safeTools.length,
        candidateEvidence: computed.evidence,
        reasonCounts: computed.reasonCounts,
        selectedToolHash: selected ? candidateHash(selected.name) : null,
        intentCertificateId: computed.intentCertificateId,
        contextRiskSnapshotId: computed.contextRiskSnapshotId,
        rawRequestStored: false,
        rawExcludedCandidateNamesStored: false
      }
    })

    return this.toPublicRoute(record, computed.safeTools, computed.reasonCounts, computed.candidateCount)
  }

  async verifyRoute(ctx: AgentRequestContext, routeId: string, proposedToolName?: string): Promise<Record<string, unknown>> {
    const record = this.store.getRouteDecision(routeId)
    if (!record || record.app_id !== ctx.app.id || record.key_id !== ctx.key.id || record.actor_user_id !== ctx.actorUserId) {
      throw new OpenPortError(404, ErrorCodes.AGENT_ROUTE_NOT_FOUND, 'Route decision not found')
    }

    const proposal = String(proposedToolName || record.selected_tool_name || '').trim()
    if (!proposal || (record.selected_tool_name && proposal !== record.selected_tool_name)) {
      throw new OpenPortError(403, ErrorCodes.AGENT_ROUTE_SELECTION_OUTSIDE_SAFE_SET, 'Proposed tool does not match the route decision')
    }

    const computed = await this.computeSafeSet(
      ctx,
      record.known_candidate_names.map((name) => ({ name })),
      {
        intentCertificateId: record.intent_certificate_id || undefined,
        contextRiskSnapshotId: record.context_risk_snapshot_id || undefined,
        sessionId: record.session_id || undefined
      }
    )
    const currentTool = computed.safeTools.find((tool) => tool.name === proposal) || null
    const envelopeMatches = !record.selected_tool_envelope_hash || (currentTool && toolEnvelopeHash(currentTool) === record.selected_tool_envelope_hash)

    if (!currentTool || !envelopeMatches) {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: ctx.actorUserId,
        action: 'agent.route.revalidate',
        status: 'denied',
        code: ErrorCodes.AGENT_ROUTE_SNAPSHOT_STALE,
        requestId: record.request_id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        details: {
          routeId: record.id,
          originalSafeSetHash: record.safe_set_hash,
          currentSafeSetHash: computed.safeSetHash,
          proposedToolHash: candidateHash(proposal),
          candidateEvidence: computed.evidence,
          rawRequestStored: false,
          rawExcludedCandidateNamesStored: false
        }
      })
      throw new OpenPortError(409, ErrorCodes.AGENT_ROUTE_SNAPSHOT_STALE, 'Route is not eligible under the current authoritative state')
    }

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.route.revalidate',
      status: 'success',
      requestId: record.request_id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: {
        routeId: record.id,
        originalSafeSetHash: record.safe_set_hash,
        currentSafeSetHash: computed.safeSetHash,
        snapshotChanged: record.safe_set_hash !== computed.safeSetHash,
        selectedToolHash: candidateHash(proposal),
        rawRequestStored: false
      }
    })

    return {
      routeId: record.id,
      decision: 'selected',
      tool: publicTool(currentTool),
      safeSetHash: computed.safeSetHash,
      snapshotChanged: record.safe_set_hash !== computed.safeSetHash,
      verifiedAt: new Date().toISOString()
    }
  }

  private toPublicRoute(record: AgentRouteDecision, safeTools: VisibleRouteTool[], reasonCounts: Record<string, number>, candidateCount: number): Record<string, unknown> {
    return {
      routeId: record.id,
      decision: record.status,
      safeTools: safeTools.map(publicTool),
      safeSetHash: record.safe_set_hash,
      ...(record.selected_tool_name ? { selectedTool: publicTool(safeTools.find((tool) => tool.name === record.selected_tool_name) as VisibleRouteTool) } : {}),
      reasonCode: record.status === 'clarify' ? ErrorCodes.AGENT_ROUTE_SAFE_SET_EMPTY : null,
      evidence: {
        candidateCount,
        includedCount: safeTools.length,
        excludedCount: candidateCount - safeTools.length,
        reasonCounts,
        rawRequestStored: false,
        rawExcludedCandidateNamesStored: false
      },
      expiresAt: record.expires_at
    }
  }
}
