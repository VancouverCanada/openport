import { ErrorCodes } from './error-codes.js'
import { OpenPortError } from './errors.js'
import type { AgentRequestContext } from './types.js'
import { parseDate } from './utils.js'

function toStringList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value)) return null
  const list = value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .slice(0, max)
  return list.length ? list : null
}

function toMaxDays(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(Math.max(Math.trunc(n), 1), 3650)
}

export type EffectiveDataPolicy = {
  allowedLedgerIds: string[] | null
  allowedOrgIds: string[] | null
  maxDays: number | null
  allowSensitiveFields: boolean
}

export function getDataPolicy(ctx: Pick<AgentRequestContext, 'app'>): EffectiveDataPolicy {
  const data = ctx.app.policy?.data || {}
  return {
    allowedLedgerIds: toStringList(data.allowed_ledger_ids, 500),
    allowedOrgIds: toStringList(data.allowed_org_ids, 200),
    maxDays: toMaxDays(data.max_days),
    allowSensitiveFields: data.allow_sensitive_fields !== false
  }
}

export function ensureScope(ctx: AgentRequestContext, requiredScopes: string[]): void {
  for (const scope of requiredScopes) {
    if (!ctx.app.scopes.includes(scope)) {
      throw new OpenPortError(403, ErrorCodes.AGENT_SCOPE_DENIED, 'Insufficient permissions')
    }
  }
}

export function ensureLedgerAllowed(ctx: AgentRequestContext, ledgerId: string): void {
  const policy = getDataPolicy(ctx)
  if (policy.allowedLedgerIds && !policy.allowedLedgerIds.includes(ledgerId)) {
    throw new OpenPortError(403, ErrorCodes.AGENT_POLICY_DENIED, 'Ledger not allowed for this integration')
  }
}

export function ensureOrgAllowed(ctx: AgentRequestContext, orgId: string): void {
  const policy = getDataPolicy(ctx)
  if (policy.allowedOrgIds && !policy.allowedOrgIds.includes(orgId)) {
    throw new OpenPortError(403, ErrorCodes.AGENT_POLICY_DENIED, 'Organization not allowed for this integration')
  }
}

export function resolveDateRange(ctx: AgentRequestContext, input: { startDate?: string; endDate?: string; now?: Date }): { startDate?: string; endDate?: string; start: Date | null; end: Date | null } {
  const policy = getDataPolicy(ctx)
  const start = parseDate(input.startDate, false)
  const end = parseDate(input.endDate, true)

  if (!policy.maxDays) {
    return {
      startDate: start ? input.startDate : undefined,
      endDate: end ? input.endDate : undefined,
      start,
      end
    }
  }

  const effectiveEnd = end || input.now || new Date()
  const effectiveStart = start || new Date(effectiveEnd.getTime() - policy.maxDays * 24 * 60 * 60 * 1000)

  if (effectiveStart.getTime() > effectiveEnd.getTime()) {
    throw new OpenPortError(400, ErrorCodes.AGENT_ACTION_INVALID, 'Invalid date range')
  }

  if (effectiveEnd.getTime() - effectiveStart.getTime() > policy.maxDays * 24 * 60 * 60 * 1000) {
    throw new OpenPortError(403, ErrorCodes.AGENT_POLICY_DENIED, 'Date range exceeds allowed window')
  }

  return {
    startDate: effectiveStart.toISOString().slice(0, 10),
    endDate: effectiveEnd.toISOString().slice(0, 10),
    start: effectiveStart,
    end: effectiveEnd
  }
}

export function ensureWorkspaceBoundary(ctx: AgentRequestContext, input: { ledgerOrgId: string | null; orgId: string | null }): void {
  if (ctx.app.scope !== 'workspace') return
  const appOrgId = ctx.app.org_id
  if (!appOrgId) {
    throw new OpenPortError(403, ErrorCodes.AGENT_FORBIDDEN, 'Agent app is misconfigured')
  }

  if (input.orgId && input.orgId !== appOrgId) {
    throw new OpenPortError(403, ErrorCodes.AGENT_POLICY_DENIED, 'Organization not allowed for this integration')
  }

  if (input.ledgerOrgId && input.ledgerOrgId !== appOrgId) {
    throw new OpenPortError(403, ErrorCodes.AGENT_POLICY_DENIED, 'Ledger not allowed for this integration')
  }
}
