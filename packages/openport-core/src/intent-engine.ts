import { AuditService } from './audit.js'
import { ErrorCodes, type ErrorCode } from './error-codes.js'
import { OpenPortError } from './errors.js'
import { InMemoryStore } from './store.js'
import type { AgentManifestTool, AgentRequestContext, IntentCertificate, IntentClass, IntentReviewMode, ToolRisk } from './types.js'
import { sha256JcsHex } from './utils.js'

const VALID_INTENTS = new Set<IntentClass>([
  'read',
  'summarize',
  'transform',
  'create',
  'update',
  'delete',
  'export',
  'delegate',
  'admin',
  'unknown'
])

const LOW_CONFIDENCE_MAX = 0.5
const HIGH_CONFIDENCE_MIN = 0.8

export type CreateIntentInput = {
  request?: string
  intentClasses?: string[]
  confidence?: number
  resourceBounds?: Record<string, unknown>
  effectBounds?: Record<string, unknown>
  reviewMode?: IntentReviewMode
  classifierSource?: string
  expiresInSeconds?: number
}

export type IntentDecision = {
  certificate: IntentCertificate
  toolClass: IntentClass
  decision: 'allow' | 'deny' | 'review'
  code: ErrorCode | null
  reason: string
}

function uniqueIntentClasses(values: string[]): IntentClass[] {
  const classes: IntentClass[] = []
  for (const value of values) {
    const normalized = String(value).trim().toLowerCase() as IntentClass
    if (!VALID_INTENTS.has(normalized)) continue
    if (!classes.includes(normalized)) classes.push(normalized)
  }
  return classes.length > 0 ? classes : ['unknown']
}

function inferIntentClasses(request: string): IntentClass[] {
  const text = request.toLowerCase()
  const classes: IntentClass[] = []
  if (/\b(export|download|csv)\b/.test(text)) classes.push('export')
  if (/\b(delete|remove|destroy|revoke)\b/.test(text)) classes.push('delete')
  if (/\b(update|edit|fix|change)\b/.test(text)) classes.push('update')
  if (/\b(create|add|new)\b/.test(text)) classes.push('create')
  if (/\b(summarize|summary|compare|explain)\b/.test(text)) classes.push('summarize')
  if (/\b(show|list|read|find|inspect|view)\b/.test(text)) classes.push('read')
  return classes.length > 0 ? [...new Set(classes)] : ['unknown']
}

function deriveReviewMode(classes: IntentClass[], confidence: number, explicit?: IntentReviewMode): IntentReviewMode {
  if (explicit) return explicit
  if (classes.includes('unknown') || confidence < LOW_CONFIDENCE_MAX) return 'clarify'
  if (hasConflictingIntent(classes)) return 'deny'
  if (classes.some((intent) => intent === 'delete' || intent === 'export' || intent === 'admin' || intent === 'delegate')) return 'confirm'
  if (confidence < HIGH_CONFIDENCE_MIN) return 'preflight'
  if (classes.some((intent) => intent === 'create' || intent === 'update')) return 'draft'
  return 'allow'
}

function hasConflictingIntent(classes: IntentClass[]): boolean {
  const intents = new Set(classes)
  if (intents.has('unknown') && intents.size > 1) return true
  if (intents.has('read') && (intents.has('delete') || intents.has('export') || intents.has('admin'))) return true
  if (intents.has('summarize') && (intents.has('delete') || intents.has('export') || intents.has('admin'))) return true
  return false
}

function intentClassForTool(tool: AgentManifestTool): IntentClass {
  if (tool.name === 'ledger.list' || tool.name === 'transaction.list') return 'read'
  if (tool.name === 'transaction.create') return 'create'
  if (tool.name === 'transaction.update') return 'update'
  if (tool.name === 'transaction.delete' || tool.name === 'transaction.hard_delete') return 'delete'
  if (tool.name === 'transactions.export_csv') return 'export'
  return 'unknown'
}

function intentAllowsTool(classes: IntentClass[], toolClass: IntentClass): boolean {
  const intents = new Set(classes)
  if (intents.has('unknown')) return toolClass === 'read'
  if (intents.has(toolClass)) return true
  if (toolClass === 'read' && (intents.has('summarize') || intents.has('transform'))) return true
  return false
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) ? value.map((item) => String(item)) : null
}

function payloadString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (value === undefined || value === null) continue
    const str = String(value).trim()
    if (str) return str
  }
  return null
}

function payloadWithinBounds(certificate: IntentCertificate, payload: Record<string, unknown>): { ok: true } | { ok: false; reason: string } {
  const bounds = certificate.resource_bounds || {}
  const ledgerIds = stringArray(bounds.ledgerIds || bounds.ledger_ids)
  const transactionIds = stringArray(bounds.transactionIds || bounds.transaction_ids || bounds.ids)
  const ledgerId = payloadString(payload, ['ledgerId', 'ledger_id'])
  const transactionId = payloadString(payload, ['transactionId', 'transaction_id', 'id'])

  if (ledgerId && ledgerIds && !ledgerIds.includes(ledgerId)) {
    return { ok: false, reason: 'ledger_outside_intent_bound' }
  }

  if (transactionId && transactionIds && !transactionIds.includes(transactionId)) {
    return { ok: false, reason: 'transaction_outside_intent_bound' }
  }

  const maxRows = Number((certificate.effect_bounds || {}).maxRows || (certificate.effect_bounds || {}).max_rows || 0)
  const requestedRows = Number(payload.limit || payload.pageSize || 0)
  if (Number.isFinite(maxRows) && maxRows > 0 && requestedRows > maxRows) {
    return { ok: false, reason: 'row_limit_exceeds_intent_bound' }
  }

  const maxAmount = Number((certificate.effect_bounds || {}).maxAmount || (certificate.effect_bounds || {}).max_amount || 0)
  const requestedAmount = Number(payload.amount_home || payload.amount || 0)
  if (Number.isFinite(maxAmount) && maxAmount > 0 && Math.abs(requestedAmount) > maxAmount) {
    return { ok: false, reason: 'amount_exceeds_intent_bound' }
  }

  return { ok: true }
}

function publicCertificate(certificate: IntentCertificate): Record<string, unknown> {
  return {
    id: certificate.id,
    requestHash: certificate.request_hash,
    requestExcerpt: certificate.request_excerpt,
    intentClasses: certificate.intent_classes,
    resourceBounds: certificate.resource_bounds,
    effectBounds: certificate.effect_bounds,
    confidence: certificate.confidence,
    reviewMode: certificate.review_mode,
    classifierSource: certificate.classifier_source,
    auditDigest: certificate.audit_digest,
    expiresAt: certificate.expires_at
  }
}

export function intentAuditDetails(certificate: IntentCertificate | null, extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (!certificate) return extra
  return {
    ...extra,
    intentCertificateId: certificate.id,
    intentHash: certificate.request_hash,
    intentClasses: certificate.intent_classes,
    intentConfidence: certificate.confidence,
    intentReviewMode: certificate.review_mode,
    intentAuditDigest: certificate.audit_digest
  }
}

export class IntentEngine {
  constructor(
    private readonly store: InMemoryStore,
    private readonly audit: AuditService
  ) {}

  async createCertificate(ctx: AgentRequestContext, input: CreateIntentInput): Promise<Record<string, unknown>> {
    const request = String(input.request || '').trim()
    const explicitClasses = input.intentClasses ? uniqueIntentClasses(input.intentClasses) : null
    const intentClasses = explicitClasses || inferIntentClasses(request)
    const confidence = Number.isFinite(Number(input.confidence))
      ? Math.min(Math.max(Number(input.confidence), 0), 1)
      : explicitClasses ? 0.9 : intentClasses.includes('unknown') ? 0.3 : 0.7
    const reviewMode = deriveReviewMode(intentClasses, confidence, input.reviewMode)
    const requestHash = sha256JcsHex({ request, intentClasses, resourceBounds: input.resourceBounds || {}, effectBounds: input.effectBounds || {} })
    const auditDigest = sha256JcsHex({ requestHash, intentClasses, confidence, reviewMode })

    const certificate = this.store.saveIntentCertificate({
      app_id: ctx.app.id,
      key_id: ctx.key.id,
      actor_user_id: ctx.actorUserId,
      request_hash: requestHash,
      request_excerpt: request ? request.slice(0, 160) : null,
      intent_classes: intentClasses,
      resource_bounds: input.resourceBounds || {},
      effect_bounds: input.effectBounds || {},
      confidence,
      review_mode: reviewMode,
      classifier_source: String(input.classifierSource || (explicitClasses ? 'provided' : 'rule')).slice(0, 64),
      audit_digest: auditDigest,
      ttl_ms: input.expiresInSeconds ? Math.trunc(Number(input.expiresInSeconds) * 1000) : undefined
    })

    await this.audit.log({
      appId: ctx.app.id,
      keyId: ctx.key.id,
      actorUserId: ctx.actorUserId,
      performedByUserId: ctx.actorUserId,
      action: 'agent.intent.create',
      status: 'success',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      details: intentAuditDetails(certificate, { intentDecision: reviewMode })
    })

    return { certificate: publicCertificate(certificate) }
  }

  getCertificateForContext(ctx: AgentRequestContext, certificateId?: string | null): IntentCertificate | null {
    const id = certificateId?.trim()
    if (!id) return null
    const certificate = this.store.getIntentCertificate(id)
    if (!certificate) {
      throw new OpenPortError(400, ErrorCodes.AGENT_INTENT_NOT_FOUND, 'Intent certificate not found')
    }
    if (certificate.app_id !== ctx.app.id || certificate.key_id !== ctx.key.id || certificate.actor_user_id !== ctx.actorUserId) {
      throw new OpenPortError(400, ErrorCodes.AGENT_INTENT_NOT_FOUND, 'Intent certificate not found')
    }
    return certificate
  }

  filterManifest(certificate: IntentCertificate | null, tools: AgentManifestTool[]): AgentManifestTool[] {
    if (!certificate) return tools
    if (certificate.review_mode === 'deny' || certificate.confidence < LOW_CONFIDENCE_MAX || hasConflictingIntent(certificate.intent_classes)) {
      return tools.filter((tool) => tool.risk === 'low' && intentClassForTool(tool) === 'read')
    }
    return tools.filter((tool) => intentAllowsTool(certificate.intent_classes, intentClassForTool(tool)))
  }

  checkTool(certificate: IntentCertificate | null, tool: AgentManifestTool, opts: { payload?: Record<string, unknown>; execute?: boolean }): IntentDecision | null {
    if (!certificate) return null
    const toolClass = intentClassForTool(tool)

    if (hasConflictingIntent(certificate.intent_classes) || certificate.review_mode === 'deny') {
      return { certificate, toolClass, decision: 'deny', code: ErrorCodes.AGENT_INTENT_CONFLICTING, reason: 'conflicting_intent' }
    }

    if (certificate.confidence < LOW_CONFIDENCE_MAX || certificate.review_mode === 'clarify') {
      return { certificate, toolClass, decision: 'deny', code: ErrorCodes.AGENT_INTENT_LOW_CONFIDENCE, reason: 'low_confidence' }
    }

    if (!intentAllowsTool(certificate.intent_classes, toolClass)) {
      return { certificate, toolClass, decision: 'deny', code: ErrorCodes.AGENT_INTENT_TOOL_MISMATCH, reason: 'tool_not_covered_by_intent' }
    }

    if (opts.payload) {
      const bounds = payloadWithinBounds(certificate, opts.payload)
      if (!bounds.ok) {
        return { certificate, toolClass, decision: 'deny', code: ErrorCodes.AGENT_INTENT_PAYLOAD_EXCEEDS_BOUND, reason: bounds.reason }
      }
    }

    if (opts.execute && requiresReview(certificate, tool.risk)) {
      return { certificate, toolClass, decision: 'review', code: ErrorCodes.AGENT_INTENT_REVIEW_REQUIRED, reason: 'intent_requires_review' }
    }

    return { certificate, toolClass, decision: 'allow', code: null, reason: 'intent_consistent' }
  }
}

function requiresReview(certificate: IntentCertificate, risk: ToolRisk): boolean {
  if (certificate.review_mode === 'draft' || certificate.review_mode === 'preflight' || certificate.review_mode === 'confirm') return true
  return risk === 'high'
}
