import { OpenPortError } from './errors.js'
import { ErrorCodes } from './error-codes.js'
import type { DomainAdapter, Ledger, ListTransactionsInput, Transaction } from './types.js'
import { clampInt, nowIso, randomId } from './utils.js'

export class InMemoryDomainAdapter implements DomainAdapter {
  private ledgers: Ledger[]
  private transactions: Transaction[]

  constructor(seed?: { ledgers?: Ledger[]; transactions?: Transaction[] }) {
    this.ledgers = seed?.ledgers || [
      {
        id: 'ledger_main',
        name: 'Main Ledger',
        currency_home: 'USD',
        tz: 'America/Los_Angeles',
        organization_id: 'org_demo'
      },
      {
        id: 'ledger_ops',
        name: 'Ops Ledger',
        currency_home: 'USD',
        tz: 'America/New_York',
        organization_id: 'org_demo'
      }
    ]

    const now = nowIso()
    this.transactions = seed?.transactions || [
      {
        id: 'txn_1',
        ledger_id: 'ledger_main',
        kind: 'income',
        title: 'Consulting payment',
        amount_home: 1200,
        currency_home: 'USD',
        date: now,
        notes: null,
        is_deleted: false,
        created_at: now,
        updated_at: now
      },
      {
        id: 'txn_2',
        ledger_id: 'ledger_main',
        kind: 'expense',
        title: 'Software subscription',
        amount_home: 80,
        currency_home: 'USD',
        date: now,
        notes: 'annual plan',
        is_deleted: false,
        created_at: now,
        updated_at: now
      }
    ]
  }

  async listLedgers(_: string): Promise<Ledger[]> {
    return [...this.ledgers]
  }

  async listTransactions(_: string, input: ListTransactionsInput): Promise<{ items: Transaction[]; total: number; page: number; pageSize: number; hasMore: boolean }> {
    const page = clampInt(input.page, 1, 10000, 1)
    const pageSize = clampInt(input.pageSize, 1, 200, 50)
    const startAt = input.startDate ? new Date(input.startDate).getTime() : null
    const endAt = input.endDate ? new Date(input.endDate).getTime() : null

    const filtered = this.transactions
      .filter((txn) => !txn.is_deleted)
      .filter((txn) => txn.ledger_id === input.ledgerId)
      .filter((txn) => {
        const t = new Date(txn.date).getTime()
        if (startAt !== null && t < startAt) return false
        if (endAt !== null && t > endAt) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date))

    const total = filtered.length
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: start + items.length < total
    }
  }

  async createTransaction(_: string, payload: Record<string, unknown>): Promise<Transaction> {
    const ledgerId = String(payload.ledgerId || payload.ledger_id || '').trim()
    const kind = String(payload.kind || '').trim() as Transaction['kind']
    const title = String(payload.title || '').trim()
    const amount = Number(payload.amount_home || payload.amountHome)
    const currency = String(payload.currency_home || payload.currencyHome || 'USD').trim().toUpperCase()
    const date = String(payload.date || '').trim() || nowIso()

    if (!ledgerId || !title || !kind || !Number.isFinite(amount)) {
      throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'Invalid transaction payload')
    }
    this.requireLedger(ledgerId)

    const now = nowIso()
    const txn: Transaction = {
      id: randomId('txn'),
      ledger_id: ledgerId,
      kind,
      title,
      amount_home: amount,
      currency_home: currency,
      date,
      notes: payload.notes ? String(payload.notes) : null,
      is_deleted: false,
      created_at: now,
      updated_at: now
    }
    this.transactions.push(txn)
    return txn
  }

  async updateTransaction(_: string, transactionId: string, payload: Record<string, unknown>): Promise<Transaction> {
    const existing = this.transactions.find((t) => t.id === transactionId)
    if (!existing || existing.is_deleted) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
    }

    if (payload.ledgerId || payload.ledger_id) {
      const ledgerId = String(payload.ledgerId || payload.ledger_id || '').trim()
      this.requireLedger(ledgerId)
      existing.ledger_id = ledgerId
    }

    if (payload.kind) existing.kind = String(payload.kind) as Transaction['kind']
    if (payload.title) existing.title = String(payload.title)

    if (payload.amount_home !== undefined || payload.amountHome !== undefined) {
      const amount = Number(payload.amount_home ?? payload.amountHome)
      if (!Number.isFinite(amount)) {
        throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'Invalid amount')
      }
      existing.amount_home = amount
    }

    if (payload.currency_home || payload.currencyHome) {
      existing.currency_home = String(payload.currency_home || payload.currencyHome).trim().toUpperCase()
    }

    if (payload.date) existing.date = String(payload.date)
    if (payload.notes !== undefined) existing.notes = payload.notes ? String(payload.notes) : null
    existing.updated_at = nowIso()

    return { ...existing }
  }

  async softDeleteTransaction(_: string, transactionId: string): Promise<{ id: string; deleted: true }> {
    const existing = this.transactions.find((t) => t.id === transactionId)
    if (!existing || existing.is_deleted) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
    }

    existing.is_deleted = true
    existing.updated_at = nowIso()
    return { id: existing.id, deleted: true }
  }

  async hardDeleteTransaction(_: string, transactionId: string): Promise<{ id: string; deleted: true; hard: true }> {
    const index = this.transactions.findIndex((t) => t.id === transactionId)
    if (index < 0) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
    }

    this.transactions.splice(index, 1)
    return { id: transactionId, deleted: true, hard: true }
  }

  async getTransactionById(_: string, transactionId: string): Promise<Transaction | null> {
    const txn = this.transactions.find((t) => t.id === transactionId)
    return txn ? { ...txn } : null
  }

  private requireLedger(ledgerId: string): void {
    const exists = this.ledgers.some((ledger) => ledger.id === ledgerId)
    if (!exists) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Ledger not found')
    }
  }
}
