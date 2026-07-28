import { ErrorCodes } from '../error-codes.js'
import { OpenPortError } from '../errors.js'
import { randomId, sha256JcsHex } from '../utils.js'

type StatementResult = { changes: number | bigint }
type SqliteStatement = {
  get: (...values: unknown[]) => Record<string, unknown> | undefined
  all: (...values: unknown[]) => Record<string, unknown>[]
  run: (...values: unknown[]) => StatementResult
}
type SqliteDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  close: () => void
}

export type DurableActionStatus =
  | 'pending'
  | 'in_progress'
  | 'succeeded'
  | 'compensation_pending'
  | 'compensating'
  | 'compensated'
  | 'manual_review'

export type DurableActionFaultPoint =
  | 'after_submit_before_commit'
  | 'after_submit_commit_before_return'
  | 'after_action_claim_before_commit'
  | 'after_action_complete_before_commit'
  | 'after_action_complete_commit_before_return'
  | 'after_compensation_request_before_commit'
  | 'after_compensation_claim_before_commit'
  | 'after_compensation_complete_before_commit'
  | 'after_compensation_complete_commit_before_return'

export type SqliteDurableActionStoreOptions = {
  initialize?: boolean
  faultInjector?: (point: DurableActionFaultPoint) => void
}

export type DurableActionSubmission = {
  scopeKey: string
  requestFingerprint: string
  actionType: string
  opaqueEffectEnvelope: string
  opaqueCompensationEnvelope?: string | null
  nowMs?: number
}

export type DurableActionObligation = {
  id: string
  scopeKeyDigest: string
  requestFingerprint: string
  actionType: string
  effectId: string
  compensationId: string
  opaqueEffectEnvelope: string
  effectEnvelopeDigest: string
  opaqueCompensationEnvelope: string | null
  compensationEnvelopeDigest: string | null
  status: DurableActionStatus
  actionAttemptCount: number
  compensationAttemptCount: number
  actionClaimExpiresAtMs: number | null
  compensationClaimExpiresAtMs: number | null
  opaqueResultEnvelope: string | null
  opaqueCompensationResultEnvelope: string | null
  lastErrorCode: string | null
  createdAtMs: number
  updatedAtMs: number
  completedAtMs: number | null
  compensatedAtMs: number | null
}

export type DurableActionClaim = {
  obligation: DurableActionObligation
  claimToken: string
  reclaimed: boolean
}

export type DurableActionTransition = {
  sequence: number
  obligationId: string
  eventType: string
  fromStatus: DurableActionStatus | null
  toStatus: DurableActionStatus
  ownerDigest: string | null
  detailDigest: string
  previousEventHash: string | null
  eventHash: string
  createdAtMs: number
}

export type DurableActionFailureDisposition = 'retry' | 'manual_review' | 'compensate'
export type DurableCompensationFailureDisposition = 'retry' | 'manual_review'

type ObligationRow = Record<string, unknown>

const MAX_SCOPE_KEY_LENGTH = 2048
const MAX_ACTION_TYPE_LENGTH = 200
const MAX_ENVELOPE_LENGTH = 1024 * 1024
const MAX_ERROR_CODE_LENGTH = 200
const MAX_CLAIM_TTL_MS = 60 * 60 * 1000

function requiredText(value: string, name: string, maxLength: number): string {
  const normalized = value.trim()
  if (!normalized) throw new TypeError(name + ' is required')
  if (normalized.length > maxLength) throw new TypeError(name + ' exceeds maximum length')
  return normalized
}

function opaqueEnvelope(value: string, name: string): string {
  if (!value) throw new TypeError(name + ' is required')
  if (value.length > MAX_ENVELOPE_LENGTH) throw new TypeError(name + ' exceeds maximum length')
  return value
}

function optionalOpaqueEnvelope(value: string | null | undefined, name: string): string | null {
  if (value === undefined || value === null) return null
  return opaqueEnvelope(value, name)
}

function safeNowMs(value?: number): number {
  const normalized = value === undefined ? Date.now() : value
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new TypeError('nowMs must be a nonnegative safe integer')
  }
  return normalized
}

function boundedClaimTtlMs(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CLAIM_TTL_MS) {
    throw new TypeError('claimTtlMs must be a positive safe integer no greater than one hour')
  }
  return value
}

function asNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

function asObligation(row: ObligationRow | undefined): DurableActionObligation | null {
  if (!row) return null
  return {
    id: String(row.id),
    scopeKeyDigest: String(row.scope_key_digest),
    requestFingerprint: String(row.request_fingerprint),
    actionType: String(row.action_type),
    effectId: String(row.effect_id),
    compensationId: String(row.compensation_id),
    opaqueEffectEnvelope: String(row.opaque_effect_envelope),
    effectEnvelopeDigest: String(row.effect_envelope_digest),
    opaqueCompensationEnvelope: row.opaque_compensation_envelope === null
      ? null
      : String(row.opaque_compensation_envelope),
    compensationEnvelopeDigest: row.compensation_envelope_digest === null
      ? null
      : String(row.compensation_envelope_digest),
    status: String(row.status) as DurableActionStatus,
    actionAttemptCount: Number(row.action_attempt_count),
    compensationAttemptCount: Number(row.compensation_attempt_count),
    actionClaimExpiresAtMs: asNullableNumber(row.action_claim_expires_at_ms),
    compensationClaimExpiresAtMs: asNullableNumber(row.compensation_claim_expires_at_ms),
    opaqueResultEnvelope: row.opaque_result_envelope === null ? null : String(row.opaque_result_envelope),
    opaqueCompensationResultEnvelope: row.opaque_compensation_result_envelope === null
      ? null
      : String(row.opaque_compensation_result_envelope),
    lastErrorCode: row.last_error_code === null ? null : String(row.last_error_code),
    createdAtMs: Number(row.created_at_ms),
    updatedAtMs: Number(row.updated_at_ms),
    completedAtMs: asNullableNumber(row.completed_at_ms),
    compensatedAtMs: asNullableNumber(row.compensated_at_ms)
  }
}

function scopeDigest(scopeKey: string): string {
  return 'sha256:' + sha256JcsHex({ scopeKey })
}

function envelopeDigest(envelope: string): string {
  return 'sha256:' + sha256JcsHex({ envelope })
}

function tokenDigest(token: string): string {
  return 'sha256:' + sha256JcsHex({ token })
}

/**
 * Single-host durable action-obligation state machine.
 *
 * The store intentionally does not execute domain handlers. A worker must use
 * the stable effect/compensation identifiers with an idempotent receiver. This
 * permits crash recovery after an ambiguous delivery, but it does not provide
 * general exactly-once execution, distributed consensus, or receiver atomicity.
 * Opaque envelopes may still contain sensitive content; callers are responsible
 * for minimization and encryption appropriate to their deployment.
 */
export class SqliteDurableActionStore {
  private constructor(
    private readonly db: SqliteDatabase,
    private readonly faultInjector?: (point: DurableActionFaultPoint) => void
  ) {}

  static async open(
    filePath: string,
    options: SqliteDurableActionStoreOptions = {}
  ): Promise<SqliteDurableActionStore> {
    const sqlite = await import('node:sqlite')
    const db = new sqlite.DatabaseSync(filePath) as unknown as SqliteDatabase
    db.exec('PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;')
    if (options.initialize !== false) {
      db.exec('PRAGMA journal_mode=WAL;')
      db.exec(
        'CREATE TABLE IF NOT EXISTS durable_action_obligations (' +
        'id TEXT PRIMARY KEY, scope_key_digest TEXT NOT NULL UNIQUE, request_fingerprint TEXT NOT NULL, ' +
        'action_type TEXT NOT NULL, effect_id TEXT NOT NULL UNIQUE, compensation_id TEXT NOT NULL UNIQUE, ' +
        'opaque_effect_envelope TEXT NOT NULL, effect_envelope_digest TEXT NOT NULL, ' +
        'opaque_compensation_envelope TEXT, compensation_envelope_digest TEXT, ' +
        "status TEXT NOT NULL CHECK (status IN ('pending','in_progress','succeeded','compensation_pending','compensating','compensated','manual_review')), " +
        'action_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (action_attempt_count >= 0), ' +
        'compensation_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (compensation_attempt_count >= 0), ' +
        'action_claim_token_digest TEXT, action_claim_owner_digest TEXT, action_claim_expires_at_ms INTEGER, ' +
        'compensation_claim_token_digest TEXT, compensation_claim_owner_digest TEXT, compensation_claim_expires_at_ms INTEGER, ' +
        'opaque_result_envelope TEXT, opaque_compensation_result_envelope TEXT, last_error_code TEXT, ' +
        'created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL, completed_at_ms INTEGER, compensated_at_ms INTEGER);' +
        'CREATE TABLE IF NOT EXISTS durable_action_transitions (' +
        'sequence INTEGER PRIMARY KEY AUTOINCREMENT, obligation_id TEXT NOT NULL REFERENCES durable_action_obligations(id) ON DELETE CASCADE, ' +
        'event_type TEXT NOT NULL, from_status TEXT, to_status TEXT NOT NULL, owner_digest TEXT, detail_digest TEXT NOT NULL, ' +
        'previous_event_hash TEXT, event_hash TEXT NOT NULL UNIQUE, created_at_ms INTEGER NOT NULL);' +
        'CREATE INDEX IF NOT EXISTS durable_action_claimable ' +
        'ON durable_action_obligations(status, action_claim_expires_at_ms, created_at_ms);' +
        'CREATE INDEX IF NOT EXISTS durable_compensation_claimable ' +
        'ON durable_action_obligations(status, compensation_claim_expires_at_ms, created_at_ms);' +
        'CREATE INDEX IF NOT EXISTS durable_action_transition_order ' +
        'ON durable_action_transitions(obligation_id, sequence);'
      )
    }
    return new SqliteDurableActionStore(db, options.faultInjector)
  }

  submit(input: DurableActionSubmission): { obligation: DurableActionObligation; replayed: boolean } {
    const normalizedScopeKey = requiredText(input.scopeKey, 'scopeKey', MAX_SCOPE_KEY_LENGTH)
    const requestFingerprint = requiredText(input.requestFingerprint, 'requestFingerprint', 256)
    const actionType = requiredText(input.actionType, 'actionType', MAX_ACTION_TYPE_LENGTH)
    const effectEnvelope = opaqueEnvelope(input.opaqueEffectEnvelope, 'opaqueEffectEnvelope')
    const compensationEnvelope = optionalOpaqueEnvelope(
      input.opaqueCompensationEnvelope,
      'opaqueCompensationEnvelope'
    )
    const nowMs = safeNowMs(input.nowMs)
    const keyDigest = scopeDigest(normalizedScopeKey)
    const effectDigest = envelopeDigest(effectEnvelope)
    const compensationDigest = compensationEnvelope ? envelopeDigest(compensationEnvelope) : null

    this.db.exec('BEGIN IMMEDIATE')
    try {
      const existing = asObligation(this.db.prepare(
        'SELECT * FROM durable_action_obligations WHERE scope_key_digest = ?'
      ).get(keyDigest))
      if (existing) {
        const equivalent = existing.requestFingerprint === requestFingerprint &&
          existing.actionType === actionType &&
          existing.effectEnvelopeDigest === effectDigest &&
          existing.compensationEnvelopeDigest === compensationDigest
        if (!equivalent) {
          this.db.exec('ROLLBACK')
          throw new OpenPortError(
            409,
            ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH,
            'Durable action scope is already bound to a different request'
          )
        }
        this.db.exec('COMMIT')
        return { obligation: existing, replayed: true }
      }

      const id = 'aob_' + sha256JcsHex({ keyDigest, requestFingerprint }).slice(0, 24)
      const effectId = 'eff_' + sha256JcsHex({ id, phase: 'action' }).slice(0, 24)
      const compensationId = 'cmp_' + sha256JcsHex({ id, phase: 'compensation' }).slice(0, 24)
      this.db.prepare(
        'INSERT INTO durable_action_obligations (' +
        'id, scope_key_digest, request_fingerprint, action_type, effect_id, compensation_id, ' +
        'opaque_effect_envelope, effect_envelope_digest, opaque_compensation_envelope, compensation_envelope_digest, ' +
        'status, action_attempt_count, compensation_attempt_count, created_at_ms, updated_at_ms) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)'
      ).run(
        id,
        keyDigest,
        requestFingerprint,
        actionType,
        effectId,
        compensationId,
        effectEnvelope,
        effectDigest,
        compensationEnvelope,
        compensationDigest,
        'pending',
        nowMs,
        nowMs
      )
      this.appendTransition({
        obligationId: id,
        eventType: 'action.submitted',
        fromStatus: null,
        toStatus: 'pending',
        ownerDigest: null,
        detail: { requestFingerprint, actionType, effectDigest, compensationDigest },
        nowMs
      })
      this.faultInjector?.('after_submit_before_commit')
      this.db.exec('COMMIT')
      this.faultInjector?.('after_submit_commit_before_return')
      const obligation = this.getById(id)
      if (!obligation) throw new Error('durable action disappeared after commit')
      return { obligation, replayed: false }
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  claimNextAction(workerId: string, claimTtlMs: number, nowMsInput?: number): DurableActionClaim | null {
    return this.claimAvailable({ phase: 'action', workerId, claimTtlMs, nowMsInput })
  }

  claimNextCompensation(workerId: string, claimTtlMs: number, nowMsInput?: number): DurableActionClaim | null {
    return this.claimAvailable({ phase: 'compensation', workerId, claimTtlMs, nowMsInput })
  }

  claimAction(
    obligationId: string,
    workerId: string,
    claimTtlMs: number,
    nowMsInput?: number
  ): DurableActionClaim | null {
    return this.claimAvailable({ phase: 'action', obligationId, workerId, claimTtlMs, nowMsInput })
  }

  claimCompensation(
    obligationId: string,
    workerId: string,
    claimTtlMs: number,
    nowMsInput?: number
  ): DurableActionClaim | null {
    return this.claimAvailable({ phase: 'compensation', obligationId, workerId, claimTtlMs, nowMsInput })
  }

  completeAction(
    obligationId: string,
    claimToken: string,
    opaqueResultEnvelope: string,
    nowMsInput?: number
  ): DurableActionObligation {
    return this.completeClaim({
      phase: 'action',
      obligationId,
      claimToken,
      opaqueResultEnvelope,
      nowMsInput
    })
  }

  completeCompensation(
    obligationId: string,
    claimToken: string,
    opaqueResultEnvelope: string,
    nowMsInput?: number
  ): DurableActionObligation {
    return this.completeClaim({
      phase: 'compensation',
      obligationId,
      claimToken,
      opaqueResultEnvelope,
      nowMsInput
    })
  }

  failAction(
    obligationId: string,
    claimToken: string,
    errorCode: string,
    disposition: DurableActionFailureDisposition,
    options: { opaqueCompensationEnvelope?: string | null; nowMs?: number } = {}
  ): DurableActionObligation {
    const normalizedErrorCode = requiredText(errorCode, 'errorCode', MAX_ERROR_CODE_LENGTH)
    const nowMs = safeNowMs(options.nowMs)
    const suppliedCompensation = optionalOpaqueEnvelope(
      options.opaqueCompensationEnvelope,
      'opaqueCompensationEnvelope'
    )
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.requireClaim(obligationId, claimToken, 'action', nowMs)
      const compensationEnvelope = suppliedCompensation || current.opaqueCompensationEnvelope
      if (disposition === 'compensate' && !compensationEnvelope) {
        throw new TypeError('opaqueCompensationEnvelope is required for compensate disposition')
      }
      const nextStatus: DurableActionStatus = disposition === 'retry'
        ? 'pending'
        : disposition === 'compensate'
          ? 'compensation_pending'
          : 'manual_review'
      const compensationDigest = compensationEnvelope ? envelopeDigest(compensationEnvelope) : null
      const changed = this.db.prepare(
        'UPDATE durable_action_obligations SET status = ?, action_claim_token_digest = NULL, ' +
        'action_claim_owner_digest = NULL, action_claim_expires_at_ms = NULL, last_error_code = ?, ' +
        'opaque_compensation_envelope = ?, compensation_envelope_digest = ?, updated_at_ms = ? ' +
        'WHERE id = ? AND status = ? AND action_claim_token_digest = ?'
      ).run(
        nextStatus,
        normalizedErrorCode,
        compensationEnvelope,
        compensationDigest,
        nowMs,
        current.id,
        'in_progress',
        tokenDigest(claimToken)
      )
      if (Number(changed.changes) !== 1) this.staleClaim('action')
      this.appendTransition({
        obligationId: current.id,
        eventType: 'action.failed.' + disposition,
        fromStatus: 'in_progress',
        toStatus: nextStatus,
        ownerDigest: null,
        detail: { errorCode: normalizedErrorCode, compensationDigest },
        nowMs
      })
      this.db.exec('COMMIT')
      return this.requireById(current.id)
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  requestCompensation(
    obligationId: string,
    opaqueCompensationEnvelope: string,
    nowMsInput?: number
  ): DurableActionObligation {
    const envelope = opaqueEnvelope(opaqueCompensationEnvelope, 'opaqueCompensationEnvelope')
    const digest = envelopeDigest(envelope)
    const nowMs = safeNowMs(nowMsInput)
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.requireById(obligationId)
      if (current.status === 'compensation_pending' || current.status === 'compensating' || current.status === 'compensated') {
        if (current.compensationEnvelopeDigest !== digest) {
          throw new OpenPortError(
            409,
            ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH,
            'Compensation is already bound to a different envelope'
          )
        }
        this.db.exec('COMMIT')
        return current
      }
      if (current.status !== 'succeeded') {
        throw new OpenPortError(
          409,
          ErrorCodes.AGENT_PRECONDITION_FAILED,
          'Only a succeeded durable action can enter compensation'
        )
      }
      if (current.compensationEnvelopeDigest && current.compensationEnvelopeDigest !== digest) {
        throw new OpenPortError(
          409,
          ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH,
          'Compensation envelope differs from the submitted durable action binding'
        )
      }
      this.db.prepare(
        'UPDATE durable_action_obligations SET status = ?, opaque_compensation_envelope = ?, ' +
        'compensation_envelope_digest = ?, updated_at_ms = ? WHERE id = ? AND status = ?'
      ).run('compensation_pending', envelope, digest, nowMs, current.id, 'succeeded')
      this.appendTransition({
        obligationId: current.id,
        eventType: 'compensation.requested',
        fromStatus: 'succeeded',
        toStatus: 'compensation_pending',
        ownerDigest: null,
        detail: { compensationDigest: digest },
        nowMs
      })
      this.faultInjector?.('after_compensation_request_before_commit')
      this.db.exec('COMMIT')
      return this.requireById(current.id)
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  failCompensation(
    obligationId: string,
    claimToken: string,
    errorCode: string,
    disposition: DurableCompensationFailureDisposition,
    nowMsInput?: number
  ): DurableActionObligation {
    const normalizedErrorCode = requiredText(errorCode, 'errorCode', MAX_ERROR_CODE_LENGTH)
    const nowMs = safeNowMs(nowMsInput)
    const nextStatus: DurableActionStatus = disposition === 'retry' ? 'compensation_pending' : 'manual_review'
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.requireClaim(obligationId, claimToken, 'compensation', nowMs)
      const changed = this.db.prepare(
        'UPDATE durable_action_obligations SET status = ?, compensation_claim_token_digest = NULL, ' +
        'compensation_claim_owner_digest = NULL, compensation_claim_expires_at_ms = NULL, ' +
        'last_error_code = ?, updated_at_ms = ? ' +
        'WHERE id = ? AND status = ? AND compensation_claim_token_digest = ?'
      ).run(
        nextStatus,
        normalizedErrorCode,
        nowMs,
        current.id,
        'compensating',
        tokenDigest(claimToken)
      )
      if (Number(changed.changes) !== 1) this.staleClaim('compensation')
      this.appendTransition({
        obligationId: current.id,
        eventType: 'compensation.failed.' + disposition,
        fromStatus: 'compensating',
        toStatus: nextStatus,
        ownerDigest: null,
        detail: { errorCode: normalizedErrorCode },
        nowMs
      })
      this.db.exec('COMMIT')
      return this.requireById(current.id)
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  getById(obligationId: string): DurableActionObligation | null {
    return asObligation(this.db.prepare(
      'SELECT * FROM durable_action_obligations WHERE id = ?'
    ).get(obligationId))
  }

  findByScopeKey(scopeKeyInput: string): DurableActionObligation | null {
    const normalized = requiredText(scopeKeyInput, 'scopeKey', MAX_SCOPE_KEY_LENGTH)
    return asObligation(this.db.prepare(
      'SELECT * FROM durable_action_obligations WHERE scope_key_digest = ?'
    ).get(scopeDigest(normalized)))
  }

  listTransitions(obligationId: string): DurableActionTransition[] {
    return this.db.prepare(
      'SELECT * FROM durable_action_transitions WHERE obligation_id = ? ORDER BY sequence'
    ).all(obligationId).map((row) => ({
      sequence: Number(row.sequence),
      obligationId: String(row.obligation_id),
      eventType: String(row.event_type),
      fromStatus: row.from_status === null ? null : String(row.from_status) as DurableActionStatus,
      toStatus: String(row.to_status) as DurableActionStatus,
      ownerDigest: row.owner_digest === null ? null : String(row.owner_digest),
      detailDigest: String(row.detail_digest),
      previousEventHash: row.previous_event_hash === null ? null : String(row.previous_event_hash),
      eventHash: String(row.event_hash),
      createdAtMs: Number(row.created_at_ms)
    }))
  }

  verifyTransitionChain(obligationId: string): boolean {
    const rows = this.listTransitions(obligationId)
    let previousEventHash: string | null = null
    for (const row of rows) {
      if (row.previousEventHash !== previousEventHash) return false
      const expected = sha256JcsHex({
        obligationId: row.obligationId,
        eventType: row.eventType,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        ownerDigest: row.ownerDigest,
        detailDigest: row.detailDigest,
        previousEventHash,
        createdAtMs: row.createdAtMs
      })
      if (row.eventHash !== expected) return false
      previousEventHash = row.eventHash
    }
    return rows.length > 0
  }

  snapshot(): Record<DurableActionStatus, number> & { total: number; transitions: number } {
    const counts = this.db.prepare(
      'SELECT status, COUNT(*) AS total FROM durable_action_obligations GROUP BY status'
    ).all()
    const result: Record<DurableActionStatus, number> & { total: number; transitions: number } = {
      pending: 0,
      in_progress: 0,
      succeeded: 0,
      compensation_pending: 0,
      compensating: 0,
      compensated: 0,
      manual_review: 0,
      total: 0,
      transitions: Number(this.db.prepare(
        'SELECT COUNT(*) AS total FROM durable_action_transitions'
      ).get()?.total || 0)
    }
    for (const row of counts) {
      const status = String(row.status) as DurableActionStatus
      const count = Number(row.total)
      result[status] = count
      result.total += count
    }
    return result
  }

  close(): void {
    this.db.close()
  }

  private claimAvailable(input: {
    phase: 'action' | 'compensation'
    obligationId?: string
    workerId: string
    claimTtlMs: number
    nowMsInput?: number
  }): DurableActionClaim | null {
    const workerId = requiredText(input.workerId, 'workerId', 512)
    const ttl = boundedClaimTtlMs(input.claimTtlMs)
    const nowMs = safeNowMs(input.nowMsInput)
    const ownerDigest = 'sha256:' + sha256JcsHex({ workerId })
    const claimToken = randomId('claim')
    const claimTokenHash = tokenDigest(claimToken)
    const expiresAt = nowMs + ttl
    const isAction = input.phase === 'action'
    const pending = isAction ? 'pending' : 'compensation_pending'
    const active = isAction ? 'in_progress' : 'compensating'
    const expiryColumn = isAction ? 'action_claim_expires_at_ms' : 'compensation_claim_expires_at_ms'
    const tokenColumn = isAction ? 'action_claim_token_digest' : 'compensation_claim_token_digest'
    const ownerColumn = isAction ? 'action_claim_owner_digest' : 'compensation_claim_owner_digest'
    const attemptColumn = isAction ? 'action_attempt_count' : 'compensation_attempt_count'

    this.db.exec('BEGIN IMMEDIATE')
    try {
      const row = input.obligationId
        ? this.db.prepare(
          'SELECT * FROM durable_action_obligations WHERE id = ? AND ' +
          '(status = ? OR (status = ? AND ' + expiryColumn + ' <= ?))'
        ).get(requiredText(input.obligationId, 'obligationId', 200), pending, active, nowMs)
        : this.db.prepare(
          'SELECT * FROM durable_action_obligations WHERE status = ? OR ' +
          '(status = ? AND ' + expiryColumn + ' <= ?) ORDER BY created_at_ms, id LIMIT 1'
        ).get(pending, active, nowMs)
      const current = asObligation(row)
      if (!current) {
        this.db.exec('COMMIT')
        return null
      }
      const reclaimed = current.status === active
      const changed = this.db.prepare(
        'UPDATE durable_action_obligations SET status = ?, ' + tokenColumn + ' = ?, ' + ownerColumn + ' = ?, ' +
        expiryColumn + ' = ?, ' + attemptColumn + ' = ' + attemptColumn + ' + 1, updated_at_ms = ? ' +
        'WHERE id = ? AND (status = ? OR (status = ? AND ' + expiryColumn + ' <= ?))'
      ).run(
        active,
        claimTokenHash,
        ownerDigest,
        expiresAt,
        nowMs,
        current.id,
        pending,
        active,
        nowMs
      )
      if (Number(changed.changes) !== 1) throw new Error('durable action claim compare-and-swap failed')
      this.appendTransition({
        obligationId: current.id,
        eventType: input.phase + (reclaimed ? '.reclaimed' : '.claimed'),
        fromStatus: current.status,
        toStatus: active,
        ownerDigest,
        detail: { expiresAt },
        nowMs
      })
      this.faultInjector?.(isAction ? 'after_action_claim_before_commit' : 'after_compensation_claim_before_commit')
      this.db.exec('COMMIT')
      return {
        obligation: this.requireById(current.id),
        claimToken,
        reclaimed
      }
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  private completeClaim(input: {
    phase: 'action' | 'compensation'
    obligationId: string
    claimToken: string
    opaqueResultEnvelope: string
    nowMsInput?: number
  }): DurableActionObligation {
    const resultEnvelope = opaqueEnvelope(input.opaqueResultEnvelope, 'opaqueResultEnvelope')
    const nowMs = safeNowMs(input.nowMsInput)
    const isAction = input.phase === 'action'
    const active: DurableActionStatus = isAction ? 'in_progress' : 'compensating'
    const terminal: DurableActionStatus = isAction ? 'succeeded' : 'compensated'
    const tokenColumn = isAction ? 'action_claim_token_digest' : 'compensation_claim_token_digest'
    const ownerColumn = isAction ? 'action_claim_owner_digest' : 'compensation_claim_owner_digest'
    const expiryColumn = isAction ? 'action_claim_expires_at_ms' : 'compensation_claim_expires_at_ms'
    const resultColumn = isAction ? 'opaque_result_envelope' : 'opaque_compensation_result_envelope'
    const completedColumn = isAction ? 'completed_at_ms' : 'compensated_at_ms'

    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.requireClaim(input.obligationId, input.claimToken, input.phase, nowMs)
      const changed = this.db.prepare(
        'UPDATE durable_action_obligations SET status = ?, ' + tokenColumn + ' = NULL, ' +
        ownerColumn + ' = NULL, ' + expiryColumn + ' = NULL, ' + resultColumn + ' = ?, ' +
        completedColumn + ' = ?, last_error_code = NULL, updated_at_ms = ? ' +
        'WHERE id = ? AND status = ? AND ' + tokenColumn + ' = ?'
      ).run(
        terminal,
        resultEnvelope,
        nowMs,
        nowMs,
        current.id,
        active,
        tokenDigest(input.claimToken)
      )
      if (Number(changed.changes) !== 1) this.staleClaim(input.phase)
      this.appendTransition({
        obligationId: current.id,
        eventType: input.phase + '.completed',
        fromStatus: active,
        toStatus: terminal,
        ownerDigest: null,
        detail: { resultDigest: envelopeDigest(resultEnvelope) },
        nowMs
      })
      this.faultInjector?.(isAction
        ? 'after_action_complete_before_commit'
        : 'after_compensation_complete_before_commit')
      this.db.exec('COMMIT')
      this.faultInjector?.(isAction
        ? 'after_action_complete_commit_before_return'
        : 'after_compensation_complete_commit_before_return')
      return this.requireById(current.id)
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  private requireClaim(
    obligationId: string,
    claimToken: string,
    phase: 'action' | 'compensation',
    nowMs: number
  ): DurableActionObligation {
    const normalizedId = requiredText(obligationId, 'obligationId', 200)
    const normalizedToken = requiredText(claimToken, 'claimToken', 200)
    const row = this.db.prepare(
      'SELECT * FROM durable_action_obligations WHERE id = ?'
    ).get(normalizedId)
    const obligation = asObligation(row)
    if (!obligation) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Durable action obligation not found')
    }
    const tokenColumn = phase === 'action' ? 'action_claim_token_digest' : 'compensation_claim_token_digest'
    const active = phase === 'action' ? 'in_progress' : 'compensating'
    const expiresAt = phase === 'action'
      ? obligation.actionClaimExpiresAtMs
      : obligation.compensationClaimExpiresAtMs
    if (obligation.status !== active ||
      String(row?.[tokenColumn] || '') !== tokenDigest(normalizedToken) ||
      expiresAt === null ||
      expiresAt <= nowMs) {
      this.staleClaim(phase)
    }
    return obligation
  }

  private requireById(obligationId: string): DurableActionObligation {
    const obligation = this.getById(obligationId)
    if (!obligation) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Durable action obligation not found')
    }
    return obligation
  }

  private staleClaim(phase: 'action' | 'compensation'): never {
    throw new OpenPortError(
      409,
      ErrorCodes.AGENT_PRECONDITION_FAILED,
      'Durable ' + phase + ' claim is stale or no longer active',
      { reason: 'stale_' + phase + '_claim' }
    )
  }

  private appendTransition(input: {
    obligationId: string
    eventType: string
    fromStatus: DurableActionStatus | null
    toStatus: DurableActionStatus
    ownerDigest: string | null
    detail: Record<string, unknown>
    nowMs: number
  }): void {
    const previous = this.db.prepare(
      'SELECT event_hash FROM durable_action_transitions WHERE obligation_id = ? ORDER BY sequence DESC LIMIT 1'
    ).get(input.obligationId)
    const previousEventHash = previous ? String(previous.event_hash) : null
    const detailDigest = 'sha256:' + sha256JcsHex(input.detail)
    const eventHash = sha256JcsHex({
      obligationId: input.obligationId,
      eventType: input.eventType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      ownerDigest: input.ownerDigest,
      detailDigest,
      previousEventHash,
      createdAtMs: input.nowMs
    })
    this.db.prepare(
      'INSERT INTO durable_action_transitions (' +
      'obligation_id, event_type, from_status, to_status, owner_digest, detail_digest, ' +
      'previous_event_hash, event_hash, created_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      input.obligationId,
      input.eventType,
      input.fromStatus,
      input.toStatus,
      input.ownerDigest,
      detailDigest,
      previousEventHash,
      eventHash,
      input.nowMs
    )
  }

  private rollback(): void {
    try {
      this.db.exec('ROLLBACK')
    } catch {
      // Transaction may already have committed at an injected post-commit fault.
    }
  }
}
