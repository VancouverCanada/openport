import { ErrorCodes } from './error-codes.js'
import { OpenMCPError } from './errors.js'
import { AuditService } from './audit.js'
import { ensureLedgerAllowed, ensureScope, ensureWorkspaceBoundary, getDataPolicy, resolveDateRange } from './policy.js'
import { InMemoryStore } from './store.js'
import { AgentToolRegistry } from './tool-registry.js'
import type { AgentDraft, AgentRequestContext, DomainAdapter } from './types.js'
import { isExpired, sha256Hex, stableStringify } from './utils.js'

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
    private readonly audit: AuditService
  ) {}

  manifest(ctx: AgentRequestContext): { app: Record<string, unknown>; tools: unknown[] } {
    return {
      app: {
        id: ctx.app.id,
        name: ctx.app.name,
        scope: ctx.app.scope,
        orgId: ctx.app.org_id
      },
      tools: this.tools.listManifestTools(ctx)
    }
  }

  async listLedgers(ctx: AgentRequestContext): Promise<{ items: unknown[] }> {
    ensureScope(ctx, ['ledger.read'])
    const ledgers = await this.domain.listLedgers(ctx.actorUserId)

    const filtered = ledgers.filter((ledger) => {
      if (ctx.app.scope === 'workspace') {
        return ctx.app.org_id && ledger.organization_id === ctx.app.org_id
      }
      return true
    })

    const policy = getDataPolicy(ctx)
    const final = policy.allowedLedgerIds
      ? filtered.filter((ledger) => policy.allowedLedgerIds?.includes(ledger.id))
      : filtered

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.ledger.list',
      status: 'success',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: { resultCount: final.length }
    })

    return { items: final }
  }

  async listTransactions(ctx: AgentRequestContext, query: { ledgerId: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<Record<string, unknown>> {
    ensureScope(ctx, ['transaction.read'])
    const ledgerId = query.ledgerId?.trim()
    if (!ledgerId) {
      throw new OpenMCPError(400, ErrorCodes.AGENT_ACTION_INVALID, 'ledgerId required')
    }

    const ledgers = await this.domain.listLedgers(ctx.actorUserId)
    const ledger = ledgers.find((item) => item.id === ledgerId)
    if (!ledger) {
      throw new OpenMCPError(404, ErrorCodes.AGENT_NOT_FOUND, 'Ledger not found')
    }

    ensureWorkspaceBoundary(ctx, { ledgerOrgId: ledger.organization_id, orgId: null })
    ensureLedgerAllowed(ctx, ledgerId)

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
      return presented.item
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
      details: {
        ledgerId,
        startDate: range.startDate || null,
        endDate: range.endDate || null,
        page: result.page,
        pageSize: result.pageSize,
        resultCount: items.length,
        redactedFields: [...new Set(redactedFields)],
        policy: dataPolicy
      }
    })

    return {
      items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore
    }
  }

  async preflight(ctx: AgentRequestContext, input: { action: string; payload: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const tool = this.tools.getActionTool(input.action)
    if (!tool) {
      throw new OpenMCPError(400, ErrorCodes.AGENT_ACTION_UNKNOWN, 'Unknown action')
    }
    ensureScope(ctx, tool.requiredScopes)

    const impact = tool.computeImpact
      ? await tool.computeImpact(ctx, input.payload, { domain: this.domain })
      : { summary: tool.risk === 'high' ? 'High impact action' : 'Low impact action' }

    const impactHash = sha256Hex(stableStringify({ action: tool.name, payload: input.payload, impact }))
    const preflight = this.store.savePreflight({
      app_id: ctx.app.id,
      key_id: ctx.key.id,
      actor_user_id: ctx.actorUserId,
      action_type: tool.name,
      payload: input.payload,
      impact_hash: impactHash
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
      details: { actionType: tool.name, risk: tool.risk, impact }
    })

    return {
      action: tool.name,
      risk: tool.risk,
      requiresConfirmation: tool.requiresConfirmation,
      impact,
      impactHash,
      preflightId: preflight.id
    }
  }

  async createAction(ctx: AgentRequestContext, input: { action: string; payload?: Record<string, unknown>; preflightId?: string; execute?: boolean; forceDraft?: boolean; requestId?: string; idempotencyKey?: string; justification?: string; preflightHash?: string }): Promise<Record<string, unknown>> {
    let actionName = input.action
    let payload = input.payload
    let preflightHash = input.preflightHash

    if (input.preflightId?.trim()) {
      const record = this.store.getPreflight(input.preflightId.trim())
      if (!record || record.app_id !== ctx.app.id || record.key_id !== ctx.key.id || record.actor_user_id !== ctx.actorUserId) {
        throw new OpenMCPError(400, ErrorCodes.AGENT_PREFLIGHT_NOT_FOUND, 'Preflight not found')
      }
      if (record.action_type !== actionName) {
        throw new OpenMCPError(400, ErrorCodes.AGENT_PREFLIGHT_MISMATCH, 'Preflight mismatch')
      }
      if (payload === undefined) payload = record.payload
      if (!preflightHash?.trim()) preflightHash = record.impact_hash
    }

    if (!payload) {
      throw new OpenMCPError(400, ErrorCodes.AGENT_ACTION_INVALID, 'payload required')
    }

    const tool = this.tools.getActionTool(actionName)
    if (!tool) {
      throw new OpenMCPError(400, ErrorCodes.AGENT_ACTION_UNKNOWN, 'Unknown action')
    }
    ensureScope(ctx, tool.requiredScopes)

    const auto = normalizeAutoExecute(ctx.app.auto_execute)
    const wantsExecute = input.execute === true && input.forceDraft !== true

    if (wantsExecute && input.idempotencyKey) {
      const existing = this.store.findExecutionByIdempotency(ctx.app.id, input.idempotencyKey)
      if (existing) {
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

    const impact = tool.risk === 'high'
      ? (tool.computeImpact ? await tool.computeImpact(ctx, payload, { domain: this.domain }) : { summary: 'High impact action' })
      : null
    const computedPreflightHash = impact
      ? sha256Hex(stableStringify({ action: tool.name, payload, impact }))
      : null

    let canAutoExecute = false
    let autoExecuteDeniedCode: string | null = null

    if (wantsExecute) {
      if (tool.risk === 'high') {
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

    const draft = this.store.saveDraft({
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
      policy_snapshot: {
        requiredScopes: tool.requiredScopes,
        risk: tool.risk,
        auto_execute: auto
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
      details: {
        actionType: tool.name,
        risk: tool.risk,
        autoExecuteRequested: wantsExecute,
        autoExecuteDeniedCode
      }
    })

    if (!canAutoExecute) {
      return {
        status: 'draft',
        draft: this.toPublicDraft(draft),
        autoExecuteDeniedCode,
        review_path: '/agent-admin/v1/drafts'
      }
    }

    const execution = await this.executeDraft(ctx, draft.id, { confirmedByUserId: null })
    return {
      status: 'executed',
      draft: { id: draft.id, status: execution.draftStatus },
      execution: execution.execution
    }
  }

  async getDraft(ctx: AgentRequestContext, draftId: string): Promise<Record<string, unknown>> {
    const draft = this.store.getDraft(draftId)
    if (!draft || draft.app_id !== ctx.app.id) {
      throw new OpenMCPError(404, ErrorCodes.AGENT_DRAFT_NOT_FOUND, 'Draft not found')
    }

    const latestExecution = this.store.getLatestExecutionForDraft(draft.id)
    return {
      draft: this.toPublicDraft(draft),
      execution: latestExecution
    }
  }

  async executeDraft(ctx: AgentRequestContext, draftId: string, opts: { confirmedByUserId: string | null }): Promise<{ draftStatus: string; execution: Record<string, unknown> }> {
    const draft = this.store.getDraft(draftId)
    if (!draft || draft.app_id !== ctx.app.id) {
      throw new OpenMCPError(404, ErrorCodes.AGENT_DRAFT_NOT_FOUND, 'Draft not found')
    }

    if (draft.status === 'canceled') {
      throw new OpenMCPError(400, ErrorCodes.AGENT_DRAFT_ALREADY_FINAL, 'Draft was canceled')
    }

    const tool = this.tools.getActionTool(draft.action_type)
    if (!tool) {
      throw new OpenMCPError(400, ErrorCodes.AGENT_ACTION_UNKNOWN, 'Unknown action')
    }

    ensureScope(ctx, tool.requiredScopes)

    if (draft.idempotency_key) {
      const replay = this.store.findExecutionByIdempotency(ctx.app.id, draft.idempotency_key)
      if (replay) {
        return {
          draftStatus: draft.status,
          execution: {
            ...replay,
            replayed: true
          }
        }
      }
    }

    try {
      const result = await tool.execute(ctx, draft.payload, { domain: this.domain }, { confirmedByUserId: opts.confirmedByUserId })
      const execution = this.store.saveExecution({
        draft_id: draft.id,
        app_id: draft.app_id,
        idempotency_key: draft.idempotency_key,
        status: 'success',
        result,
        error: null
      })

      this.store.updateDraft(draft.id, {
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
        details: { actionType: tool.name }
      })

      return {
        draftStatus: 'confirmed',
        execution
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed'
      const execution = this.store.saveExecution({
        draft_id: draft.id,
        app_id: draft.app_id,
        idempotency_key: draft.idempotency_key,
        status: 'failed',
        result: null,
        error: message
      })

      this.store.updateDraft(draft.id, { status: 'failed' })

      await this.audit.log({
        appId: ctx.app.id,
        keyId: ctx.key.id,
        actorUserId: ctx.actorUserId,
        performedByUserId: opts.confirmedByUserId || ctx.actorUserId,
        action: 'agent.action.execute',
        status: 'failed',
        code: message,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        draftId: draft.id,
        executionId: execution.id,
        details: { actionType: tool.name }
      })

      throw error
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
      created_at: draft.created_at,
      updated_at: draft.updated_at,
      confirmed_at: draft.confirmed_at,
      canceled_at: draft.canceled_at
    }
  }
}
