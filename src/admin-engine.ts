import { AuditService } from './audit.js'
import { ErrorCodes } from './error-codes.js'
import { OpenPortError } from './errors.js'
import { InMemoryStore } from './store.js'
import { AgentEngine } from './agent-engine.js'
import { AgentToolRegistry } from './tool-registry.js'
import type { AgentApp, AgentAutoExecute, AgentPolicy, AgentRequestContext, DomainAdapter } from './types.js'
import { ensureStringArray, generateToken, nowIso, sha256Hex } from './utils.js'

function parseAutoExecute(input: AgentAutoExecute | undefined, existing?: AgentAutoExecute): AgentAutoExecute {
  const base = existing || {}
  const writes = input?.writes || base.writes || {}
  const highRisk = input?.high_risk || base.high_risk || {}
  return {
    writes: {
      enabled: writes.enabled === true,
      expires_at: writes.expires_at || null,
      allowed_actions: writes.allowed_actions || null
    },
    high_risk: {
      enabled: highRisk.enabled === true,
      expires_at: highRisk.expires_at || null,
      require_preflight: highRisk.require_preflight !== false,
      require_idempotency: highRisk.require_idempotency !== false,
      max_export_rows: Number.isFinite(Number(highRisk.max_export_rows)) ? Math.min(Math.max(Math.trunc(Number(highRisk.max_export_rows)), 100), 5000) : 1000,
      allowed_actions: highRisk.allowed_actions || null
    }
  }
}

export class AdminEngine {
  constructor(
    private readonly store: InMemoryStore,
    private readonly domain: DomainAdapter,
    private readonly tools: AgentToolRegistry,
    private readonly agent: AgentEngine,
    private readonly audit: AuditService
  ) {}

  listApps(): { items: Array<AgentApp & { keys: unknown[] }> } {
    const apps = this.store.listApps().map((app) => ({
      ...app,
      keys: this.store.listKeysForApp(app.id).map((key) => ({
        id: key.id,
        name: key.name,
        token_prefix: key.token_prefix,
        last_used_at: key.last_used_at,
        expires_at: key.expires_at,
        revoked_at: key.revoked_at,
        created_at: key.created_at
      }))
    }))
    return { items: apps }
  }

  createApp(userId: string, dto: { scope: 'personal' | 'workspace'; name: string; description?: string; org_id?: string; user_id?: string; service_user_id?: string; scopes?: string[] }): Record<string, unknown> {
    const scope = dto.scope
    const name = dto.name?.trim()
    if (!name) throw new OpenPortError(400, ErrorCodes.COMMON_VALIDATION, 'name required')

    const userIdForApp = scope === 'personal' ? (dto.user_id || userId) : null
    const serviceUserId = scope === 'workspace' ? (dto.service_user_id || `svc_${dto.org_id || 'workspace'}`) : null

    const app = this.store.saveApp({
      scope,
      name,
      description: dto.description?.trim() || null,
      user_id: userIdForApp,
      org_id: scope === 'workspace' ? (dto.org_id || null) : null,
      service_user_id: serviceUserId,
      scopes: ensureStringArray(dto.scopes, 60) || [],
      created_by: userId
    })

    const token = generateToken()
    const key = this.store.saveKey({
      app_id: app.id,
      name: 'Default key',
      token_prefix: token.slice(0, 12),
      token_hash: sha256Hex(token),
      created_by: userId
    })

    void this.audit.log({
      appId: app.id,
      keyId: key.id,
      actorUserId: serviceUserId || userIdForApp || userId,
      performedByUserId: userId,
      action: 'agent_app.create',
      status: 'success',
      details: { scope: app.scope, orgId: app.org_id, name: app.name, scopes: app.scopes }
    })

    return {
      app,
      key: {
        id: key.id,
        name: key.name,
        token_prefix: key.token_prefix,
        created_at: key.created_at
      },
      token
    }
  }

  createKey(userId: string, appId: string, dto: { name?: string; expiresAt?: string | null }): Record<string, unknown> {
    const app = this.store.getApp(appId)
    if (!app || app.status !== 'active') {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Agent app not found')
    }

    const token = generateToken()
    const key = this.store.saveKey({
      app_id: app.id,
      name: dto.name?.trim() || 'New key',
      token_prefix: token.slice(0, 12),
      token_hash: sha256Hex(token),
      expires_at: dto.expiresAt || null,
      created_by: userId
    })

    void this.audit.log({
      appId: app.id,
      keyId: key.id,
      actorUserId: app.service_user_id || app.user_id || userId,
      performedByUserId: userId,
      action: 'agent_key.create',
      status: 'success',
      details: { keyId: key.id }
    })

    return {
      key: {
        id: key.id,
        name: key.name,
        token_prefix: key.token_prefix,
        created_at: key.created_at,
        expires_at: key.expires_at
      },
      token
    }
  }

  revokeApp(userId: string, appId: string): Record<string, unknown> {
    const app = this.store.getApp(appId)
    if (!app) throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Agent app not found')

    const updated = this.store.saveApp({
      id: app.id,
      scope: app.scope,
      name: app.name,
      description: app.description,
      user_id: app.user_id,
      org_id: app.org_id,
      service_user_id: app.service_user_id,
      scopes: app.scopes,
      policy: app.policy,
      auto_execute: app.auto_execute,
      created_by: app.created_by,
      status: 'revoked'
    })

    for (const key of this.store.listKeysForApp(app.id)) {
      this.store.updateKey(key.id, { revoked_at: nowIso() })
    }

    void this.audit.log({
      appId: app.id,
      actorUserId: app.service_user_id || app.user_id || userId,
      performedByUserId: userId,
      action: 'agent_app.revoke',
      status: 'success'
    })

    return { ok: true, app: updated }
  }

  revokeKey(userId: string, keyId: string): Record<string, unknown> {
    const key = this.store.keys.get(keyId)
    if (!key) throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Agent key not found')

    const updated = this.store.updateKey(keyId, { revoked_at: nowIso() })
    if (!updated) throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Agent key not found')

    const app = this.store.getApp(updated.app_id)

    void this.audit.log({
      appId: updated.app_id,
      keyId: updated.id,
      actorUserId: app?.service_user_id || app?.user_id || userId,
      performedByUserId: userId,
      action: 'agent_key.revoke',
      status: 'success'
    })

    return { ok: true, key: updated }
  }

  updatePolicy(userId: string, appId: string, policy: AgentPolicy): Record<string, unknown> {
    const app = this.store.getApp(appId)
    if (!app) throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Agent app not found')

    const updated = this.store.saveApp({
      id: app.id,
      scope: app.scope,
      name: app.name,
      description: app.description,
      user_id: app.user_id,
      org_id: app.org_id,
      service_user_id: app.service_user_id,
      scopes: app.scopes,
      policy,
      auto_execute: app.auto_execute,
      created_by: app.created_by,
      status: app.status
    })

    void this.audit.log({
      appId: app.id,
      actorUserId: app.service_user_id || app.user_id || userId,
      performedByUserId: userId,
      action: 'agent_app.policy.update',
      status: 'success',
      details: { policy }
    })

    return { ok: true, policy: updated.policy }
  }

  updateAutoExecute(userId: string, appId: string, autoExecute: AgentAutoExecute): Record<string, unknown> {
    const app = this.store.getApp(appId)
    if (!app) throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Agent app not found')

    const normalized = parseAutoExecute(autoExecute, app.auto_execute)
    const updated = this.store.saveApp({
      id: app.id,
      scope: app.scope,
      name: app.name,
      description: app.description,
      user_id: app.user_id,
      org_id: app.org_id,
      service_user_id: app.service_user_id,
      scopes: app.scopes,
      policy: app.policy,
      auto_execute: normalized,
      created_by: app.created_by,
      status: app.status
    })

    void this.audit.log({
      appId: app.id,
      actorUserId: app.service_user_id || app.user_id || userId,
      performedByUserId: userId,
      action: 'agent_app.auto_execute.update',
      status: 'success',
      details: { auto_execute: normalized }
    })

    return { ok: true, auto_execute: updated.auto_execute }
  }

  listAppTools(appId: string): Record<string, unknown> {
    const app = this.store.getApp(appId)
    if (!app) throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Agent app not found')

    const ctx: AgentRequestContext = {
      app,
      key: {
        id: 'admin',
        app_id: app.id,
        name: 'admin',
        token_prefix: 'admin',
        token_hash: 'admin',
        last_used_at: null,
        expires_at: null,
        revoked_at: null,
        created_by: null,
        created_at: nowIso()
      },
      actorUserId: app.service_user_id || app.user_id || app.created_by || 'admin',
      ip: null,
      userAgent: null
    }

    return {
      items: this.tools.listActionTools(ctx).map((tool) => ({
        name: tool.name,
        description: tool.description,
        risk: tool.risk,
        requiredScopes: tool.requiredScopes,
        requiresConfirmation: tool.requiresConfirmation,
        http: tool.http || null
      }))
    }
  }

  listDrafts(query?: { appId?: string; status?: 'draft' | 'confirmed' | 'canceled' | 'failed' }): Record<string, unknown> {
    const rows = this.store.listDrafts({ appId: query?.appId, status: query?.status })
    return {
      items: rows.map((row) => ({
        id: row.id,
        app_id: row.app_id,
        action_type: row.action_type,
        status: row.status,
        requires_confirmation: row.requires_confirmation,
        auto_execute_requested: row.auto_execute_requested,
        created_at: row.created_at,
        updated_at: row.updated_at,
        confirmed_at: row.confirmed_at,
        canceled_at: row.canceled_at,
        execution: this.store.getLatestExecutionForDraft(row.id)
      }))
    }
  }

  getDraft(draftId: string): Record<string, unknown> {
    const draft = this.store.getDraft(draftId)
    if (!draft) throw new OpenPortError(404, ErrorCodes.AGENT_DRAFT_NOT_FOUND, 'Draft not found')

    return {
      draft,
      execution: this.store.getLatestExecutionForDraft(draft.id)
    }
  }

  async approveDraft(userId: string, draftId: string, note?: string): Promise<Record<string, unknown>> {
    const draft = this.store.getDraft(draftId)
    if (!draft) throw new OpenPortError(404, ErrorCodes.AGENT_DRAFT_NOT_FOUND, 'Draft not found')
    if (draft.status !== 'draft') {
      throw new OpenPortError(400, ErrorCodes.AGENT_DRAFT_ALREADY_FINAL, 'Draft is not pending')
    }

    const app = this.store.getApp(draft.app_id)
    const key = draft.key_id ? this.store.keys.get(draft.key_id) : null
    if (!app || !key) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Agent app or key missing')
    }

    this.store.updateDraft(draft.id, {
      status: 'confirmed',
      confirmed_by_user_id: userId,
      confirmed_at: nowIso()
    })

    const ctx: AgentRequestContext = {
      app,
      key,
      actorUserId: app.service_user_id || app.user_id || userId,
      ip: null,
      userAgent: null
    }

    const result = await this.agent.executeDraft(ctx, draft.id, { confirmedByUserId: userId })

    void this.audit.log({
      appId: app.id,
      keyId: key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: userId,
      action: 'agent.draft.approve',
      status: 'success',
      draftId,
      details: { note: note || null }
    })

    return result
  }

  rejectDraft(userId: string, draftId: string, note?: string): Record<string, unknown> {
    const draft = this.store.getDraft(draftId)
    if (!draft) throw new OpenPortError(404, ErrorCodes.AGENT_DRAFT_NOT_FOUND, 'Draft not found')
    if (draft.status !== 'draft') {
      throw new OpenPortError(400, ErrorCodes.AGENT_DRAFT_ALREADY_FINAL, 'Draft is not pending')
    }

    this.store.updateDraft(draft.id, {
      status: 'canceled',
      canceled_at: nowIso()
    })

    void this.audit.log({
      appId: draft.app_id,
      keyId: draft.key_id,
      actorUserId: draft.actor_user_id,
      performedByUserId: userId,
      action: 'agent.draft.reject',
      status: 'success',
      draftId,
      details: { note: note || null }
    })

    return { ok: true, draft: this.store.getDraft(draft.id) }
  }

  listAudit(): Record<string, unknown> {
    return { items: this.audit.list() }
  }
}
