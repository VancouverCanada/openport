import type { AuditSink } from '../audit.js'
import type { AgentAuditLog } from '../types.js'
import { sha256JcsHex } from '../utils.js'

type SqliteStatement = {
  get: (...values: unknown[]) => Record<string, unknown> | undefined
  all: (...values: unknown[]) => Record<string, unknown>[]
  run: (...values: unknown[]) => { changes: number | bigint }
}
type SqliteDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  close: () => void
}

export type SqliteAuditSinkOptions = {
  initialize?: boolean
}

export class SqliteAuditSink implements AuditSink {
  private constructor(private readonly db: SqliteDatabase) {}

  static async open(
    filePath: string,
    options: SqliteAuditSinkOptions = {}
  ): Promise<SqliteAuditSink> {
    const sqlite = await import('node:sqlite')
    const db = new sqlite.DatabaseSync(filePath) as unknown as SqliteDatabase
    db.exec('PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL;')
    if (options.initialize !== false) {
      db.exec('PRAGMA journal_mode=WAL;')
      db.exec(
        'CREATE TABLE IF NOT EXISTS audit_events (' +
        'sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, ' +
        'event_json TEXT NOT NULL, event_hash TEXT NOT NULL, created_at TEXT NOT NULL);'
      )
    }
    return new SqliteAuditSink(db)
  }

  async log(event: AgentAuditLog): Promise<void> {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const existing = this.db.prepare(
        'SELECT id FROM audit_events WHERE id = ?'
      ).get(event.id)
      if (existing) {
        this.db.exec('COMMIT')
        return
      }
      const previous = this.db.prepare(
        'SELECT event_hash FROM audit_events ORDER BY sequence DESC LIMIT 1'
      ).get()
      const prevEventHash = previous ? String(previous.event_hash) : null
      const next: AgentAuditLog = {
        ...event,
        prev_event_hash: prevEventHash,
        event_hash: sha256JcsHex({
          prev_event_hash: prevEventHash,
          id: event.id,
          app_id: event.app_id,
          key_id: event.key_id,
          actor_user_id: event.actor_user_id,
          performed_by_user_id: event.performed_by_user_id,
          action: event.action,
          status: event.status,
          code: event.code,
          request_id: event.request_id,
          draft_id: event.draft_id,
          execution_id: event.execution_id,
          ip: event.ip,
          user_agent: event.user_agent,
          details: event.details,
          created_at: event.created_at
        })
      }
      this.db.prepare(
        'INSERT INTO audit_events (id, event_json, event_hash, created_at) VALUES (?, ?, ?, ?)'
      ).run(next.id, JSON.stringify(next), next.event_hash, next.created_at)
      this.db.exec('COMMIT')
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        // Ignore rollback after a completed transaction.
      }
      throw error
    }
  }

  list(): AgentAuditLog[] {
    return this.db.prepare(
      'SELECT event_json FROM audit_events ORDER BY sequence DESC'
    ).all().map((row) => JSON.parse(String(row.event_json)) as AgentAuditLog)
  }

  close(): void {
    this.db.close()
  }
}
