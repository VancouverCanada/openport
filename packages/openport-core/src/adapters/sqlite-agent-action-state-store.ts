import type { AgentActionStateStore } from '../agent-action-state-store.js'
import { ErrorCodes } from '../error-codes.js'
import { OpenPortError } from '../errors.js'
import type { AgentDraft, AgentExecution, DraftStatus } from '../types.js'
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

export type SqliteAgentActionStateFaultPoint =
  | 'after_draft_write_before_commit'
  | 'after_draft_commit_before_return'
  | 'after_execution_write_before_commit'
  | 'after_execution_commit_before_return'

export type SqliteAgentActionStateStoreOptions = {
  initialize?: boolean
  faultInjector?: (point: SqliteAgentActionStateFaultPoint) => void
}

const MAX_JSON_LENGTH = 1024 * 1024

function parseObject(value: unknown, name: string): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  const parsed = JSON.parse(String(value)) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(name + ' is not a JSON object')
  }
  return parsed as Record<string, unknown>
}

function encodeObject(value: Record<string, unknown> | null, name: string): string | null {
  if (value === null) return null
  const encoded = JSON.stringify(value)
  if (encoded.length > MAX_JSON_LENGTH) throw new TypeError(name + ' exceeds maximum length')
  return encoded
}

function requiredText(value: string, name: string, maxLength = 2048): string {
  const normalized = value.trim()
  if (!normalized) throw new TypeError(name + ' is required')
  if (normalized.length > maxLength) throw new TypeError(name + ' exceeds maximum length')
  return normalized
}

function optionalText(value: string | null | undefined, maxLength = 4096): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
  if (!normalized) return null
  if (normalized.length > maxLength) throw new TypeError('text exceeds maximum length')
  return normalized
}

function draftFingerprint(input: Pick<AgentDraft, 'action_type' | 'payload'>): string {
  return sha256JcsHex({ actionType: input.action_type, payload: input.payload })
}

function asDraft(row: Record<string, unknown> | undefined): AgentDraft | null {
  if (!row) return null
  return {
    id: String(row.id),
    app_id: String(row.app_id),
    key_id: String(row.key_id),
    actor_user_id: String(row.actor_user_id),
    action_type: String(row.action_type),
    payload: parseObject(row.payload_json, 'payload_json') || {},
    status: String(row.status) as DraftStatus,
    requires_confirmation: Number(row.requires_confirmation) === 1,
    auto_execute_requested: Number(row.auto_execute_requested) === 1,
    request_id: row.request_id === null ? null : String(row.request_id),
    idempotency_key: row.idempotency_key === null ? null : String(row.idempotency_key),
    justification: row.justification === null ? null : String(row.justification),
    preflight: parseObject(row.preflight_json, 'preflight_json'),
    preflight_hash: row.preflight_hash === null ? null : String(row.preflight_hash),
    preflight_state_witness: parseObject(row.preflight_state_witness_json, 'preflight_state_witness_json'),
    preflight_state_witness_hash: row.preflight_state_witness_hash === null
      ? null
      : String(row.preflight_state_witness_hash),
    policy_snapshot: parseObject(row.policy_snapshot_json, 'policy_snapshot_json'),
    confirmed_by_user_id: row.confirmed_by_user_id === null ? null : String(row.confirmed_by_user_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    confirmed_at: row.confirmed_at === null ? null : String(row.confirmed_at),
    canceled_at: row.canceled_at === null ? null : String(row.canceled_at)
  }
}

function asExecution(row: Record<string, unknown> | undefined): AgentExecution | null {
  if (!row) return null
  return {
    id: String(row.id),
    draft_id: String(row.draft_id),
    app_id: String(row.app_id),
    idempotency_key: row.idempotency_key === null ? null : String(row.idempotency_key),
    status: String(row.status) as AgentExecution['status'],
    result: parseObject(row.result_json, 'result_json'),
    error: row.error === null ? null : String(row.error),
    created_at: String(row.created_at)
  }
}

/**
 * Optional single-host SQLite/WAL persistence for HTTP drafts and execution
 * records. This store does not execute effects; pair it with a durable action
 * obligation executor and a receiver that honors stable effect identifiers.
 */
export class SqliteAgentActionStateStore implements AgentActionStateStore {
  private constructor(
    private readonly db: SqliteDatabase,
    private readonly faultInjector?: (point: SqliteAgentActionStateFaultPoint) => void
  ) {}

  static async open(
    filePath: string,
    options: SqliteAgentActionStateStoreOptions = {}
  ): Promise<SqliteAgentActionStateStore> {
    const sqlite = await import('node:sqlite')
    const db = new sqlite.DatabaseSync(filePath) as unknown as SqliteDatabase
    db.exec('PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;')
    if (options.initialize !== false) {
      db.exec('PRAGMA journal_mode=WAL;')
      db.exec(
        'CREATE TABLE IF NOT EXISTS agent_action_drafts (' +
        'id TEXT PRIMARY KEY, app_id TEXT NOT NULL, key_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, ' +
        'action_type TEXT NOT NULL, payload_json TEXT NOT NULL, request_fingerprint TEXT NOT NULL, ' +
        "status TEXT NOT NULL CHECK (status IN ('draft','confirmed','canceled','failed')), " +
        'requires_confirmation INTEGER NOT NULL CHECK (requires_confirmation IN (0,1)), ' +
        'auto_execute_requested INTEGER NOT NULL CHECK (auto_execute_requested IN (0,1)), ' +
        'request_id TEXT, idempotency_key TEXT, justification TEXT, preflight_json TEXT, preflight_hash TEXT, ' +
        'preflight_state_witness_json TEXT, preflight_state_witness_hash TEXT, policy_snapshot_json TEXT, ' +
        'confirmed_by_user_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, ' +
        'confirmed_at TEXT, canceled_at TEXT);' +
        'CREATE UNIQUE INDEX IF NOT EXISTS agent_action_draft_idempotency ' +
        'ON agent_action_drafts(app_id, idempotency_key) WHERE idempotency_key IS NOT NULL;' +
        'CREATE INDEX IF NOT EXISTS agent_action_draft_listing ' +
        'ON agent_action_drafts(app_id, status, updated_at DESC);' +
        'CREATE TABLE IF NOT EXISTS agent_action_executions (' +
        'id TEXT PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES agent_action_drafts(id) ON DELETE CASCADE, ' +
        'app_id TEXT NOT NULL, idempotency_key TEXT, status TEXT NOT NULL CHECK (status IN (\'success\',\'failed\')), ' +
        'result_json TEXT, error TEXT, request_fingerprint TEXT, created_at TEXT NOT NULL);' +
        'CREATE UNIQUE INDEX IF NOT EXISTS agent_action_success_idempotency ' +
        'ON agent_action_executions(app_id, idempotency_key) ' +
        "WHERE idempotency_key IS NOT NULL AND status = 'success';" +
        'CREATE INDEX IF NOT EXISTS agent_action_execution_draft ' +
        'ON agent_action_executions(draft_id, created_at DESC);'
      )
    }
    return new SqliteAgentActionStateStore(db, options.faultInjector)
  }

  saveDraft(input: Omit<AgentDraft, 'id' | 'created_at' | 'updated_at'> & { id?: string }): AgentDraft {
    const appId = requiredText(input.app_id, 'app_id', 200)
    const idempotencyKey = optionalText(input.idempotency_key, 2048)
    const fingerprint = draftFingerprint(input)
    const now = nowIso()
    const id = input.id || randomId('drf')
    const payloadJson = encodeObject(input.payload, 'payload')!

    this.db.exec('BEGIN IMMEDIATE')
    try {
      const existingRow = idempotencyKey
        ? this.db.prepare(
          'SELECT * FROM agent_action_drafts WHERE app_id = ? AND idempotency_key = ?'
        ).get(appId, idempotencyKey)
        : this.db.prepare('SELECT * FROM agent_action_drafts WHERE id = ?').get(id)
      if (existingRow) {
        if (String(existingRow.request_fingerprint) !== fingerprint) {
          throw new OpenPortError(
            409,
            ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH,
            'Idempotency key is already bound to a different action payload'
          )
        }
        this.db.exec('COMMIT')
        return asDraft(existingRow)!
      }

      this.db.prepare(
        'INSERT INTO agent_action_drafts (' +
        'id, app_id, key_id, actor_user_id, action_type, payload_json, request_fingerprint, status, ' +
        'requires_confirmation, auto_execute_requested, request_id, idempotency_key, justification, ' +
        'preflight_json, preflight_hash, preflight_state_witness_json, preflight_state_witness_hash, ' +
        'policy_snapshot_json, confirmed_by_user_id, created_at, updated_at, confirmed_at, canceled_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        id,
        appId,
        requiredText(input.key_id, 'key_id', 200),
        requiredText(input.actor_user_id, 'actor_user_id', 200),
        requiredText(input.action_type, 'action_type', 200),
        payloadJson,
        fingerprint,
        input.status,
        input.requires_confirmation ? 1 : 0,
        input.auto_execute_requested ? 1 : 0,
        optionalText(input.request_id, 200),
        idempotencyKey,
        optionalText(input.justification, 4096),
        encodeObject(input.preflight, 'preflight'),
        optionalText(input.preflight_hash, 256),
        encodeObject(input.preflight_state_witness, 'preflight_state_witness'),
        optionalText(input.preflight_state_witness_hash, 256),
        encodeObject(input.policy_snapshot, 'policy_snapshot'),
        optionalText(input.confirmed_by_user_id, 200),
        now,
        now,
        input.confirmed_at,
        input.canceled_at
      )
      this.faultInjector?.('after_draft_write_before_commit')
      this.db.exec('COMMIT')
      this.faultInjector?.('after_draft_commit_before_return')
      return this.getDraft(id)!
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  updateDraft(draftId: string, patch: Partial<AgentDraft>): AgentDraft | null {
    const existing = this.getDraft(draftId)
    if (!existing) return null
    const next: AgentDraft = { ...existing, ...patch, id: existing.id, created_at: existing.created_at, updated_at: nowIso() }
    const fingerprint = draftFingerprint(next)
    this.db.prepare(
      'UPDATE agent_action_drafts SET action_type = ?, payload_json = ?, request_fingerprint = ?, status = ?, ' +
      'requires_confirmation = ?, auto_execute_requested = ?, request_id = ?, idempotency_key = ?, ' +
      'justification = ?, preflight_json = ?, preflight_hash = ?, preflight_state_witness_json = ?, ' +
      'preflight_state_witness_hash = ?, policy_snapshot_json = ?, confirmed_by_user_id = ?, ' +
      'updated_at = ?, confirmed_at = ?, canceled_at = ? WHERE id = ?'
    ).run(
      next.action_type,
      encodeObject(next.payload, 'payload'),
      fingerprint,
      next.status,
      next.requires_confirmation ? 1 : 0,
      next.auto_execute_requested ? 1 : 0,
      next.request_id,
      next.idempotency_key,
      next.justification,
      encodeObject(next.preflight, 'preflight'),
      next.preflight_hash,
      encodeObject(next.preflight_state_witness, 'preflight_state_witness'),
      next.preflight_state_witness_hash,
      encodeObject(next.policy_snapshot, 'policy_snapshot'),
      next.confirmed_by_user_id,
      next.updated_at,
      next.confirmed_at,
      next.canceled_at,
      existing.id
    )
    return this.getDraft(existing.id)
  }

  getDraft(draftId: string): AgentDraft | null {
    return asDraft(this.db.prepare('SELECT * FROM agent_action_drafts WHERE id = ?').get(draftId))
  }

  listDrafts(filter?: { appId?: string; status?: DraftStatus }): AgentDraft[] {
    const clauses: string[] = []
    const values: unknown[] = []
    if (filter?.appId) {
      clauses.push('app_id = ?')
      values.push(filter.appId)
    }
    if (filter?.status) {
      clauses.push('status = ?')
      values.push(filter.status)
    }
    const where = clauses.length > 0 ? ' WHERE ' + clauses.join(' AND ') : ''
    return this.db.prepare(
      'SELECT * FROM agent_action_drafts' + where + ' ORDER BY updated_at DESC, id DESC'
    ).all(...values).map((row) => asDraft(row)!)
  }

  findDraftByIdempotency(appId: string, idempotencyKey: string): AgentDraft | null {
    return asDraft(this.db.prepare(
      'SELECT * FROM agent_action_drafts WHERE app_id = ? AND idempotency_key = ?'
    ).get(appId, idempotencyKey))
  }

  saveExecution(
    input: Omit<AgentExecution, 'id' | 'created_at'>,
    requestFingerprint?: string | null
  ): AgentExecution {
    const fingerprint = optionalText(requestFingerprint, 256)
    const idempotencyKey = optionalText(input.idempotency_key, 2048)
    const now = nowIso()
    this.db.exec('BEGIN IMMEDIATE')
    try {
      if (idempotencyKey) {
        const existing = this.db.prepare(
          "SELECT * FROM agent_action_executions WHERE app_id = ? AND idempotency_key = ? AND status = 'success' " +
          'ORDER BY created_at DESC LIMIT 1'
        ).get(input.app_id, idempotencyKey)
        if (existing) {
          const existingFingerprint = existing.request_fingerprint === null
            ? null
            : String(existing.request_fingerprint)
          if (fingerprint && existingFingerprint && fingerprint !== existingFingerprint) {
            throw new OpenPortError(
              409,
              ErrorCodes.AGENT_IDEMPOTENCY_MISMATCH,
              'Idempotency key is already bound to a different action payload'
            )
          }
          this.db.exec('COMMIT')
          return asExecution(existing)!
        }
      }

      const id = randomId('exe')
      this.db.prepare(
        'INSERT INTO agent_action_executions (' +
        'id, draft_id, app_id, idempotency_key, status, result_json, error, request_fingerprint, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        id,
        input.draft_id,
        input.app_id,
        idempotencyKey,
        input.status,
        encodeObject(input.result, 'result'),
        input.error,
        fingerprint,
        now
      )
      this.faultInjector?.('after_execution_write_before_commit')
      this.db.exec('COMMIT')
      this.faultInjector?.('after_execution_commit_before_return')
      return this.getExecution(id)!
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  getExecutionRequestFingerprint(executionId: string): string | null {
    const row = this.db.prepare(
      'SELECT request_fingerprint FROM agent_action_executions WHERE id = ?'
    ).get(executionId)
    return row?.request_fingerprint === null || row?.request_fingerprint === undefined
      ? null
      : String(row.request_fingerprint)
  }

  getLatestExecutionForDraft(draftId: string): AgentExecution | null {
    return asExecution(this.db.prepare(
      'SELECT * FROM agent_action_executions WHERE draft_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1'
    ).get(draftId))
  }

  findExecutionByIdempotency(appId: string, idempotencyKey: string): AgentExecution | null {
    return asExecution(this.db.prepare(
      "SELECT * FROM agent_action_executions WHERE app_id = ? AND idempotency_key = ? AND status = 'success' " +
      'ORDER BY created_at DESC, id DESC LIMIT 1'
    ).get(appId, idempotencyKey))
  }

  deleteActionsForApp(appId: string): void {
    this.db.prepare('DELETE FROM agent_action_drafts WHERE app_id = ?').run(appId)
  }

  snapshot(): { drafts: number; successfulExecutions: number; failedExecutions: number } {
    const drafts = Number(this.db.prepare('SELECT COUNT(*) AS total FROM agent_action_drafts').get()?.total || 0)
    const success = Number(this.db.prepare(
      "SELECT COUNT(*) AS total FROM agent_action_executions WHERE status = 'success'"
    ).get()?.total || 0)
    const failed = Number(this.db.prepare(
      "SELECT COUNT(*) AS total FROM agent_action_executions WHERE status = 'failed'"
    ).get()?.total || 0)
    return { drafts, successfulExecutions: success, failedExecutions: failed }
  }

  close(): void {
    this.db.close()
  }

  private getExecution(executionId: string): AgentExecution | null {
    return asExecution(this.db.prepare(
      'SELECT * FROM agent_action_executions WHERE id = ?'
    ).get(executionId))
  }

  private rollback(): void {
    try {
      this.db.exec('ROLLBACK')
    } catch {
      // A post-commit fault intentionally reaches this path after durability.
    }
  }
}
