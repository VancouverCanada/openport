import { OpenPortError } from './errors.js'
import { ErrorCodes } from './error-codes.js'
import { ensureLedgerAllowed, ensureScope, ensureWorkspaceBoundary, getDataPolicy, resolveDateRange } from './policy.js'
import type { AgentActionTool, AgentManifestTool, AgentRequestContext, DomainAdapter, Ledger } from './types.js'
import { csvEscape } from './utils.js'

function toLedgerOrgId(ledgers: Ledger[], ledgerId: string): string | null {
  const row = ledgers.find((ledger) => ledger.id === ledgerId)
  return row?.organization_id || null
}

function resolveTransactionId(payload: Record<string, unknown>): string {
  return String(payload.transactionId || payload.id || '').trim()
}

async function buildTransactionStateWitness(
  ctx: AgentRequestContext,
  payload: Record<string, unknown>,
  domain: DomainAdapter
): Promise<Record<string, unknown>> {
  const transactionId = resolveTransactionId(payload)
  if (!transactionId) {
    throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'transactionId required')
  }

  const existing = await domain.getTransactionById(ctx.actorUserId, transactionId)
  if (!existing) {
    return {
      kind: 'resource_version',
      resource: 'transaction',
      id: transactionId,
      exists: false
    }
  }

  return {
    kind: 'resource_version',
    resource: 'transaction',
    id: existing.id,
    ledger_id: existing.ledger_id,
    updated_at: existing.updated_at,
    is_deleted: existing.is_deleted
  }
}

function selectTransaction(row: Record<string, unknown>, allowSensitiveFields: boolean): { item: Record<string, unknown>; redactedFields: string[] } {
  const redactedFields: string[] = []
  const title = allowSensitiveFields ? row.title : (redactedFields.push('transaction.title'), '[redacted]')
  return {
    item: {
      id: row.id,
      ledger_id: row.ledger_id,
      kind: row.kind,
      title,
      amount_home: row.amount_home,
      currency_home: row.currency_home,
      date: row.date,
      notes: allowSensitiveFields ? row.notes : null,
      created_at: row.created_at,
      updated_at: row.updated_at
    },
    redactedFields
  }
}

export class AgentToolRegistry {
  private readonly readTools: AgentManifestTool[]
  private readonly actionTools: AgentActionTool[]
  private readonly actionByName = new Map<string, AgentActionTool>()

  constructor(private readonly domain: DomainAdapter) {
    this.readTools = [
      {
        name: 'ledger.list',
        description: 'List ledgers that this integration can access.',
        requiredScopes: ['ledger.read'],
        risk: 'low',
        requiresConfirmation: false,
        http: { method: 'GET', path: '/api/agent/v1/ledgers' },
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: { items: { type: 'array' } } }
      },
      {
        name: 'transaction.list',
        description: 'List transactions for a ledger, with optional date filters and pagination.',
        requiredScopes: ['transaction.read'],
        risk: 'low',
        requiresConfirmation: false,
        http: { method: 'GET', path: '/api/agent/v1/transactions' },
        inputSchema: {
          type: 'object',
          required: ['ledgerId'],
          properties: {
            ledgerId: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            page: { type: 'integer' },
            pageSize: { type: 'integer' }
          }
        },
        outputSchema: { type: 'object', properties: { items: { type: 'array' }, total: { type: 'integer' } } }
      }
    ]

    this.actionTools = [
      {
        kind: 'action',
        name: 'transaction.create',
        description: 'Create a new transaction.',
        requiredScopes: ['transaction.write'],
        risk: 'medium',
        requiresConfirmation: true,
        http: { method: 'POST', path: '/api/agent/v1/actions' },
        inputSchema: { type: 'object', required: ['payload'], properties: { payload: { type: 'object' } } },
        outputSchema: { type: 'object', properties: { transaction: { type: 'object' } } },
        execute: async (ctx, payload) => {
          const ledgerId = String(payload.ledgerId || payload.ledger_id || '').trim()
          if (!ledgerId) {
            throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'ledgerId required')
          }

          ensureLedgerAllowed(ctx, ledgerId)
          const ledgers = await this.domain.listLedgers(ctx.actorUserId)
          ensureWorkspaceBoundary(ctx, { ledgerOrgId: toLedgerOrgId(ledgers, ledgerId), orgId: null })

          const transaction = await this.domain.createTransaction(ctx.actorUserId, payload)
          return { transaction }
        }
      },
      {
        kind: 'action',
        name: 'transaction.update',
        description: 'Update an existing transaction.',
        requiredScopes: ['transaction.write'],
        risk: 'medium',
        requiresConfirmation: true,
        http: { method: 'POST', path: '/api/agent/v1/actions' },
        inputSchema: { type: 'object', required: ['payload'], properties: { payload: { type: 'object' } } },
        outputSchema: { type: 'object', properties: { transaction: { type: 'object' } } },
        execute: async (ctx, payload) => {
          const transactionId = resolveTransactionId(payload)
          if (!transactionId) {
            throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'transactionId required')
          }

          const existing = await this.domain.getTransactionById(ctx.actorUserId, transactionId)
          if (!existing) {
            throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
          }

          ensureLedgerAllowed(ctx, existing.ledger_id)
          const ledgers = await this.domain.listLedgers(ctx.actorUserId)
          ensureWorkspaceBoundary(ctx, { ledgerOrgId: toLedgerOrgId(ledgers, existing.ledger_id), orgId: null })

          const transaction = await this.domain.updateTransaction(ctx.actorUserId, transactionId, payload)
          return { transaction }
        },
        computeStateWitness: async (ctx, payload) => buildTransactionStateWitness(ctx, payload, this.domain)
      },
      {
        kind: 'action',
        name: 'transaction.delete',
        description: 'Soft delete a transaction.',
        requiredScopes: ['transaction.delete'],
        risk: 'high',
        requiresConfirmation: true,
        http: { method: 'POST', path: '/api/agent/v1/actions' },
        inputSchema: { type: 'object', required: ['payload'], properties: { payload: { type: 'object' } } },
        outputSchema: { type: 'object', properties: { deleted: { type: 'object' } } },
        computeImpact: async (ctx, payload) => {
          const transactionId = resolveTransactionId(payload)
          if (!transactionId) throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'transactionId required')
          const existing = await this.domain.getTransactionById(ctx.actorUserId, transactionId)
          if (!existing) throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')

          return {
            summary: 'Delete 1 transaction',
            transaction: {
              id: existing.id,
              ledger_id: existing.ledger_id,
              title: existing.title,
              amount_home: existing.amount_home,
              date: existing.date,
              is_deleted: existing.is_deleted
            }
          }
        },
        execute: async (ctx, payload) => {
          const transactionId = resolveTransactionId(payload)
          if (!transactionId) {
            throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'transactionId required')
          }
          const existing = await this.domain.getTransactionById(ctx.actorUserId, transactionId)
          if (!existing) {
            throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
          }

          ensureLedgerAllowed(ctx, existing.ledger_id)
          const ledgers = await this.domain.listLedgers(ctx.actorUserId)
          ensureWorkspaceBoundary(ctx, { ledgerOrgId: toLedgerOrgId(ledgers, existing.ledger_id), orgId: null })

          const deleted = await this.domain.softDeleteTransaction(ctx.actorUserId, transactionId)
          return { deleted }
        },
        computeStateWitness: async (ctx, payload) => buildTransactionStateWitness(ctx, payload, this.domain)
      },
      {
        kind: 'action',
        name: 'transaction.hard_delete',
        description: 'Permanently delete a transaction.',
        requiredScopes: ['transaction.delete'],
        risk: 'high',
        requiresConfirmation: true,
        http: { method: 'POST', path: '/api/agent/v1/actions' },
        inputSchema: { type: 'object', required: ['payload'], properties: { payload: { type: 'object' } } },
        outputSchema: { type: 'object', properties: { deleted: { type: 'object' } } },
        computeImpact: async (ctx, payload) => {
          const transactionId = resolveTransactionId(payload)
          if (!transactionId) throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'transactionId required')
          const existing = await this.domain.getTransactionById(ctx.actorUserId, transactionId)
          if (!existing) throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
          return {
            summary: 'Hard delete 1 transaction',
            transaction: {
              id: existing.id,
              ledger_id: existing.ledger_id,
              title: existing.title,
              amount_home: existing.amount_home,
              date: existing.date,
              is_deleted: existing.is_deleted
            }
          }
        },
        execute: async (ctx, payload) => {
          const transactionId = resolveTransactionId(payload)
          if (!transactionId) {
            throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'transactionId required')
          }

          const existing = await this.domain.getTransactionById(ctx.actorUserId, transactionId)
          if (!existing) {
            throw new OpenPortError(404, ErrorCodes.AGENT_NOT_FOUND, 'Transaction not found')
          }

          ensureLedgerAllowed(ctx, existing.ledger_id)
          const ledgers = await this.domain.listLedgers(ctx.actorUserId)
          ensureWorkspaceBoundary(ctx, { ledgerOrgId: toLedgerOrgId(ledgers, existing.ledger_id), orgId: null })

          const deleted = await this.domain.hardDeleteTransaction(ctx.actorUserId, transactionId)
          return { deleted }
        },
        computeStateWitness: async (ctx, payload) => buildTransactionStateWitness(ctx, payload, this.domain)
      },
      {
        kind: 'action',
        name: 'transactions.export_csv',
        description: 'Export transactions as CSV.',
        requiredScopes: ['transaction.read', 'transaction.export'],
        risk: 'high',
        requiresConfirmation: true,
        http: { method: 'POST', path: '/api/agent/v1/actions' },
        inputSchema: { type: 'object', required: ['payload'], properties: { payload: { type: 'object' } } },
        outputSchema: { type: 'object', properties: { export: { type: 'object' } } },
        computeImpact: async (ctx, payload) => {
          const ledgerId = String(payload.ledgerId || payload.ledger_id || '').trim()
          if (!ledgerId) throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'ledgerId required')

          ensureLedgerAllowed(ctx, ledgerId)
          const ledgers = await this.domain.listLedgers(ctx.actorUserId)
          ensureWorkspaceBoundary(ctx, { ledgerOrgId: toLedgerOrgId(ledgers, ledgerId), orgId: null })

          const range = resolveDateRange(ctx, {
            startDate: payload.startDate ? String(payload.startDate) : undefined,
            endDate: payload.endDate ? String(payload.endDate) : undefined
          })

          return {
            summary: 'Export transactions as CSV',
            export: {
              ledgerId,
              startDate: range.startDate || null,
              endDate: range.endDate || null,
              requestedLimit: Number(payload.limit || 0) || null
            }
          }
        },
        execute: async (ctx, payload) => {
          const ledgerId = String(payload.ledgerId || payload.ledger_id || '').trim()
          if (!ledgerId) throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'ledgerId required')

          ensureLedgerAllowed(ctx, ledgerId)
          const ledgers = await this.domain.listLedgers(ctx.actorUserId)
          ensureWorkspaceBoundary(ctx, { ledgerOrgId: toLedgerOrgId(ledgers, ledgerId), orgId: null })

          const range = resolveDateRange(ctx, {
            startDate: payload.startDate ? String(payload.startDate) : undefined,
            endDate: payload.endDate ? String(payload.endDate) : undefined
          })

          const policy = getDataPolicy(ctx)
          const limit = Math.max(Math.min(Number(payload.limit || 200), 5000), 1)

          const list = await this.domain.listTransactions(ctx.actorUserId, {
            ledgerId,
            startDate: range.startDate,
            endDate: range.endDate,
            page: 1,
            pageSize: limit
          })

          const rows = list.items
          const header = ['id', 'date', 'kind', 'title', 'amount_home', 'currency_home', 'created_at', 'updated_at']
          const lines = [header.join(',')]

          for (const row of rows) {
            lines.push([
              csvEscape(row.id),
              csvEscape(row.date),
              csvEscape(row.kind),
              csvEscape(policy.allowSensitiveFields ? row.title : ''),
              csvEscape(row.amount_home),
              csvEscape(row.currency_home),
              csvEscape(row.created_at),
              csvEscape(row.updated_at)
            ].join(','))
          }

          return {
            export: {
              format: 'csv',
              ledgerId,
              rowCount: rows.length,
              csv: lines.join('\n')
            }
          }
        }
      }
    ]

    for (const tool of this.actionTools) {
      this.actionByName.set(tool.name, tool)
    }
  }

  listManifestTools(ctx: AgentRequestContext): AgentManifestTool[] {
    return [...this.readTools, ...this.actionTools].filter((tool) => {
      try {
        ensureScope(ctx, tool.requiredScopes)
        return true
      } catch {
        return false
      }
    })
  }

  listActionTools(ctx: AgentRequestContext): AgentActionTool[] {
    return this.actionTools.filter((tool) => {
      try {
        ensureScope(ctx, tool.requiredScopes)
        return true
      } catch {
        return false
      }
    })
  }

  getActionTool(name: string): AgentActionTool | null {
    return this.actionByName.get(name.trim()) || null
  }

  presentTransaction(row: Record<string, unknown>, ctx: AgentRequestContext): { item: Record<string, unknown>; redactedFields: string[] } {
    const policy = getDataPolicy(ctx)
    return selectTransaction(row, policy.allowSensitiveFields)
  }
}
