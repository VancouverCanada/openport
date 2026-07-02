import type { AgentApp, AgentAutoExecute, AgentDraft, AgentExecution, AgentKey, AgentPolicy, ContextRiskSnapshot, DraftStatus, IntentCertificate, StepUpSession, StepUpToken } from './types.js'
import { isExpired, nowIso, randomId } from './utils.js'

type PreflightRecord = {
  id: string
  app_id: string
  key_id: string
  actor_user_id: string
  action_type: string
  payload: Record<string, unknown>
  impact_hash: string
  state_witness: Record<string, unknown> | null
  state_witness_hash: string | null
  created_at: string
  expires_at: string
}

export class InMemoryStore {
  readonly apps = new Map<string, AgentApp>()
  readonly keys = new Map<string, AgentKey>()
  readonly keysByHash = new Map<string, AgentKey>()
  readonly drafts = new Map<string, AgentDraft>()
  readonly executions = new Map<string, AgentExecution>()
  readonly stepUpSessions = new Map<string, StepUpSession>()
  readonly stepUpTokens = new Map<string, StepUpToken>()
  readonly preflights = new Map<string, PreflightRecord>()
  readonly intentCertificates = new Map<string, IntentCertificate>()
  readonly contextRiskSnapshots = new Map<string, ContextRiskSnapshot>()

  private readonly preflightTtlMs = 10 * 60 * 1000
  private readonly intentTtlMs = 10 * 60 * 1000
  private readonly contextRiskTtlMs = 10 * 60 * 1000
  private readonly currentContextRiskBySession = new Map<string, string>()

  listApps(): AgentApp[] {
    return [...this.apps.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }

  getApp(appId: string): AgentApp | null {
    return this.apps.get(appId) || null
  }

  deleteApp(appId: string): boolean {
    const existed = this.apps.delete(appId)
    if (!existed) return false

    for (const [keyId, key] of this.keys.entries()) {
      if (key.app_id !== appId) continue
      this.keys.delete(keyId)
      this.keysByHash.delete(key.token_hash)
    }

    for (const [draftId, draft] of this.drafts.entries()) {
      if (draft.app_id !== appId) continue
      this.drafts.delete(draftId)
      for (const [execId, execution] of this.executions.entries()) {
        if (execution.draft_id === draftId) this.executions.delete(execId)
      }
    }

    return true
  }

  saveApp(input: {
    id?: string
    scope: AgentApp['scope']
    name: string
    description?: string | null
    user_id?: string | null
    org_id?: string | null
    service_user_id?: string | null
    scopes?: string[]
    policy?: AgentPolicy
    auto_execute?: AgentAutoExecute
    created_by?: string | null
    status?: AgentApp['status']
  }): AgentApp {
    const now = nowIso()
    const existing = input.id ? this.apps.get(input.id) : null
    const app: AgentApp = {
      id: existing?.id || input.id || randomId('app'),
      scope: input.scope,
      status: input.status || existing?.status || 'active',
      name: input.name,
      description: input.description || null,
      user_id: input.user_id || null,
      org_id: input.org_id || null,
      service_user_id: input.service_user_id || null,
      scopes: input.scopes || existing?.scopes || [],
      policy: input.policy || existing?.policy || {},
      auto_execute: input.auto_execute || existing?.auto_execute || {},
      created_by: input.created_by || existing?.created_by || null,
      created_at: existing?.created_at || now,
      updated_at: now
    }
    this.apps.set(app.id, app)
    return app
  }

  saveKey(input: {
    app_id: string
    name: string
    token_prefix: string
    token_hash: string
    created_by?: string | null
    expires_at?: string | null
  }): AgentKey {
    const key: AgentKey = {
      id: randomId('key'),
      app_id: input.app_id,
      name: input.name,
      token_prefix: input.token_prefix,
      token_hash: input.token_hash,
      last_used_at: null,
      expires_at: input.expires_at || null,
      revoked_at: null,
      created_by: input.created_by || null,
      created_at: nowIso()
    }
    this.keys.set(key.id, key)
    this.keysByHash.set(key.token_hash, key)
    return key
  }

  touchKey(keyId: string): void {
    const key = this.keys.get(keyId)
    if (!key) return
    key.last_used_at = nowIso()
    this.keys.set(key.id, key)
    this.keysByHash.set(key.token_hash, key)
  }

  updateKey(keyId: string, patch: Partial<AgentKey>): AgentKey | null {
    const key = this.keys.get(keyId)
    if (!key) return null
    const next = { ...key, ...patch }
    this.keys.set(keyId, next)
    this.keysByHash.set(next.token_hash, next)
    return next
  }

  findKeyByHash(hash: string): AgentKey | null {
    return this.keysByHash.get(hash) || null
  }

  listKeysForApp(appId: string): AgentKey[] {
    return [...this.keys.values()].filter((k) => k.app_id === appId).sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  saveDraft(input: Omit<AgentDraft, 'id' | 'created_at' | 'updated_at'> & { id?: string }): AgentDraft {
    const now = nowIso()
    const draft: AgentDraft = {
      ...input,
      id: input.id || randomId('drf'),
      created_at: now,
      updated_at: now
    }
    this.drafts.set(draft.id, draft)
    return draft
  }

  savePreflight(input: Omit<PreflightRecord, 'id' | 'created_at' | 'expires_at'> & { ttl_ms?: number }): PreflightRecord {
    const now = Date.now()
    const ttl = Number.isFinite(Number(input.ttl_ms)) ? Math.max(10_000, Math.trunc(Number(input.ttl_ms))) : this.preflightTtlMs
    const record: PreflightRecord = {
      id: randomId('pfl'),
      app_id: input.app_id,
      key_id: input.key_id,
      actor_user_id: input.actor_user_id,
      action_type: input.action_type,
      payload: input.payload,
      impact_hash: input.impact_hash,
      state_witness: input.state_witness || null,
      state_witness_hash: input.state_witness_hash || null,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttl).toISOString()
    }
    this.preflights.set(record.id, record)
    return record
  }

  getPreflight(preflightId: string): PreflightRecord | null {
    const record = this.preflights.get(preflightId) || null
    if (!record) return null
    if (isExpired(record.expires_at)) {
      this.preflights.delete(preflightId)
      return null
    }
    return record
  }

  saveIntentCertificate(input: Omit<IntentCertificate, 'id' | 'created_at' | 'expires_at' | 'revoked_at'> & { id?: string; ttl_ms?: number; revoked_at?: string | null }): IntentCertificate {
    const now = Date.now()
    const ttl = Number.isFinite(Number(input.ttl_ms)) ? Math.max(10_000, Math.trunc(Number(input.ttl_ms))) : this.intentTtlMs
    const certificate: IntentCertificate = {
      id: input.id || randomId('int'),
      app_id: input.app_id,
      key_id: input.key_id,
      actor_user_id: input.actor_user_id,
      request_hash: input.request_hash,
      request_excerpt: input.request_excerpt,
      intent_classes: input.intent_classes,
      resource_bounds: input.resource_bounds,
      effect_bounds: input.effect_bounds,
      confidence: input.confidence,
      review_mode: input.review_mode,
      classifier_source: input.classifier_source,
      audit_digest: input.audit_digest,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttl).toISOString(),
      revoked_at: input.revoked_at || null
    }
    this.intentCertificates.set(certificate.id, certificate)
    return certificate
  }

  getIntentCertificate(certificateId: string): IntentCertificate | null {
    const record = this.intentCertificates.get(certificateId) || null
    if (!record) return null
    if (record.revoked_at || isExpired(record.expires_at)) {
      this.intentCertificates.delete(certificateId)
      return null
    }
    return record
  }

  revokeIntentCertificate(certificateId: string, revokedAt = nowIso()): IntentCertificate | null {
    const record = this.intentCertificates.get(certificateId) || null
    if (!record) return null
    const next: IntentCertificate = {
      ...record,
      revoked_at: revokedAt
    }
    this.intentCertificates.set(certificateId, next)
    return next
  }

  saveContextRiskSnapshot(input: Omit<ContextRiskSnapshot, 'snapshot_id' | 'created_at' | 'expires_at'> & { snapshot_id?: string; ttl_ms?: number; expires_at?: string | null }): ContextRiskSnapshot {
    const now = Date.now()
    const ttl = Number.isFinite(Number(input.ttl_ms)) ? Math.max(10_000, Math.trunc(Number(input.ttl_ms))) : this.contextRiskTtlMs
    const snapshot: ContextRiskSnapshot = {
      snapshot_id: input.snapshot_id || randomId('crs'),
      app_id: input.app_id,
      key_id: input.key_id,
      actor_user_id: input.actor_user_id,
      session_id: input.session_id,
      risk: input.risk,
      score: input.score,
      source_labels: input.source_labels,
      segment_hashes: input.segment_hashes,
      reasons: input.reasons,
      created_at: new Date(now).toISOString(),
      expires_at: input.expires_at === null ? null : input.expires_at || new Date(now + ttl).toISOString()
    }
    this.contextRiskSnapshots.set(snapshot.snapshot_id, snapshot)
    this.currentContextRiskBySession.set(this.contextRiskSessionKey(snapshot), snapshot.snapshot_id)
    return snapshot
  }

  getContextRiskSnapshot(snapshotId: string): ContextRiskSnapshot | null {
    const record = this.contextRiskSnapshots.get(snapshotId) || null
    if (!record) return null
    if (isExpired(record.expires_at)) {
      this.contextRiskSnapshots.delete(snapshotId)
      const key = this.contextRiskSessionKey(record)
      if (this.currentContextRiskBySession.get(key) === snapshotId) this.currentContextRiskBySession.delete(key)
      return null
    }
    return record
  }

  getCurrentContextRiskSnapshot(input: { app_id: string; key_id: string; actor_user_id: string; session_id: string }): ContextRiskSnapshot | null {
    const snapshotId = this.currentContextRiskBySession.get(this.contextRiskSessionKey(input))
    return snapshotId ? this.getContextRiskSnapshot(snapshotId) : null
  }

  private contextRiskSessionKey(input: { app_id: string; key_id: string; actor_user_id: string; session_id: string }): string {
    return `${input.app_id}:${input.key_id}:${input.actor_user_id}:${input.session_id}`
  }

  updateDraft(draftId: string, patch: Partial<AgentDraft>): AgentDraft | null {
    const existing = this.drafts.get(draftId)
    if (!existing) return null
    const next: AgentDraft = {
      ...existing,
      ...patch,
      updated_at: nowIso()
    }
    this.drafts.set(draftId, next)
    return next
  }

  getDraft(draftId: string): AgentDraft | null {
    return this.drafts.get(draftId) || null
  }

  listDrafts(filter?: { appId?: string; status?: DraftStatus }): AgentDraft[] {
    return [...this.drafts.values()]
      .filter((d) => (filter?.appId ? d.app_id === filter.appId : true))
      .filter((d) => (filter?.status ? d.status === filter.status : true))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }

  saveExecution(input: Omit<AgentExecution, 'id' | 'created_at'>): AgentExecution {
    const execution: AgentExecution = {
      ...input,
      id: randomId('exe'),
      created_at: nowIso()
    }
    this.executions.set(execution.id, execution)
    return execution
  }

  getLatestExecutionForDraft(draftId: string): AgentExecution | null {
    const rows = [...this.executions.values()]
      .filter((e) => e.draft_id === draftId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return rows[0] || null
  }

  findExecutionByIdempotency(appId: string, idempotencyKey: string): AgentExecution | null {
    const rows = [...this.executions.values()]
      .filter((e) => e.app_id === appId && e.idempotency_key === idempotencyKey)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return rows[0] || null
  }

  saveStepUpSession(input: { user_id: string; code: string; expires_at: string }): StepUpSession {
    const session: StepUpSession = {
      id: randomId('sus'),
      user_id: input.user_id,
      code: input.code,
      expires_at: input.expires_at,
      consumed_at: null
    }
    this.stepUpSessions.set(session.id, session)
    return session
  }

  getLatestStepUpSession(userId: string): StepUpSession | null {
    const rows = [...this.stepUpSessions.values()]
      .filter((s) => s.user_id === userId)
      .sort((a, b) => b.expires_at.localeCompare(a.expires_at))
    return rows[0] || null
  }

  updateStepUpSession(sessionId: string, patch: Partial<StepUpSession>): StepUpSession | null {
    const existing = this.stepUpSessions.get(sessionId)
    if (!existing) return null
    const next = { ...existing, ...patch }
    this.stepUpSessions.set(sessionId, next)
    return next
  }

  saveStepUpToken(input: { user_id: string; expires_at: string }): StepUpToken {
    const token: StepUpToken = {
      id: randomId('sut'),
      user_id: input.user_id,
      expires_at: input.expires_at
    }
    this.stepUpTokens.set(token.id, token)
    return token
  }

  getStepUpToken(tokenId: string): StepUpToken | null {
    return this.stepUpTokens.get(tokenId) || null
  }

  sweepExpired(): {
    removedPreflights: number
    removedIntentCertificates: number
    removedContextRiskSnapshots: number
    removedStepUpSessions: number
    removedStepUpTokens: number
  } {
    let removedPreflights = 0
    let removedIntentCertificates = 0
    let removedContextRiskSnapshots = 0
    let removedStepUpSessions = 0
    let removedStepUpTokens = 0

    for (const [id, record] of this.preflights.entries()) {
      if (!isExpired(record.expires_at)) continue
      this.preflights.delete(id)
      removedPreflights += 1
    }

    for (const [id, record] of this.intentCertificates.entries()) {
      if (!record.revoked_at && !isExpired(record.expires_at)) continue
      this.intentCertificates.delete(id)
      removedIntentCertificates += 1
    }

    for (const [id, record] of this.contextRiskSnapshots.entries()) {
      if (!isExpired(record.expires_at)) continue
      this.contextRiskSnapshots.delete(id)
      const key = this.contextRiskSessionKey(record)
      if (this.currentContextRiskBySession.get(key) === id) this.currentContextRiskBySession.delete(key)
      removedContextRiskSnapshots += 1
    }

    for (const [id, record] of this.stepUpSessions.entries()) {
      if (!isExpired(record.expires_at)) continue
      this.stepUpSessions.delete(id)
      removedStepUpSessions += 1
    }

    for (const [id, record] of this.stepUpTokens.entries()) {
      if (!isExpired(record.expires_at)) continue
      this.stepUpTokens.delete(id)
      removedStepUpTokens += 1
    }

    return {
      removedPreflights,
      removedIntentCertificates,
      removedContextRiskSnapshots,
      removedStepUpSessions,
      removedStepUpTokens
    }
  }
}
