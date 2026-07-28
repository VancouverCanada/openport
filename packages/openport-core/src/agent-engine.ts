import { AuditService } from './audit.js'
import type { ActionExecutionCoordinator } from './action-execution-coordinator.js'
import type { AgentActionStateStore } from './agent-action-state-store.js'
import { CapabilityLeaseEngine, capabilityLeaseAuditDetails, capabilityProposalFromPayload, publicCapabilityLease, type CapabilityLeaseDecision } from './capability-lease.js'
import { ContextRiskEngine, contextRiskAuditDetails, publicContextRiskSnapshot } from './context-risk.js'
import { SingleHostDurableActionExecutor, type DurableEffectContext } from './durable-action-executor.js'
import { ErrorCodes } from './error-codes.js'
import { OpenPortError } from './errors.js'
import { IntentEngine, intentAuditDetails } from './intent-engine.js'
import { ensureLedgerAllowed, ensureScope, ensureWorkspaceBoundary, getDataPolicy, resolveDateRange } from './policy.js'
import { InMemoryStore } from './store.js'
import { AgentToolRegistry } from './tool-registry.js'
import type { AgentDraft, AgentRequestContext, DomainAdapter, IntentCertificate } from './types.js'
import { isExpired, sha256JcsHex } from './utils.js'

function normalizeAutoExecute(value: unknown): {
  writes: { enabled: boolean; expiresAt: string | null; allowedActions: string[] | null }
  highRisk: { enabled: boolean; expiresAt: string | null; requirePreflight: boolean; requireIdempotency: boolean; maxExportRows: number; allowedActions: string[] | null }
} {
  const cfg = (value && typeof value === 'object') ? value as Record<string, any> : {}
  const writes = (cfg.writes && typeof cfg.writes === 'object') ? cfg.writes as Record<string, any> : {}
  const highRisk = (cfg.high_risk && typeof cfg.high_risk === 'object') ? cfg.high_risk as Record<string, any> : {}

  return {
    writes: {
      enabled: Boolean(writes.enabled),
      expiresAt: writes.expires_at ? String(writes.expires_at) : null,
      allowedActions: Array.isArray(writes.allowed_actions) ? writes.allowed_actions.map((v: unknown) => String(v)) : null
    },
    highRisk: {
      enabled: Boolean(highRisk.enabled),
      expiresAt: highRisk.expires_at ? String(highRisk.expires_at) : null,
      requirePreflight: highRisk.require_preflight !== false,
      requireIdempotency: highRisk.require_idempotency !== false,
      maxExportRows: Number.isFinite(Number(highRisk.max_export_rows)) ? Math.min(Math.max(Math.trunc(Number(highRisk.max_export_rows)), 100), 5000) : 1000,
      allowedActions: Array.isArray(highRisk.allowed_actions) ? highRisk.allowed_actions.map((v: unknown) => String(v)) : null
    }
  }
}

export class AgentEngine {
  constructor(
    private readonly store: InMemoryStore,
    private readonly domain: DomainAdapter,
    private readonly tools: AgentToolRegistry,
    private readonly audit: AuditService,
    private readonly intent: IntentEngine,
    private readonly contextRisk: ContextRiskEngine,
    private readonly capabilityLease: CapabilityLeaseEngine,
    private readonly actionExecutionCoordinator: ActionExecutionCoordinator,
    private readonly actionState: AgentActionStateStore = store,
    private readonly durableActionExecutor: SingleHostDurableActionExecutor | null = null
  ) {}

  async manifest(ctx: AgentRequestContext, opts: { intentCertificateId?: string; contextRiskSnapshotId?: string; sessionId?: string; capabilityLeaseId?: string } = {}): Promise<{ app: Record<string, unknown>; tools: unknown[]; intentCertificate?: Record<string, unknown>; contextRiskSnapshot?: Record<string, unknown>; capabilityLease?: Record<string, unknown> }> {
    const certificate = this.intent.getCertificateForContext(ctx, opts.intentCertificateId)
    const staticTools = this.tools.listManifestTools(ctx)
    const intentTools = this.intent.filterManifest(certificate, staticTools)
    const contextFiltered = await this.contextRisk.filterManifest(ctx, intentTools, opts)
    const leaseFiltered = this.capabilityLease.filterManifest(ctx, opts.capabilityLeaseId, contextFiltered.tools)
    const tools = leaseFiltered.tools
    if (certificate || leaseFiltered.lease) {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: ctx.actorUserId,
        action: certificate ? 'agent.intent.manifest' : 'agent.capability_lease.manifest',
        status: 'success',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        details: capabilityLeaseAuditDetails(leaseFiltered.lease, intentAuditDetails(certificate, {
          staticToolCount: staticTools.length,
          visibleToolCount: tools.length,
          contextRiskSnapshotId: contextFiltered.snapshot?.snapshot_id || null
        }))
      })
    }
    return {
      app: {
        id: ctx.app.id,
        name: ctx.app.name,
        scope: ctx.app.scope,
        orgId: ctx.app.org_id
      },
      tools,
      ...(certificate ? { intentCertificate: this.toPublicIntent(certificate) } : {}),
      ...(contextFiltered.snapshot ? { contextRiskSnapshot: publicContextRiskSnapshot(contextFiltered.snapshot) } : {}),
      ...(leaseFiltered.lease ? { capabilityLease: publicCapabilityLease(leaseFiltered.lease) } : {})
    }
  }

  async listLedgers(ctx: AgentRequestContext, opts: { capabilityLeaseId?: string } = {}): Promise<{ items: unknown[]; capabilityLease?: Record<string, unknown> }> {
    ensureScope(ctx, ['ledger.read'])
    const leaseDecision = await this.capabilityLease.authorizeAndConsume(ctx, opts.capabilityLeaseId, {
      toolName: 'ledger.list',
      resourceIds: [],
      fields: [],
      rows: 0,
      effectAmount: 0,
      mode: 'read',
      costUnits: 1,
      consume: true
    })
    const ledgers = await this.domain.listLedgers(ctx.actorUserId)

    const filtered = ledgers.filter((ledger) => {
      if (ctx.app.scope === 'workspace') {
        return ctx.app.org_id && ledger.organization_id === ctx.app.org_id
      }
      return true
    })

    const policy = getDataPolicy(ctx)
    let final = policy.allowedLedgerIds
      ? filtered.filter((ledger) => policy.allowedLedgerIds?.includes(ledger.id))
      : filtered
    if (leaseDecision) {
      const resources = new Set(leaseDecision.lease.allowed_resource_ids)
      const fields = new Set(leaseDecision.lease.allowed_fields)
      final = final
        .filter((ledger) => resources.has(ledger.id))
        .map((ledger) => Object.fromEntries(Object.entries(ledger).filter(([field]) => fields.has(field))) as typeof ledger)
    }

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.ledger.list',
      status: 'success',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: capabilityLeaseAuditDetails(leaseDecision?.lease || null, { resultCount: final.length })
    })

    return {
      items: final,
      ...(leaseDecision ? { capabilityLease: publicCapabilityLease(leaseDecision.lease) } : {})
    }
  }

  async listTransactions(ctx: AgentRequestContext, query: { ledgerId: string; startDate?: string; endDate?: string; page?: number; pageSize?: number; capabilityLeaseId?: string }): Promise<Record<string, unknown>> {
    ensureScope(ctx, ['transaction.read'])
    const ledgerId = query.ledgerId?.trim()
    if (!ledgerId) {
      throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'ledgerId required')
    }

    const ledgers = await this.domain.listLedgers(ctx.actorUserId)
    const ledger = ledgers.find((item) => item.id === ledgerId)
    if (!ledger) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Ledger not found')
    }

    ensureWorkspaceBoundary(ctx, { ledgerOrgId: ledger.organization_id, orgId: null })
    ensureLedgerAllowed(ctx, ledgerId)

    const leaseDecision = await this.capabilityLease.authorizeAndConsume(ctx, query.capabilityLeaseId, {
      toolName: 'transaction.list',
      resourceIds: [ledgerId],
      fields: [],
      rows: query.pageSize || 20,
      effectAmount: 0,
      mode: 'read',
      costUnits: 1,
      consume: true
    })

    const range = resolveDateRange(ctx, { startDate: query.startDate, endDate: query.endDate })
    const dataPolicy = getDataPolicy(ctx)

    const result = await this.domain.listTransactions(ctx.actorUserId, {
      ledgerId,
      startDate: range.startDate,
      endDate: range.endDate,
      page: query.page,
      pageSize: query.pageSize
    })

    const redactedFields: string[] = []
    const items = result.items.map((txn) => {
      const presented = this.tools.presentTransaction(txn as unknown as Record<string, unknown>, ctx)
      redactedFields.push(...presented.redactedFields)
      if (!leaseDecision) return presented.item
      const allowed = new Set(leaseDecision.lease.allowed_fields)
      return Object.fromEntries(Object.entries(presented.item).filter(([field]) => allowed.has(field)))
    })

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.transaction.list',
      status: 'success',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: capabilityLeaseAuditDetails(leaseDecision?.lease || null, {
        ledgerId,
        startDate: range.startDate || null,
        endDate: range.endDate || null,
        page: result.page,
        pageSize: result.pageSize,
        resultCount: items.length,
        redactedFields: [...new Set(redactedFields)],
        policy: dataPolicy
      })
    })

    return {
      items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
      ...(leaseDecision ? { capabilityLease: publicCapabilityLease(leaseDecision.lease) } : {})
    }
  }

  async preflight(ctx: AgentRequestContext, input: { action: string; payload: Record<string, unknown>; intentCertificateId?: string; contextRiskSnapshotId?: string; sessionId?: string; capabilityLeaseId?: string }): Promise<Record<string, unknown>> {
    const tool = this.tools.getActionTool(input.action)
    if (!tool) {
      throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_UNKNOWN, 'Unknown action')
    }
    ensureScope(ctx, tool.requiredScopes)
    const contextDecision = this.contextRisk.checkToolMode(ctx, tool, input)
    if (contextDecision.mode === 'hidden' || contextDecision.mode === 'read_only') {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: ctx.actorUserId,
        action: 'agent.action.preflight',
        status: 'denied',
        code: contextDecision.code,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        details: contextRiskAuditDetails(contextDecision.snapshot, {
          actionType: tool.name,
          mode: contextDecision.mode,
          reason: contextDecision.reason
        })
      })
      throw new OpenPortError(403, contextDecision.code || ErrorCodes.AGENT_CONTEXT_TOOL_HIDDEN, 'Context policy denied preflight', {
        action: tool.name,
        mode: contextDecision.mode,
        reason: contextDecision.reason
      })
    }
    const certificate = this.intent.getCertificateForContext(ctx, input.intentCertificateId)
    const intentDecision = this.intent.checkTool(certificate, tool, { payload: input.payload, execute: false })
    if (intentDecision?.decision === 'deny') {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: ctx.actorUserId,
        action: 'agent.action.preflight',
        status: 'denied',
        code: intentDecision.code,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        details: intentAuditDetails(certificate, {
          actionType: tool.name,
          reason: intentDecision.reason,
          intentDecision: intentDecision.decision
        })
      })
      throw new OpenPortError(403, intentDecision.code || ErrorCodes.AGENT_FORBIDDEN, 'Intent policy denied', {
        action: tool.name,
        reason: intentDecision.reason
      })
    }

    const leaseDecision = await this.capabilityLease.authorizeAndConsume(
      ctx,
      input.capabilityLeaseId,
      capabilityProposalFromPayload({
        toolName: tool.name,
        payload: input.payload,
        mode: 'preflight',
        consume: false
      })
    )

    const impact = tool.computeImpact
      ? await tool.computeImpact(ctx, input.payload, { domain: this.domain })
      : { summary: tool.risk === 'high' ? 'High impact action' : 'Low impact action' }
    const stateWitness = tool.computeStateWitness
      ? await tool.computeStateWitness(ctx, input.payload, { domain: this.domain })
      : null

    const impactHash = sha256JcsHex({ action: tool.name, payload: input.payload, impact })
    const stateWitnessHash = stateWitness ? sha256JcsHex(stateWitness) : null
    const preflight = this.store.savePreflight({
      app_id: ctx.app.id,
      key_id: ctx.key.id,
      actor_user_id: ctx.actorUserId,
      action_type: tool.name,
      payload: input.payload,
      impact_hash: impactHash,
      state_witness: stateWitness,
      state_witness_hash: stateWitnessHash
    })

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.action.preflight',
      status: 'success',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: capabilityLeaseAuditDetails(leaseDecision?.lease || null, contextRiskAuditDetails(contextDecision.snapshot, intentAuditDetails(certificate, {
        actionType: tool.name,
        risk: tool.risk,
        impact,
        contextMode: contextDecision.mode,
        intentDecision: intentDecision?.decision || null
      })))
    })

    return {
      action: tool.name,
      risk: tool.risk,
      requiresConfirmation: tool.requiresConfirmation,
      impact,
      impactHash,
      stateWitness,
      stateWitnessHash,
      preflightId: preflight.id,
      contextMode: contextDecision.mode,
      ...(certificate ? { intentCertificate: this.toPublicIntent(certificate) } : {}),
      ...(contextDecision.snapshot ? { contextRiskSnapshot: publicContextRiskSnapshot(contextDecision.snapshot) } : {}),
      ...(leaseDecision ? { capabilityLease: publicCapabilityLease(leaseDecision.lease) } : {})
    }
  }

  async createAction(ctx: AgentRequestContext, input: { action: string; payload?: Record<string, unknown>; preflightId?: string; execute?: boolean; forceDraft?: boolean; requestId?: string; idempotencyKey?: string; justification?: string; preflightHash?: string; stateWitnessHash?: string; intentCertificateId?: string; contextRiskSnapshotId?: string; sessionId?: string; capabilityLeaseId?: string }): Promise<Record<string, unknown>> {
    let actionName = input.action
    let payload = input.payload
    let preflightHash = input.preflightHash
    let stateWitnessHash = input.stateWitnessHash
    let preflightStateWitness: Record<string, unknown> | null = null

    if (input.preflightId?.trim()) {
      const record = this.store.getPreflight(input.preflightId.trim())
      if (!record || record.app_id !== ctx.app.id || record.key_id !== ctx.key.id || record.actor_user_id !== ctx.actorUserId) {
        throw new OpenPortError(400, ErrorCodes.AGENT_PREFLIGHT_NOT_FOUND, 'Preflight not found')
      }
      if (record.action_type !== actionName) {
        throw new OpenPortError(400, ErrorCodes.AGENT_PREFLIGHT_MISMATCH, 'Preflight mismatch')
      }
      if (payload === undefined) payload = record.payload
      if (!preflightHash?.trim()) preflightHash = record.impact_hash
      if (!stateWitnessHash?.trim()) stateWitnessHash = record.state_witness_hash || undefined
      preflightStateWitness = record.state_witness
    }

    if (!payload) {
      throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'payload required')
    }

    const tool = this.tools.getActionTool(actionName)
    if (!tool) {
      throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_UNKNOWN, 'Unknown action')
    }
    ensureScope(ctx, tool.requiredScopes)
    const contextDecision = this.contextRisk.checkToolMode(ctx, tool, input)
    if (contextDecision.mode === 'hidden' || contextDecision.mode === 'read_only') {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: ctx.actorUserId,
        action: 'agent.action.create',
        status: 'denied',
        code: contextDecision.code,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        details: contextRiskAuditDetails(contextDecision.snapshot, {
          actionType: tool.name,
          mode: contextDecision.mode,
          reason: contextDecision.reason
        })
      })
      throw new OpenPortError(403, contextDecision.code || ErrorCodes.AGENT_CONTEXT_TOOL_HIDDEN, 'Context policy denied action', {
        action: tool.name,
        mode: contextDecision.mode,
        reason: contextDecision.reason
      })
    }
    const certificate = this.intent.getCertificateForContext(ctx, input.intentCertificateId)
    const intentDecision = this.intent.checkTool(certificate, tool, { payload, execute: input.execute === true && input.forceDraft !== true })
    if (intentDecision?.decision === 'deny') {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: ctx.actorUserId,
        action: 'agent.action.create',
        status: 'denied',
        code: intentDecision.code,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        details: intentAuditDetails(certificate, {
          actionType: tool.name,
          reason: intentDecision.reason,
          intentDecision: intentDecision.decision
        })
      })
      throw new OpenPortError(403, intentDecision.code || ErrorCodes.AGENT_FORBIDDEN, 'Intent policy denied', {
        action: tool.name,
        reason: intentDecision.reason
      })
    }

    const auto = normalizeAutoExecute(ctx.app.auto_execute)
    const wantsExecute = input.execute === true && input.forceDraft !== true
    let leaseDecision: CapabilityLeaseDecision | null = null

    if (wantsExecute && input.idempotencyKey && !this.durableActionExecutor) {
      const existing = this.actionState.findExecutionByIdempotency(ctx.app.id, input.idempotencyKey)
      if (existing) {
        const requestFingerprint = sha256JcsHex({ actionType: tool.name, payload })
        const existingFingerprint = this.actionState.getExecutionRequestFingerprint(existing.id)
        if (existingFingerprint && existingFingerprint !== requestFingerprint) {
          throw new OpenPortError(
            409,
            ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH,
            'Idempotency key is already bound to a different action payload'
          )
        }
        await this.audit.log({
          appId: ctx.app.id,
          keyId: ctx.key.id,
          actorUserId: ctx.actorUserId,
          performedByUserId: ctx.actorUserId,
          action: 'agent.action.idempotency_replay',
          status: 'success',
          code: ErrorCodes.AGENT_IDEMPOTENCY_REPLAY,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          details: { executionId: existing.id, actionType: tool.name }
        })

        return {
          status: 'executed',
          replayed: true,
          code: ErrorCodes.AGENT_IDEMPOTENCY_REPLAY,
          execution: existing
        }
      }
    }

    const contextRequiresPreflight = contextDecision.mode === 'preflight_required'
    const impact = tool.risk === 'high' || contextRequiresPreflight
      ? (tool.computeImpact ? await tool.computeImpact(ctx, payload, { domain: this.domain }) : { summary: 'High impact action' })
      : null
    const computedPreflightHash = impact
      ? sha256JcsHex({ action: tool.name, payload, impact })
      : null
    const computedStateWitness = tool.computeStateWitness
      ? await tool.computeStateWitness(ctx, payload, { domain: this.domain })
      : null
    const computedStateWitnessHash = computedStateWitness
      ? sha256JcsHex(computedStateWitness)
      : null
    const expectedStateWitnessHash = stateWitnessHash?.trim() || null

    if (expectedStateWitnessHash && computedStateWitnessHash && computedStateWitnessHash !== expectedStateWitnessHash) {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: ctx.actorUserId,
        action: 'agent.action.create',
        status: 'denied',
        code: ErrorCodes.AGENT_PRECONDITION_FAILED,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        details: intentAuditDetails(certificate, { actionType: tool.name, reason: 'state_witness_mismatch' })
      })
      throw new OpenPortError(409, ErrorCodes.AGENT_PRECONDITION_FAILED, 'State precondition failed', {
        action: tool.name,
        reason: 'state_witness_mismatch'
      })
    }

    const draftStateWitness = preflightStateWitness || computedStateWitness
    const draftStateWitnessHash = expectedStateWitnessHash || computedStateWitnessHash

    let canAutoExecute = false
    let autoExecuteDeniedCode: string | null = null

    if (wantsExecute) {
      if (intentDecision?.decision === 'review') {
        autoExecuteDeniedCode = intentDecision.code
      } else if (contextDecision.mode === 'draft_only' || contextDecision.mode === 'confirm_required') {
        autoExecuteDeniedCode = ErrorCodes.AGENT_CONTEXT_MODE_DOWNGRADED
      } else if (contextRequiresPreflight && !preflightHash?.trim()) {
        autoExecuteDeniedCode = ErrorCodes.AGENT_PREFLIGHT_REQUIRED
      } else if (contextRequiresPreflight && computedPreflightHash !== preflightHash?.trim()) {
        autoExecuteDeniedCode = ErrorCodes.AGENT_PREFLIGHT_MISMATCH
      } else if (tool.risk === 'high') {
        if (!auto.highRisk.enabled) autoExecuteDeniedCode = ErrorCodes.AGENT_AUTO_EXECUTE_DISABLED
        else if (isExpired(auto.highRisk.expiresAt)) autoExecuteDeniedCode = ErrorCodes.AGENT_AUTO_EXECUTE_EXPIRED
        else if (auto.highRisk.allowedActions && !auto.highRisk.allowedActions.includes(tool.name)) autoExecuteDeniedCode = ErrorCodes.AGENT_AUTO_EXECUTE_DENIED
        else if (!input.justification?.trim()) autoExecuteDeniedCode = ErrorCodes.AGENT_ACTION_INVALID
        else if (auto.highRisk.requireIdempotency && !input.idempotencyKey?.trim()) autoExecuteDeniedCode = ErrorCodes.AGENT_IDEMPOTENCY_REQUIRED
        else if (auto.highRisk.requirePreflight) {
          if (!preflightHash?.trim()) autoExecuteDeniedCode = ErrorCodes.AGENT_PREFLIGHT_REQUIRED
          else if (computedPreflightHash !== preflightHash.trim()) autoExecuteDeniedCode = ErrorCodes.AGENT_PREFLIGHT_MISMATCH
        }
      } else {
        if (!auto.writes.enabled) autoExecuteDeniedCode = ErrorCodes.AGENT_AUTO_EXECUTE_DISABLED
        else if (isExpired(auto.writes.expiresAt)) autoExecuteDeniedCode = ErrorCodes.AGENT_AUTO_EXECUTE_EXPIRED
        else if (auto.writes.allowedActions && !auto.writes.allowedActions.includes(tool.name)) autoExecuteDeniedCode = ErrorCodes.AGENT_AUTO_EXECUTE_DENIED
      }
      canAutoExecute = !autoExecuteDeniedCode
    }

    if (input.capabilityLeaseId) {
      leaseDecision = await this.capabilityLease.authorizeAndConsume(
        ctx,
        input.capabilityLeaseId,
        capabilityProposalFromPayload({
          toolName: tool.name,
          payload,
          mode: wantsExecute ? 'execute' : 'draft',
          consume: true,
          requestId: input.requestId || null,
          idempotencyKey: input.idempotencyKey || null
        })
      )
    }

    const draft = this.actionState.saveDraft({
      app_id: ctx.app.id,
      key_id: ctx.key.id,
      actor_user_id: ctx.actorUserId,
      action_type: tool.name,
      payload,
      status: canAutoExecute ? 'confirmed' : 'draft',
      requires_confirmation: tool.requiresConfirmation,
      auto_execute_requested: wantsExecute,
      request_id: input.requestId?.trim() || null,
      idempotency_key: input.idempotencyKey?.trim() || null,
      justification: input.justification?.trim() || null,
      preflight: impact,
      preflight_hash: preflightHash?.trim() || computedPreflightHash || null,
      preflight_state_witness: draftStateWitness,
      preflight_state_witness_hash: draftStateWitnessHash,
      policy_snapshot: {
        requiredScopes: tool.requiredScopes,
        risk: tool.risk,
        auto_execute: auto,
        ...(contextDecision.snapshot ? {
          context: {
            snapshotId: contextDecision.snapshot.snapshot_id,
            sessionId: contextDecision.snapshot.session_id,
            risk: contextDecision.snapshot.risk,
            mode: contextDecision.mode,
            reason: contextDecision.reason
          }
        } : {}),
        ...(certificate ? {
          intent: {
            certificateId: certificate.id,
            intentHash: certificate.request_hash,
            intentClasses: certificate.intent_classes,
            confidence: certificate.confidence,
            reviewMode: certificate.review_mode,
            decision: intentDecision?.decision || null,
            reason: intentDecision?.reason || null
          }
        } : {}),
        ...(leaseDecision ? {
          capabilityLease: {
            leaseId: leaseDecision.lease.id,
            version: leaseDecision.lease.version,
            policyVersion: leaseDecision.lease.policy_version,
            sessionId: leaseDecision.lease.session_id,
            effectModeCeiling: leaseDecision.lease.effect_mode_ceiling,
            consumed: leaseDecision.consumed
          }
        } : {})
      },
      confirmed_by_user_id: null,
      confirmed_at: canAutoExecute ? new Date().toISOString() : null,
      canceled_at: null
    })

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: canAutoExecute ? 'agent.action.auto_execute.requested' : 'agent.action.draft.created',
      status: autoExecuteDeniedCode ? 'denied' : 'success',
      code: autoExecuteDeniedCode,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      draftId: draft.id,
      details: capabilityLeaseAuditDetails(leaseDecision?.lease || null, contextRiskAuditDetails(contextDecision.snapshot, intentAuditDetails(certificate, {
        actionType: tool.name,
        risk: tool.risk,
        contextMode: contextDecision.mode,
        autoExecuteRequested: wantsExecute,
        autoExecuteDeniedCode,
        intentDecision: intentDecision?.decision || null
      })))
    })

    if (!canAutoExecute) {
      return {
        status: 'draft',
        draft: this.toPublicDraft(draft),
        autoExecuteDeniedCode,
        review_path: '/agent-admin/v1/drafts',
        ...(certificate ? { intentCertificate: this.toPublicIntent(certificate) } : {}),
        ...(contextDecision.snapshot ? { contextRiskSnapshot: publicContextRiskSnapshot(contextDecision.snapshot) } : {}),
        ...(leaseDecision ? { capabilityLease: publicCapabilityLease(leaseDecision.lease) } : {})
      }
    }

    const execution = await this.executeDraft(ctx, draft.id, { confirmedByUserId: null })

    return {
      status: 'executed',
      draft: { id: draft.id, status: execution.draftStatus },
      execution: execution.execution,
      ...(certificate ? { intentCertificate: this.toPublicIntent(certificate) } : {}),
      ...(contextDecision.snapshot ? { contextRiskSnapshot: publicContextRiskSnapshot(contextDecision.snapshot) } : {}),
      ...(leaseDecision ? { capabilityLease: publicCapabilityLease(leaseDecision.lease) } : {})
    }
  }

  async getDraft(ctx: AgentRequestContext, draftId: string): Promise<Record<string, unknown>> {
    const draft = this.actionState.getDraft(draftId)
    if (!draft || draft.app_id !== ctx.app.id) {
      throw new OpenPortError(404, ErrorCodes.AGENT_DRAFT_NOT_FOUND, 'Draft not found')
    }

    const latestExecution = this.actionState.getLatestExecutionForDraft(draft.id)
    return {
      draft: this.toPublicDraft(draft),
      execution: latestExecution
    }
  }

  async executeDraft(ctx: AgentRequestContext, draftId: string, opts: { confirmedByUserId: string | null }): Promise<{ draftStatus: string; execution: Record<string, unknown> }> {
    const draft = this.actionState.getDraft(draftId)
    if (!draft || draft.app_id !== ctx.app.id) {
      throw new OpenPortError(404, ErrorCodes.AGENT_DRAFT_NOT_FOUND, 'Draft not found')
    }

    if (draft.status === 'canceled') {
      throw new OpenPortError(400, ErrorCodes.AGENT_DRAFT_ALREADY_FINAL, 'Draft was canceled')
    }

    const tool = this.tools.getActionTool(draft.action_type)
    if (!tool) {
      throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_UNKNOWN, 'Unknown action')
    }

    ensureScope(ctx, tool.requiredScopes)

    const capabilityPolicy = (draft.policy_snapshot && typeof draft.policy_snapshot === 'object')
      ? (draft.policy_snapshot as { capabilityLease?: { leaseId?: unknown } }).capabilityLease
      : null
    const executeLeaseDecision = capabilityPolicy?.leaseId
      ? await this.capabilityLease.authorizeAndConsume(
        ctx,
        String(capabilityPolicy.leaseId),
        capabilityProposalFromPayload({
          toolName: tool.name,
          payload: draft.payload,
          mode: 'execute',
          consume: false,
          draftId: draft.id
        })
      )
      : null

    const contextPolicy = (draft.policy_snapshot && typeof draft.policy_snapshot === 'object')
      ? (draft.policy_snapshot as { context?: { sessionId?: unknown; snapshotId?: unknown } }).context
      : null
    const executeContextDecision = contextPolicy
      ? this.contextRisk.checkToolMode(ctx, tool, {
        sessionId: contextPolicy.sessionId ? String(contextPolicy.sessionId) : undefined,
        contextRiskSnapshotId: contextPolicy.snapshotId ? String(contextPolicy.snapshotId) : undefined
      })
      : null
    if (executeContextDecision && (executeContextDecision.mode === 'hidden' || executeContextDecision.mode === 'read_only')) {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: opts.confirmedByUserId || ctx.actorUserId,
        action: 'agent.action.execute',
        status: 'denied',
        code: ErrorCodes.AGENT_CONTEXT_MANIFEST_STALE,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        draftId: draft.id,
        details: contextRiskAuditDetails(executeContextDecision.snapshot, {
          actionType: tool.name,
          mode: executeContextDecision.mode,
          reason: 'current_context_no_longer_allows_draft_execution'
        })
      })
      throw new OpenPortError(403, ErrorCodes.AGENT_CONTEXT_MANIFEST_STALE, 'Current context no longer allows this action', {
        action: tool.name,
        mode: executeContextDecision.mode,
        reason: 'current_context_no_longer_allows_draft_execution'
      })
    }

    const requestFingerprint = sha256JcsHex({
      actionType: draft.action_type,
      payload: draft.payload
    })

    if (draft.idempotency_key && !this.durableActionExecutor) {
      const replay = this.actionState.findExecutionByIdempotency(ctx.app.id, draft.idempotency_key)
      if (replay) {
        const existingFingerprint = this.actionState.getExecutionRequestFingerprint(replay.id)
        if (existingFingerprint && existingFingerprint !== requestFingerprint) {
          throw new OpenPortError(
            409,
            ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH,
            'Idempotency key is already bound to a different action payload'
          )
        }
        return {
          draftStatus: draft.status,
          execution: {
            ...replay,
            replayed: true
          }
        }
      }
    }

    if (draft.preflight_state_witness_hash) {
      if (!tool.computeStateWitness) {
        throw new OpenPortError(409, ErrorCodes.AGENT_PRECONDITION_FAILED, 'State precondition failed', {
          action: tool.name,
          reason: 'state_witness_unsupported'
        })
      }

      const currentWitness = await tool.computeStateWitness(ctx, draft.payload, { domain: this.domain })
      const currentWitnessHash = currentWitness ? sha256JcsHex(currentWitness) : null
      if (!currentWitnessHash || currentWitnessHash !== draft.preflight_state_witness_hash) {
        await this.audit.log({
          appId: ctx.app.id,
          keyId: ctx.key.id,
          actorUserId: ctx.actorUserId,
          performedByUserId: opts.confirmedByUserId || ctx.actorUserId,
          action: 'agent.action.execute',
          status: 'denied',
          code: ErrorCodes.AGENT_PRECONDITION_FAILED,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          draftId: draft.id,
          details: { actionType: tool.name, reason: 'state_witness_mismatch' }
        })
        throw new OpenPortError(409, ErrorCodes.AGENT_PRECONDITION_FAILED, 'State precondition failed', {
          action: tool.name,
          reason: 'state_witness_mismatch'
        })
      }
    }

    type ExecutionOutcome =
      | { ok: true; draftStatus: string; execution: Record<string, unknown> }
      | { ok: false; error: unknown }

    const executeOnce = async (effectContext?: DurableEffectContext): Promise<ExecutionOutcome> => {
      try {
        if (effectContext && draft.idempotency_key) {
          const existing = this.actionState.findExecutionByIdempotency(ctx.app.id, draft.idempotency_key)
          if (existing) {
            const existingFingerprint = this.actionState.getExecutionRequestFingerprint(existing.id)
            if (existingFingerprint && existingFingerprint !== requestFingerprint) {
              throw new OpenPortError(
                409,
                ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH,
                'Idempotency key is already bound to a different action payload'
              )
            }
            this.actionState.updateDraft(draft.id, {
              status: 'confirmed',
              confirmed_by_user_id: opts.confirmedByUserId,
              confirmed_at: draft.confirmed_at || new Date().toISOString(),
              canceled_at: null
            })
            return {
              ok: true,
              draftStatus: 'confirmed',
              execution: { ...existing, replayed: true }
            }
          }
        }

        const result = await tool.execute(
          ctx,
          draft.payload,
          { domain: this.domain },
          { confirmedByUserId: opts.confirmedByUserId, effectContext }
        )
        const execution = this.actionState.saveExecution({
          draft_id: draft.id,
          app_id: draft.app_id,
          idempotency_key: draft.idempotency_key,
          status: 'success',
          result,
          error: null
        }, requestFingerprint)

        this.actionState.updateDraft(draft.id, {
          status: 'confirmed',
          confirmed_by_user_id: opts.confirmedByUserId,
          confirmed_at: opts.confirmedByUserId ? new Date().toISOString() : draft.confirmed_at || new Date().toISOString(),
          canceled_at: null
        })

        await this.audit.log({
          appId: ctx.app.id,
          keyId: ctx.key.id,
          actorUserId: ctx.actorUserId,
          performedByUserId: opts.confirmedByUserId || ctx.actorUserId,
          action: 'agent.action.execute',
          status: 'success',
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          draftId: draft.id,
          executionId: execution.id,
          details: capabilityLeaseAuditDetails(executeLeaseDecision?.lease || null, { actionType: tool.name })
        })

        return {
          ok: true,
          draftStatus: 'confirmed',
          execution
        }
      } catch (error) {
        const known = error instanceof OpenPortError
        const message = known ? error.message : 'Execution failed'
        const code = known ? error.code : ErrorCodes.AGENT_EXECUTION_FAILED
        const execution = this.actionState.saveExecution({
          draft_id: draft.id,
          app_id: draft.app_id,
          idempotency_key: draft.idempotency_key,
          status: 'failed',
          result: null,
          error: message
        }, requestFingerprint)

        this.actionState.updateDraft(draft.id, { status: 'failed' })

        await this.audit.log({
          appId: ctx.app.id,
          keyId: ctx.key.id,
          actorUserId: ctx.actorUserId,
          performedByUserId: opts.confirmedByUserId || ctx.actorUserId,
          action: 'agent.action.execute',
          status: 'failed',
          code,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          draftId: draft.id,
          executionId: execution.id,
          details: capabilityLeaseAuditDetails(executeLeaseDecision?.lease || null, { actionType: tool.name })
        })

        return { ok: false, error }
      }
    }

    let coordinated: { value: ExecutionOutcome; replayed: boolean; coordination: 'none' | 'process_local' | 'single_host_durable' }
    if (draft.idempotency_key && this.durableActionExecutor) {
      const durableInput = {
        scopeKey: ctx.app.id + ':' + draft.idempotency_key,
        requestFingerprint,
        actionType: tool.name,
        opaqueEffectEnvelope: JSON.stringify({ version: 1, actionType: tool.name, requestFingerprint })
      }
      const durable = await this.durableActionExecutor.execute(
        durableInput,
        async (effectContext) => {
          const outcome = await executeOnce(effectContext)
          if (!outcome.ok) throw outcome.error
          return outcome
        },
        {
          receiptComparableResult: (outcome) => outcome.ok
            ? outcome.execution.result
            : null
        }
      )
      let value = durable.value
      if (!value) {
        let receiptReconciled = false
        let receiptAuthentication: { algorithm: 'Ed25519'; keyId: string } | null = null
        let existing = this.actionState.findExecutionByIdempotency(ctx.app.id, draft.idempotency_key)
        let existingFingerprint = existing
          ? this.actionState.getExecutionRequestFingerprint(existing.id)
          : null
        if (existing && existingFingerprint && existingFingerprint !== requestFingerprint) {
          throw new OpenPortError(
            409,
            ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH,
            'Idempotency key is already bound to a different action payload'
          )
        }
        if (!existing) {
          const reconciliation = await this.durableActionExecutor.reconcileSucceededEffect(
            durableInput,
            durable.obligation
          )
          if (reconciliation) {
            existing = this.actionState.saveExecution({
              draft_id: draft.id,
              app_id: draft.app_id,
              idempotency_key: draft.idempotency_key,
              status: 'success',
              result: reconciliation.result,
              error: null
            }, requestFingerprint)
            existingFingerprint = this.actionState.getExecutionRequestFingerprint(existing.id)
            receiptReconciled = true
            receiptAuthentication = reconciliation.authentication
            await this.audit.log({
              appId: ctx.app.id,
              keyId: ctx.key.id,
              actorUserId: ctx.actorUserId,
              performedByUserId: opts.confirmedByUserId || ctx.actorUserId,
              action: 'agent.action.effect_receipt_reconciled',
              status: 'success',
              ip: ctx.ip,
              userAgent: ctx.userAgent,
              draftId: draft.id,
              executionId: existing.id,
              details: {
                actionType: tool.name,
                resultDigest: reconciliation.resultDigest,
                receiptAuthenticated: receiptAuthentication !== null,
                ...(receiptAuthentication ? { receiptKeyId: receiptAuthentication.keyId } : {})
              }
            })
          }
        }
        if (!existing || (existingFingerprint && existingFingerprint !== requestFingerprint)) {
          throw new OpenPortError(
            409,
            ErrorCodes.AGENT_PRECONDITION_FAILED,
            'Durable action completed without a matching execution record',
            { reason: 'durable_execution_record_missing', obligationId: durable.obligation.id }
          )
        }
        this.actionState.updateDraft(draft.id, {
          status: 'confirmed',
          confirmed_by_user_id: opts.confirmedByUserId,
          confirmed_at: draft.confirmed_at || new Date().toISOString(),
          canceled_at: null
        })
        value = {
          ok: true,
          draftStatus: 'confirmed',
          execution: {
            ...existing,
            replayed: true,
            ...(receiptReconciled
              ? {
                  receipt_reconciled: true,
                  receipt_authenticated: receiptAuthentication !== null,
                  ...(receiptAuthentication ? { receipt_key_id: receiptAuthentication.keyId } : {})
                }
              : {})
          }
        }
      }
      coordinated = {
        value,
        replayed: durable.replayed || (value.ok && value.execution.replayed === true),
        coordination: 'single_host_durable'
      }
    } else if (draft.idempotency_key) {
      const local = await this.actionExecutionCoordinator.coordinate(
        {
          scopeKey: sha256JcsHex({ appId: ctx.app.id, idempotencyKey: draft.idempotency_key }),
          requestFingerprint
        },
        executeOnce
      )
      coordinated = { ...local, coordination: 'process_local' }
    } else {
      coordinated = { value: await executeOnce(), replayed: false, coordination: 'none' }
    }

    if (!coordinated.value.ok) throw coordinated.value.error
    if (coordinated.replayed) {
      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: opts.confirmedByUserId || ctx.actorUserId,
        action: 'agent.action.idempotency_replay',
        status: 'success',
        code: ErrorCodes.AGENT_IDEMPOTENCY_REPLAY,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        draftId: draft.id,
        executionId: String(coordinated.value.execution.id || ''),
        details: { actionType: tool.name, coordination: coordinated.coordination }
      })
      return {
        draftStatus: coordinated.value.draftStatus,
        execution: { ...coordinated.value.execution, replayed: true }
      }
    }

    return {
      draftStatus: coordinated.value.draftStatus,
      execution: coordinated.value.execution
    }
  }

  private toPublicDraft(draft: AgentDraft): Record<string, unknown> {
    return {
      id: draft.id,
      app_id: draft.app_id,
      key_id: draft.key_id,
      action_type: draft.action_type,
      payload: draft.payload,
      status: draft.status,
      requires_confirmation: draft.requires_confirmation,
      auto_execute_requested: draft.auto_execute_requested,
      justification: draft.justification,
      preflight_hash: draft.preflight_hash,
      preflight_state_witness_hash: draft.preflight_state_witness_hash,
      policy_snapshot: draft.policy_snapshot,
      created_at: draft.created_at,
      updated_at: draft.updated_at,
      confirmed_at: draft.confirmed_at,
      canceled_at: draft.canceled_at
    }
  }

  private toPublicIntent(certificate: IntentCertificate): Record<string, unknown> {
    return {
      id: certificate.id,
      requestHash: certificate.request_hash,
      intentClasses: certificate.intent_classes,
      confidence: certificate.confidence,
      reviewMode: certificate.review_mode,
      classifierSource: certificate.classifier_source,
      auditDigest: certificate.audit_digest,
      expiresAt: certificate.expires_at
    }
  }
}
