import { describe, expect, it } from 'vitest'
import { PrismaDomainAdapter, type OpenPortPrismaClient } from '../src/adapters/prisma-domain-adapter.js'

type LedgerRow = {
  id: string
  name: string
  currency_home: string
  tz: string
  organization_id: string | null
  is_deleted: boolean
  updated_at: Date
}

type TxRow = {
  id: string
  ledger_id: string
  kind: string
  title: string
  amount_home: number
  currency_home: string
  date: Date
  notes: string | null
  is_deleted: boolean
  created_at: Date
  updated_at: Date
}

class FakePrisma implements OpenPortPrismaClient {
  private ledgerRows: LedgerRow[]
  private txRows: TxRow[]

  constructor() {
    this.ledgerRows = [
      {
        id: 'l1',
        name: 'Main',
        currency_home: 'USD',
        tz: 'America/Los_Angeles',
        organization_id: 'org_demo',
        is_deleted: false,
        updated_at: new Date('2026-02-10T00:00:00.000Z')
      },
      {
        id: 'l2',
        name: 'Archived',
        currency_home: 'USD',
        tz: 'America/Los_Angeles',
        organization_id: 'org_demo',
        is_deleted: true,
        updated_at: new Date('2026-02-09T00:00:00.000Z')
      }
    ]

    this.txRows = [
      {
        id: 't1',
        ledger_id: 'l1',
        kind: 'expense',
        title: 'Subscription',
        amount_home: 50,
        currency_home: 'USD',
        date: new Date('2026-02-01T00:00:00.000Z'),
        notes: null,
        is_deleted: false,
        created_at: new Date('2026-02-01T00:00:00.000Z'),
        updated_at: new Date('2026-02-01T00:00:00.000Z')
      }
    ]
  }

  readonly ledgers = {
    findMany: async (_args: Record<string, unknown>) => {
      return this.ledgerRows.filter((row) => row.is_deleted === false)
    }
  }

  readonly transactions = {
    count: async (args: Record<string, unknown>) => {
      const where = (args.where || {}) as Record<string, unknown>
      return this.filterTx(where).length
    },
    findMany: async (args: Record<string, unknown>) => {
      const where = (args.where || {}) as Record<string, unknown>
      const skip = Number(args.skip || 0)
      const take = Number(args.take || 50)
      return this.filterTx(where)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(skip, skip + take)
    },
    findUnique: async (args: Record<string, unknown>) => {
      const where = (args.where || {}) as Record<string, unknown>
      const id = String(where.id || '')
      return this.txRows.find((row) => row.id === id) || null
    },
    create: async (args: Record<string, unknown>) => {
      const data = args.data as TxRow
      this.txRows.push(data)
      return data
    },
    update: async (args: Record<string, unknown>) => {
      const where = (args.where || {}) as Record<string, unknown>
      const id = String(where.id || '')
      const data = (args.data || {}) as Partial<TxRow>
      const row = this.txRows.find((item) => item.id === id)
      if (!row) throw new Error('missing')
      Object.assign(row, data)
      return row
    },
    updateMany: async (args: Record<string, unknown>) => {
      const where = (args.where || {}) as Record<string, unknown>
      const id = String(where.id || '')
      const wantNotDeleted = where.is_deleted === false
      const data = (args.data || {}) as Partial<TxRow>
      let count = 0
      for (const row of this.txRows) {
        if (row.id !== id) continue
        if (wantNotDeleted && row.is_deleted !== false) continue
        Object.assign(row, data)
        count += 1
      }
      return { count }
    },
    delete: async (args: Record<string, unknown>) => {
      const where = (args.where || {}) as Record<string, unknown>
      const id = String(where.id || '')
      const index = this.txRows.findIndex((row) => row.id === id)
      if (index < 0) throw new Error('missing')
      const [row] = this.txRows.splice(index, 1)
      return row
    }
  }

  async $disconnect(): Promise<void> {
    return
  }

  private filterTx(where: Record<string, unknown>): TxRow[] {
    return this.txRows.filter((row) => {
      if (where.ledger_id && row.ledger_id !== String(where.ledger_id)) return false
      if (where.is_deleted !== undefined && row.is_deleted !== Boolean(where.is_deleted)) return false
      const dateFilter = (where.date || {}) as Record<string, unknown>
      if (dateFilter.gte && row.date < new Date(String(dateFilter.gte))) return false
      if (dateFilter.lte && row.date > new Date(String(dateFilter.lte))) return false
      return true
    })
  }
}

describe('PrismaDomainAdapter', () => {
  it('lists non-deleted ledgers', async () => {
    const adapter = new PrismaDomainAdapter(new FakePrisma())
    const ledgers = await adapter.listLedgers('u1')
    expect(ledgers).toHaveLength(1)
    expect(ledgers[0].id).toBe('l1')
  })

  it('creates, updates, soft deletes and hard deletes transactions', async () => {
    const adapter = new PrismaDomainAdapter(new FakePrisma())

    const created = await adapter.createTransaction('u1', {
      ledgerId: 'l1',
      kind: 'expense',
      title: 'Printer paper',
      amount_home: 15,
      currency_home: 'USD',
      date: '2026-02-11T00:00:00.000Z'
    })
    expect(created.id).toBeTruthy()

    const updated = await adapter.updateTransaction('u1', created.id, { title: 'A4 printer paper', amount_home: 20 })
    expect(updated.title).toBe('A4 printer paper')
    expect(updated.amount_home).toBe(20)

    const soft = await adapter.softDeleteTransaction('u1', created.id)
    expect(soft.deleted).toBe(true)

    const hard = await adapter.hardDeleteTransaction('u1', created.id)
    expect(hard.hard).toBe(true)
  })
})
