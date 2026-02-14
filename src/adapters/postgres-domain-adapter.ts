import { Pool } from 'pg'
import { ErrorCodes } from '../error-codes.js'
import { OpenMCPError } from '../errors.js'
import type { DomainAdapter, Ledger, ListTransactionsInput, Transaction } from '../types.js'
import { clampInt, nowIso, randomId } from '../utils.js'

type PgConfig = {
  connectionString: string
}

function ensureDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new OpenMCPError(400, ErrorCodes.AGENT_ACTION_INVALID, 'Invalid date value')
  }
  return date.toISOString()
}

function mapLedger(row: Record<string, unknown>): Ledger {
  return {
    id: String(row.id),
    name: String(row.name),
    currency_home: String(row.currency_home),
    tz: String(row.tz),
    organization_id: row.organization_id ? String(row.organization_id) : null
  }
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    ledger_id: String(row.ledger_id),
    kind: String(row.kind) as Transaction['kind'],
    title: String(row.title),
    amount_home: Number(row.amount_home),
    currency_home: String(row.currency_home),
    date: new Date(String(row.date)).toISOString(),
    notes: row.notes ? String(row.notes) : null,
    is_deleted: Boolean(row.is_deleted),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString()
  }
}

export class PostgresDomainAdapter implements DomainAdapter {
  private readonly pool: Pool

  constructor(config: PgConfig) {
    this.pool = new Pool({ connectionString: config.connectionString })
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  async listLedgers(_: string): Promise<Ledger[]> {
    const result = await this.pool.query(
      `
        SELECT id, name, currency_home, tz, organization_id
        FROM ledgers
        WHERE is_deleted = false
        ORDER BY updated_at DESC
      `
    )

    return result.rows.map((row) => mapLedger(row))
  }

  async listTransactions(_: string, input: ListTransactionsInput): Promise<{ items: Transaction[]; total: number; page: number; pageSize: number; hasMore: boolean }> {
    const page = clampInt(input.page, 1, 10000, 1)
    const pageSize = clampInt(input.pageSize, 1, 200, 50)

    const params: unknown[] = [input.ledgerId]
    const where: string[] = ['ledger_id = $1', 'is_deleted = false']

    if (input.startDate) {
      params.push(ensureDate(input.startDate))
      where.push(`date >= $${params.length}`)
    }
    if (input.endDate) {
      params.push(ensureDate(input.endDate))
      where.push(`date <= $${params.length}`)
    }

    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM transactions
      WHERE ${where.join(' AND ')}
    `
    const totalResult = await this.pool.query(totalSql, params)
    const total = Number(totalResult.rows[0]?.total || 0)

    const offset = (page - 1) * pageSize
    params.push(pageSize, offset)

    const rowsSql = `
      SELECT
        id,
        ledger_id,
        kind,
        title,
        amount_home,
        currency_home,
        date,
        notes,
        is_deleted,
        created_at,
        updated_at
      FROM transactions
      WHERE ${where.join(' AND ')}
      ORDER BY date DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `

    const rowsResult = await this.pool.query(rowsSql, params)
    const items = rowsResult.rows.map((row) => mapTransaction(row))

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: offset + items.length < total
    }
  }

  async createTransaction(_: string, payload: Record<string, unknown>): Promise<Transaction> {
    const ledgerId = String(payload.ledgerId || payload.ledger_id || '').trim()
    const kind = String(payload.kind || '').trim()
    const title = String(payload.title || '').trim()
    const amountHome = Number(payload.amount_home ?? payload.amountHome)
    const currencyHome = String(payload.currency_home || payload.currencyHome || 'USD').trim().toUpperCase()
    const date = payload.date ? ensureDate(String(payload.date)) : nowIso()
    const notes = payload.notes ? String(payload.notes) : null

    if (!ledgerId || !kind || !title || !Number.isFinite(amountHome)) {
      throw new OpenMCPError(400, ErrorCodes.AGENT_ACTION_INVALID, 'Invalid transaction payload')
    }

    const id = randomId('txn')
    const sql = `
      INSERT INTO transactions (
        id, ledger_id, kind, title, amount_home, currency_home, date, notes, is_deleted, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
      RETURNING id, ledger_id, kind, title, amount_home, currency_home, date, notes, is_deleted, created_at, updated_at
    `

    const result = await this.pool.query(sql, [id, ledgerId, kind, title, amountHome, currencyHome, date, notes])
    const row = result.rows[0]
    if (!row) {
      throw new OpenMCPError(500, ErrorCodes.COMMON_VALIDATION, 'Failed to create transaction')
    }
    return mapTransaction(row)
  }

  async updateTransaction(_: string, transactionId: string, payload: Record<string, unknown>): Promise<Transaction> {
    const existing = await this.getTransactionById('', transactionId)
    if (!existing || existing.is_deleted) {
      throw new OpenMCPError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
    }

    const ledgerId = payload.ledgerId || payload.ledger_id ? String(payload.ledgerId || payload.ledger_id) : existing.ledger_id
    const kind = payload.kind ? String(payload.kind) : existing.kind
    const title = payload.title ? String(payload.title) : existing.title
    const amountHome = payload.amount_home !== undefined || payload.amountHome !== undefined
      ? Number(payload.amount_home ?? payload.amountHome)
      : existing.amount_home
    const currencyHome = payload.currency_home || payload.currencyHome
      ? String(payload.currency_home || payload.currencyHome).toUpperCase()
      : existing.currency_home
    const date = payload.date ? ensureDate(String(payload.date)) : existing.date
    const notes = payload.notes !== undefined ? (payload.notes ? String(payload.notes) : null) : existing.notes

    if (!Number.isFinite(amountHome)) {
      throw new OpenMCPError(400, ErrorCodes.AGENT_ACTION_INVALID, 'Invalid amount')
    }

    const sql = `
      UPDATE transactions
      SET
        ledger_id = $2,
        kind = $3,
        title = $4,
        amount_home = $5,
        currency_home = $6,
        date = $7,
        notes = $8,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, ledger_id, kind, title, amount_home, currency_home, date, notes, is_deleted, created_at, updated_at
    `

    const result = await this.pool.query(sql, [transactionId, ledgerId, kind, title, amountHome, currencyHome, date, notes])
    const row = result.rows[0]
    if (!row) {
      throw new OpenMCPError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
    }

    return mapTransaction(row)
  }

  async softDeleteTransaction(_: string, transactionId: string): Promise<{ id: string; deleted: true }> {
    const sql = `
      UPDATE transactions
      SET is_deleted = true, updated_at = NOW()
      WHERE id = $1 AND is_deleted = false
      RETURNING id
    `
    const result = await this.pool.query(sql, [transactionId])
    if (!result.rows[0]) {
      throw new OpenMCPError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
    }

    return { id: transactionId, deleted: true }
  }

  async hardDeleteTransaction(_: string, transactionId: string): Promise<{ id: string; deleted: true; hard: true }> {
    const result = await this.pool.query(`DELETE FROM transactions WHERE id = $1 RETURNING id`, [transactionId])
    if (!result.rows[0]) {
      throw new OpenMCPError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
    }

    return { id: transactionId, deleted: true, hard: true }
  }

  async getTransactionById(_: string, transactionId: string): Promise<Transaction | null> {
    const result = await this.pool.query(
      `
        SELECT
          id,
          ledger_id,
          kind,
          title,
          amount_home,
          currency_home,
          date,
          notes,
          is_deleted,
          created_at,
          updated_at
        FROM transactions
        WHERE id = $1
      `,
      [transactionId]
    )

    const row = result.rows[0]
    return row ? mapTransaction(row) : null
  }
}
