import { ErrorCodes } from '../error-codes.js'
import { OpenPortError } from '../errors.js'
import type { DomainAdapter, Ledger, ListTransactionsInput, Transaction } from '../types.js'
import { clampInt, nowIso, randomId } from '../utils.js'

export type OpenPortPrismaClient = {
  ledgers: {
    findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>
  }
  transactions: {
    count: (args: Record<string, unknown>) => Promise<number>
    findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>
    findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>
    delete: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
  $disconnect?: () => Promise<void>
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return nowIso()
  return date.toISOString()
}

function toNum(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as any).toNumber === 'function') {
    return Number((value as any).toNumber())
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
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
    amount_home: toNum(row.amount_home),
    currency_home: String(row.currency_home),
    date: toIso(row.date),
    notes: row.notes ? String(row.notes) : null,
    is_deleted: Boolean(row.is_deleted),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at)
  }
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'Invalid date value')
  }
  return date
}

export class PrismaDomainAdapter implements DomainAdapter {
  constructor(private readonly prisma: OpenPortPrismaClient) {}

  async close(): Promise<void> {
    if (typeof this.prisma.$disconnect === 'function') {
      await this.prisma.$disconnect()
    }
  }

  async listLedgers(_: string): Promise<Ledger[]> {
    const rows = await this.prisma.ledgers.findMany({
      where: { is_deleted: false },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        name: true,
        currency_home: true,
        tz: true,
        organization_id: true
      }
    })
    return rows.map((row) => mapLedger(row))
  }

  async listTransactions(_: string, input: ListTransactionsInput): Promise<{ items: Transaction[]; total: number; page: number; pageSize: number; hasMore: boolean }> {
    const page = clampInt(input.page, 1, 10000, 1)
    const pageSize = clampInt(input.pageSize, 1, 200, 50)
    const startDate = parseDate(input.startDate)
    const endDate = parseDate(input.endDate)

    const where: Record<string, unknown> = {
      ledger_id: input.ledgerId,
      is_deleted: false
    }

    if (startDate || endDate) {
      where.date = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {})
      }
    }

    const total = await this.prisma.transactions.count({ where })
    const rows = await this.prisma.transactions.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        ledger_id: true,
        kind: true,
        title: true,
        amount_home: true,
        currency_home: true,
        date: true,
        notes: true,
        is_deleted: true,
        created_at: true,
        updated_at: true
      }
    })

    const items = rows.map((row) => mapTransaction(row))

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total
    }
  }

  async createTransaction(_: string, payload: Record<string, unknown>): Promise<Transaction> {
    const ledgerId = String(payload.ledgerId || payload.ledger_id || '').trim()
    const kind = String(payload.kind || '').trim()
    const title = String(payload.title || '').trim()
    const amountHome = Number(payload.amount_home ?? payload.amountHome)
    const currencyHome = String(payload.currency_home || payload.currencyHome || 'USD').trim().toUpperCase()
    const date = parseDate(payload.date ? String(payload.date) : undefined) || new Date()
    const notes = payload.notes ? String(payload.notes) : null

    if (!ledgerId || !kind || !title || !Number.isFinite(amountHome)) {
      throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'Invalid transaction payload')
    }

    const row = await this.prisma.transactions.create({
      data: {
        id: randomId('txn'),
        ledger_id: ledgerId,
        kind,
        title,
        amount_home: amountHome,
        currency_home: currencyHome,
        date,
        notes,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      select: {
        id: true,
        ledger_id: true,
        kind: true,
        title: true,
        amount_home: true,
        currency_home: true,
        date: true,
        notes: true,
        is_deleted: true,
        created_at: true,
        updated_at: true
      }
    })

    return mapTransaction(row)
  }

  async updateTransaction(_: string, transactionId: string, payload: Record<string, unknown>): Promise<Transaction> {
    const existing = await this.getTransactionById('', transactionId)
    if (!existing || existing.is_deleted) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
    }

    const date = payload.date ? parseDate(String(payload.date)) : undefined
    const amount = payload.amount_home !== undefined || payload.amountHome !== undefined
      ? Number(payload.amount_home ?? payload.amountHome)
      : undefined
    if (amount !== undefined && !Number.isFinite(amount)) {
      throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'Invalid amount')
    }

    const row = await this.prisma.transactions.update({
      where: { id: transactionId },
      data: {
        ...(payload.ledgerId || payload.ledger_id ? { ledger_id: String(payload.ledgerId || payload.ledger_id) } : {}),
        ...(payload.kind ? { kind: String(payload.kind) } : {}),
        ...(payload.title ? { title: String(payload.title) } : {}),
        ...(amount !== undefined ? { amount_home: amount } : {}),
        ...(payload.currency_home || payload.currencyHome ? { currency_home: String(payload.currency_home || payload.currencyHome).toUpperCase() } : {}),
        ...(date ? { date } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes ? String(payload.notes) : null } : {}),
        updated_at: new Date()
      },
      select: {
        id: true,
        ledger_id: true,
        kind: true,
        title: true,
        amount_home: true,
        currency_home: true,
        date: true,
        notes: true,
        is_deleted: true,
        created_at: true,
        updated_at: true
      }
    })

    return mapTransaction(row)
  }

  async softDeleteTransaction(_: string, transactionId: string): Promise<{ id: string; deleted: true }> {
    const result = await this.prisma.transactions.updateMany({
      where: { id: transactionId, is_deleted: false },
      data: {
        is_deleted: true,
        updated_at: new Date()
      }
    })

    if (!result.count) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
    }

    return { id: transactionId, deleted: true }
  }

  async hardDeleteTransaction(_: string, transactionId: string): Promise<{ id: string; deleted: true; hard: true }> {
    const existing = await this.prisma.transactions.findUnique({
      where: { id: transactionId },
      select: { id: true }
    })
    if (!existing) {
      throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
    }

    await this.prisma.transactions.delete({ where: { id: transactionId } })
    return { id: transactionId, deleted: true, hard: true }
  }

  async getTransactionById(_: string, transactionId: string): Promise<Transaction | null> {
    const row = await this.prisma.transactions.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        ledger_id: true,
        kind: true,
        title: true,
        amount_home: true,
        currency_home: true,
        date: true,
        notes: true,
        is_deleted: true,
        created_at: true,
        updated_at: true
      }
    })

    return row ? mapTransaction(row) : null
  }
}
