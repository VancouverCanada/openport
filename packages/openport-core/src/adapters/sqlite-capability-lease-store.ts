import type {
  CapabilityLeaseConsumptionFailure,
  CapabilityLeaseConsumptionInput,
  CapabilityLeaseConsumptionResult,
  DurableCapabilityLeaseStateStore,
  PendingCapabilityLeaseAudit
} from '../capability-lease-store.js'
import type { AgentCapabilityLease } from '../types.js'
import { nowIso, randomId, sha256JcsHex } from '../utils.js'

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

export type SqliteCapabilityLeaseFaultPoint =
  | 'after_lease_update_before_outbox'
  | 'after_outbox_before_commit'
  | 'after_commit_before_return'
  | 'before_mark_delivered'
  | 'after_mark_before_commit'

export type SqliteCapabilityLeaseStoreOptions = {
  initialize?: boolean
  faultInjector?: (point: SqliteCapabilityLeaseFaultPoint) => void
}

type LeaseRow = {
  lease_json: string
  remaining_calls: number | bigint
  remaining_cost_units: number
  version: number | bigint
  revoked_at: string | null
}

function asLease(row: Record<string, unknown> | undefined): AgentCapabilityLease | null {
  if (!row) return null
  const typed = row as unknown as LeaseRow
  const base = JSON.parse(typed.lease_json) as AgentCapabilityLease
  return {
    ...base,
    remaining_calls: Number(typed.remaining_calls),
    remaining_cost_units: Number(typed.remaining_cost_units),
    version: Number(typed.version),
    revoked_at: typed.revoked_at
  }
}

function nonnegativeFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(name + ' must be a finite nonnegative number')
  }
  return value
}

export class SqliteCapabilityLeaseStore implements DurableCapabilityLeaseStateStore {
  private constructor(
    private readonly db: SqliteDatabase,
    private readonly faultInjector?: (point: SqliteCapabilityLeaseFaultPoint) => void
  ) {}

  static async open(
    filePath: string,
    options: SqliteCapabilityLeaseStoreOptions = {}
  ): Promise<SqliteCapabilityLeaseStore> {
    const sqlite = await import('node:sqlite')
    const db = new sqlite.DatabaseSync(filePath) as unknown as SqliteDatabase
    db.exec('PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;')
    if (options.initialize !== false) {
      db.exec('PRAGMA journal_mode=WAL;')
      db.exec(
        'CREATE TABLE IF NOT EXISTS capability_leases (' +
        'id TEXT PRIMARY KEY, lease_json TEXT NOT NULL, ' +
        'remaining_calls INTEGER NOT NULL CHECK (remaining_calls >= 0), ' +
        'remaining_cost_units REAL NOT NULL CHECK (remaining_cost_units >= 0), ' +
        'version INTEGER NOT NULL CHECK (version >= 1), expires_at TEXT NOT NULL, revoked_at TEXT);' +
        'CREATE TABLE IF NOT EXISTS capability_lease_audit_outbox (' +
        'id TEXT PRIMARY KEY, lease_id TEXT NOT NULL REFERENCES capability_leases(id) ON DELETE CASCADE, ' +
        'app_id TEXT NOT NULL, key_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, request_digest TEXT, ' +
        'details_json TEXT NOT NULL, created_at TEXT NOT NULL, delivered_at TEXT);' +
        'CREATE TABLE IF NOT EXISTS capability_lease_idempotency (' +
        'lease_id TEXT NOT NULL REFERENCES capability_leases(id) ON DELETE CASCADE, key_digest TEXT NOT NULL, ' +
        'proposal_fingerprint TEXT NOT NULL, ' +
        'lease_snapshot_json TEXT NOT NULL, outbox_id TEXT NOT NULL REFERENCES capability_lease_audit_outbox(id), ' +
        'created_at TEXT NOT NULL, PRIMARY KEY (lease_id, key_digest));' +
        'CREATE INDEX IF NOT EXISTS capability_lease_outbox_pending ' +
        'ON capability_lease_audit_outbox(delivered_at, created_at);'
      )
    }
    return new SqliteCapabilityLeaseStore(db, options.faultInjector)
  }

  saveCapabilityLease(
    input: Omit<AgentCapabilityLease, 'id' | 'created_at' | 'version'> & { id?: string }
  ): AgentCapabilityLease {
    const lease: AgentCapabilityLease = {
      ...input,
      id: input.id || randomId('lse'),
      version: 1,
      created_at: nowIso()
    }
    this.db.prepare(
      'INSERT INTO capability_leases ' +
      '(id, lease_json, remaining_calls, remaining_cost_units, version, expires_at, revoked_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      lease.id,
      JSON.stringify(lease),
      lease.remaining_calls,
      lease.remaining_cost_units,
      lease.version,
      lease.expires_at,
      lease.revoked_at
    )
    return lease
  }

  getCapabilityLease(leaseId: string): AgentCapabilityLease | null {
    return asLease(this.db.prepare(
      'SELECT lease_json, remaining_calls, remaining_cost_units, version, revoked_at ' +
      'FROM capability_leases WHERE id = ?'
    ).get(leaseId))
  }

  revokeCapabilityLease(leaseId: string, revokedAt = nowIso()): AgentCapabilityLease | null {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.getCapabilityLease(leaseId)
      if (!current) {
        this.db.exec('ROLLBACK')
        return null
      }
      const next: AgentCapabilityLease = {
        ...current,
        revoked_at: current.revoked_at || revokedAt,
        version: current.version + 1
      }
      const changed = this.db.prepare(
        'UPDATE capability_leases SET version = ?, revoked_at = ? WHERE id = ? AND version = ?'
      ).run(next.version, next.revoked_at, leaseId, current.version)
      if (Number(changed.changes) !== 1) {
        throw new Error('capability lease revoke compare-and-swap failed')
      }
      this.db.exec('COMMIT')
      return next
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  consumeCapabilityLease(
    leaseId: string,
    input: CapabilityLeaseConsumptionInput
  ): CapabilityLeaseConsumptionResult {
    const costUnits = nonnegativeFinite(input.costUnits, 'costUnits')
    const now = input.now || new Date()
    const idempotencyKey = input.evidence?.idempotencyKey?.trim() || null
    const proposalFingerprint = input.evidence?.proposalFingerprint?.trim() || null
    if (idempotencyKey && !proposalFingerprint) {
      throw new Error('proposalFingerprint is required when idempotencyKey is present')
    }
    const keyDigest = idempotencyKey
      ? 'sha256:' + sha256JcsHex({ leaseId, idempotencyKey })
      : null
    this.db.exec('BEGIN IMMEDIATE')
    try {
      if (keyDigest) {
        const replay = this.db.prepare(
          'SELECT proposal_fingerprint, lease_snapshot_json, outbox_id FROM capability_lease_idempotency ' +
          'WHERE lease_id = ? AND key_digest = ?'
        ).get(leaseId, keyDigest)
        if (replay) {
          const lease = JSON.parse(String(replay.lease_snapshot_json)) as AgentCapabilityLease
          if (String(replay.proposal_fingerprint) !== proposalFingerprint) {
            return this.rollbackFailure('idempotency_mismatch', lease)
          }
          this.db.exec('COMMIT')
          return {
            ok: true,
            lease,
            replayed: true,
            auditObligationId: String(replay.outbox_id)
          }
        }
      }

      const current = this.getCapabilityLease(leaseId)
      if (!current) return this.rollbackFailure('not_found', null)
      if (current.revoked_at) return this.rollbackFailure('revoked', current)
      if (Date.parse(current.expires_at) <= now.getTime()) return this.rollbackFailure('expired', current)
      if (current.remaining_calls < 1) return this.rollbackFailure('call_budget', current)
      if (current.remaining_cost_units < costUnits) return this.rollbackFailure('cost_budget', current)

      const next: AgentCapabilityLease = {
        ...current,
        remaining_calls: current.remaining_calls - 1,
        remaining_cost_units: current.remaining_cost_units - costUnits,
        version: current.version + 1
      }
      const changed = this.db.prepare(
        'UPDATE capability_leases SET remaining_calls = ?, remaining_cost_units = ?, version = ? ' +
        'WHERE id = ? AND version = ? AND remaining_calls >= 1 AND remaining_cost_units >= ?'
      ).run(
        next.remaining_calls,
        next.remaining_cost_units,
        next.version,
        leaseId,
        current.version,
        costUnits
      )
      if (Number(changed.changes) !== 1) {
        throw new Error('capability lease consume compare-and-swap failed')
      }
      this.faultInjector?.('after_lease_update_before_outbox')

      const requestId = input.evidence?.requestId?.trim() || null
      const requestDigest = requestId ? 'sha256:' + sha256JcsHex({ requestId }) : null
      const outboxId = keyDigest
        ? 'laud_' + sha256JcsHex({ leaseId, keyDigest }).slice(0, 24)
        : randomId('laud')
      const createdAt = now.toISOString()
      const details = {
        decision: 'allow',
        consumed: true,
        replayed: false,
        costUnits,
        capabilityLeaseVersion: next.version,
        capabilityLeaseRemainingCalls: next.remaining_calls,
        capabilityLeaseRemainingCostUnits: next.remaining_cost_units,
        proposalToolHash: input.evidence?.proposalToolHash || null,
        resourceCount: input.evidence?.resourceCount || 0,
        fieldCount: input.evidence?.fieldCount || 0,
        rawTaskStored: false,
        rawPolicyStored: false,
        rawRequestStored: false
      }
      this.db.prepare(
        'INSERT INTO capability_lease_audit_outbox ' +
        '(id, lease_id, app_id, key_id, actor_user_id, request_digest, details_json, created_at, delivered_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)'
      ).run(
        outboxId,
        leaseId,
        next.app_id,
        next.key_id,
        next.actor_user_id,
        requestDigest,
        JSON.stringify(details),
        createdAt
      )
      if (keyDigest) {
        this.db.prepare(
          'INSERT INTO capability_lease_idempotency ' +
          '(lease_id, key_digest, proposal_fingerprint, lease_snapshot_json, outbox_id, created_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?)'
        ).run(leaseId, keyDigest, proposalFingerprint, JSON.stringify(next), outboxId, createdAt)
      }
      this.faultInjector?.('after_outbox_before_commit')
      this.db.exec('COMMIT')
      this.faultInjector?.('after_commit_before_return')
      return { ok: true, lease: next, replayed: false, auditObligationId: outboxId }
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  listPendingCapabilityLeaseAudits(limit = 100): PendingCapabilityLeaseAudit[] {
    const boundedLimit = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 1000) : 100
    return this.db.prepare(
      'SELECT id, lease_id, app_id, key_id, actor_user_id, request_digest, details_json, created_at ' +
      'FROM capability_lease_audit_outbox WHERE delivered_at IS NULL ORDER BY created_at, id LIMIT ?'
    ).all(boundedLimit).map((row) => ({
      id: String(row.id),
      appId: String(row.app_id),
      keyId: String(row.key_id),
      actorUserId: String(row.actor_user_id),
      leaseId: String(row.lease_id),
      requestDigest: row.request_digest === null ? null : String(row.request_digest),
      createdAt: String(row.created_at),
      details: JSON.parse(String(row.details_json)) as Record<string, unknown>
    }))
  }

  markCapabilityLeaseAuditDelivered(eventId: string, deliveredAt = nowIso()): boolean {
    this.faultInjector?.('before_mark_delivered')
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const changed = this.db.prepare(
        'UPDATE capability_lease_audit_outbox SET delivered_at = ? ' +
        'WHERE id = ? AND delivered_at IS NULL'
      ).run(deliveredAt, eventId)
      this.faultInjector?.('after_mark_before_commit')
      this.db.exec('COMMIT')
      return Number(changed.changes) === 1
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  outboxSnapshot(): { total: number; pending: number; idempotencyRows: number } {
    const outbox = this.db.prepare(
      'SELECT COUNT(*) AS total, ' +
      'SUM(CASE WHEN delivered_at IS NULL THEN 1 ELSE 0 END) AS pending ' +
      'FROM capability_lease_audit_outbox'
    ).get() || {}
    const idempotency = this.db.prepare(
      'SELECT COUNT(*) AS total FROM capability_lease_idempotency'
    ).get() || {}
    return {
      total: Number(outbox.total || 0),
      pending: Number(outbox.pending || 0),
      idempotencyRows: Number(idempotency.total || 0)
    }
  }

  close(): void {
    this.db.close()
  }

  private rollback(): void {
    try {
      this.db.exec('ROLLBACK')
    } catch {
      // The transaction may already have committed at an injected post-commit fault.
    }
  }

  private rollbackFailure(
    reason: CapabilityLeaseConsumptionFailure,
    lease: AgentCapabilityLease | null
  ): CapabilityLeaseConsumptionResult {
    this.db.exec('ROLLBACK')
    return { ok: false, reason, lease }
  }
}
