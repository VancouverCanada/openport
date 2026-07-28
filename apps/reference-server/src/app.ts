import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import {
  createOpenPortRuntime,
  type AgentRequestContext,
  type OpenPortRuntime,
  type OpenPortRuntimeOptions,
  toErrorResponse
} from '@openport/core'
import { z } from 'zod'

function success<T>(code: string, data: T): { ok: true; code: string; data: T } {
  return { ok: true, code, data }
}

function getAdminUserId(request: FastifyRequest): string {
  const userId = String(request.headers['x-admin-user'] || '').trim()
  if (!userId) {
    throw new Error('x-admin-user header is required for admin routes')
  }
  return userId
}

function getAgentContext(request: FastifyRequest, runtime: OpenPortRuntime): AgentRequestContext {
  const headers = request.headers as Record<string, string | string[] | undefined>
  const ip = request.ip || '127.0.0.1'
  return runtime.auth.authenticate(headers, ip)
}

const listTransactionsSchema = z.object({
  ledgerId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  capabilityLeaseId: z.string().optional()
})

const manifestQuerySchema = z.object({
  capabilityLeaseId: z.string().optional()
})

const actionBodySchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  preflightId: z.string().optional(),
  execute: z.boolean().optional(),
  forceDraft: z.boolean().optional(),
  requestId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  justification: z.string().optional(),
  preflightHash: z.string().optional(),
  stateWitnessHash: z.string().optional(),
  intentCertificateId: z.string().optional(),
  contextRiskSnapshotId: z.string().optional(),
  sessionId: z.string().optional(),
  capabilityLeaseId: z.string().optional()
}).superRefine((value, ctx) => {
  const hasPayload = value.payload !== undefined
  const hasPreflightId = Boolean(value.preflightId && value.preflightId.trim())
  if (!hasPayload && !hasPreflightId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'payload or preflightId is required' })
  }
})

const preflightBodySchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown()),
  intentCertificateId: z.string().optional(),
  contextRiskSnapshotId: z.string().optional(),
  sessionId: z.string().optional(),
  capabilityLeaseId: z.string().optional()
})

const routeBodySchema = z.object({
  candidates: z.array(z.object({
    name: z.string().min(1).max(200),
    score: z.number().finite().optional()
  })).min(1).max(100),
  proposedToolName: z.string().min(1).max(200).optional(),
  requestId: z.string().max(200).optional(),
  intentCertificateId: z.string().optional(),
  contextRiskSnapshotId: z.string().optional(),
  sessionId: z.string().optional(),
  expiresInSeconds: z.number().int().min(10).max(120).optional()
})

const routeVerifyBodySchema = z.object({
  proposedToolName: z.string().min(1).max(200).optional()
})

const capabilityLeaseBodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  allowedTools: z.array(z.string().min(1).max(200)).min(1).max(100),
  allowedResourceIds: z.array(z.string().min(1).max(200)).max(500).optional(),
  allowedFields: z.array(z.string().min(1).max(100)).max(200).optional(),
  maxRows: z.number().int().min(0).max(5000).optional(),
  maxEffectAmount: z.number().min(0).max(1_000_000_000).optional(),
  maxCostUnits: z.number().min(0).max(1000).optional(),
  maxCalls: z.number().int().min(1).max(100).optional(),
  effectModeCeiling: z.enum(['read', 'draft', 'preflight', 'execute']).optional(),
  expiresInSeconds: z.number().int().min(10).max(3600).optional(),
  parentLeaseId: z.string().optional(),
  intentCertificateId: z.string().optional(),
  contextRiskSnapshotId: z.string().optional(),
  routeDecisionId: z.string().optional(),
  requestId: z.string().max(200).optional()
})

export function buildReferenceApp(runtime: OpenPortRuntime = createOpenPortRuntime()): FastifyInstance {
  const app = Fastify({ logger: false })

  app.addHook('onClose', async () => {
    if (typeof runtime.domain.close === 'function') {
      await runtime.domain.close()
    }
  })

  app.setErrorHandler((error, _request, reply) => {
    const parsed = toErrorResponse(error)
    reply.status(parsed.statusCode).send(parsed.payload)
  })

  app.get('/healthz', async () => success('common.success', { status: 'ok' }))

  app.get('/api/agent/v1/manifest', async (request, reply) => handle(reply, () => {
    const ctx = getAgentContext(request, runtime)
    const query = manifestQuerySchema.parse(request.query)
    return success('common.success', runtime.agent.manifest(ctx, query))
  }))

  app.post('/api/agent/v1/capability-leases', async (request, reply) => handle(reply, async () => {
    const ctx = getAgentContext(request, runtime)
    const parsed = capabilityLeaseBodySchema.parse(request.body)
    return success('common.success', await runtime.capabilityLease.createLease(ctx, parsed))
  }))

  app.get('/api/agent/v1/capability-leases/:id', async (request, reply) => handle(reply, () => {
    const ctx = getAgentContext(request, runtime)
    const params = z.object({ id: z.string().min(1) }).parse(request.params)
    return success('common.success', runtime.capabilityLease.getPublicLease(ctx, params.id))
  }))

  app.post('/api/agent/v1/capability-leases/:id/revoke', async (request, reply) => handle(reply, async () => {
    const ctx = getAgentContext(request, runtime)
    const params = z.object({ id: z.string().min(1) }).parse(request.params)
    return success('common.success', await runtime.capabilityLease.revokeLease(ctx, params.id))
  }))

  app.post('/api/agent/v1/routes', async (request, reply) => handle(reply, async () => {
    const ctx = getAgentContext(request, runtime)
    const parsed = routeBodySchema.parse(request.body)
    return success('common.success', await runtime.route.createRoute(ctx, parsed))
  }))

  app.post('/api/agent/v1/routes/:id/verify', async (request, reply) => handle(reply, async () => {
    const ctx = getAgentContext(request, runtime)
    const params = z.object({ id: z.string().min(1) }).parse(request.params)
    const parsed = routeVerifyBodySchema.parse(request.body || {})
    return success('common.success', await runtime.route.verifyRoute(ctx, params.id, parsed.proposedToolName))
  }))

  app.get('/api/agent/v1/ledgers', async (request, reply) => handle(reply, async () => {
    const ctx = getAgentContext(request, runtime)
    const query = z.object({ capabilityLeaseId: z.string().optional() }).parse(request.query)
    return success('common.success', await runtime.agent.listLedgers(ctx, query))
  }))

  app.get('/api/agent/v1/transactions', async (request, reply) => handle(reply, async () => {
    const ctx = getAgentContext(request, runtime)
    const parsed = listTransactionsSchema.parse(request.query)
    return success('common.success', await runtime.agent.listTransactions(ctx, parsed))
  }))

  app.post('/api/agent/v1/preflight', async (request, reply) => handle(reply, async () => {
    const ctx = getAgentContext(request, runtime)
    const parsed = preflightBodySchema.parse(request.body)
    return success('common.success', await runtime.agent.preflight(ctx, parsed))
  }))

  app.post('/api/agent/v1/actions', async (request, reply) => handle(reply, async () => {
    const ctx = getAgentContext(request, runtime)
    const parsed = actionBodySchema.parse(request.body)
    return success('common.success', await runtime.agent.createAction(ctx, parsed))
  }))

  app.get('/api/agent/v1/drafts/:id', async (request, reply) => handle(reply, async () => {
    const ctx = getAgentContext(request, runtime)
    const params = z.object({ id: z.string().min(1) }).parse(request.params)
    return success('common.success', await runtime.agent.getDraft(ctx, params.id))
  }))

  app.get('/api/agent-admin/v1/apps', async (request, reply) => handle(reply, () => {
    getAdminUserId(request)
    return success('common.success', runtime.admin.listApps())
  }))

  app.post('/api/agent-admin/v1/apps', async (request, reply) => handle(reply, () => {
    const userId = getAdminUserId(request)
    const body = z.object({
      scope: z.enum(['personal', 'workspace']),
      name: z.string().min(1),
      description: z.string().optional(),
      org_id: z.string().optional(),
      user_id: z.string().optional(),
      service_user_id: z.string().optional(),
      scopes: z.array(z.string()).optional()
    }).parse(request.body)
    return success('common.success', runtime.admin.createApp(userId, body))
  }))

  app.post('/api/agent-admin/v1/apps/:id/keys', async (request, reply) => handle(reply, () => {
    const userId = getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = z.object({ name: z.string().optional(), expiresAt: z.string().optional() }).parse(request.body)
    return success('common.success', runtime.admin.createKey(userId, params.id, body))
  }))

  app.post('/api/agent-admin/v1/apps/:id/revoke', async (request, reply) => handle(reply, () => {
    const userId = getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    return success('common.success', runtime.admin.revokeApp(userId, params.id))
  }))

  app.post('/api/agent-admin/v1/apps/:id/restore', async (request, reply) => handle(reply, () => {
    const userId = getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    return success('common.success', runtime.admin.restoreApp(userId, params.id))
  }))

  app.delete('/api/agent-admin/v1/apps/:id', async (request, reply) => handle(reply, () => {
    const userId = getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    return success('common.success', runtime.admin.deleteApp(userId, params.id))
  }))

  app.post('/api/agent-admin/v1/keys/:id/revoke', async (request, reply) => handle(reply, () => {
    const userId = getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    return success('common.success', runtime.admin.revokeKey(userId, params.id))
  }))

  app.patch('/api/agent-admin/v1/apps/:id/policy', async (request, reply) => handle(reply, () => {
    const userId = getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = z.object({
      network: z.object({ allowed_ips: z.array(z.string()).optional() }).optional(),
      data: z.object({
        allowed_ledger_ids: z.array(z.string()).optional(),
        allowed_org_ids: z.array(z.string()).optional(),
        max_days: z.number().int().optional(),
        allow_sensitive_fields: z.boolean().optional()
      }).optional()
    }).parse(request.body)
    return success('common.success', runtime.admin.updatePolicy(userId, params.id, body))
  }))

  app.patch('/api/agent-admin/v1/apps/:id/auto-execute', async (request, reply) => handle(reply, () => {
    const userId = getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = z.object({
      writes: z.object({
        enabled: z.boolean().optional(),
        expires_at: z.string().nullable().optional(),
        allowed_actions: z.array(z.string()).nullable().optional()
      }).optional(),
      high_risk: z.object({
        enabled: z.boolean().optional(),
        expires_at: z.string().nullable().optional(),
        require_preflight: z.boolean().optional(),
        require_idempotency: z.boolean().optional(),
        max_export_rows: z.number().int().optional(),
        allowed_actions: z.array(z.string()).nullable().optional()
      }).optional()
    }).parse(request.body)
    return success('common.success', runtime.admin.updateAutoExecute(userId, params.id, body))
  }))

  app.get('/api/agent-admin/v1/apps/:id/tools', async (request, reply) => handle(reply, () => {
    getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    return success('common.success', runtime.admin.listAppTools(params.id))
  }))

  app.get('/api/agent-admin/v1/drafts', async (request, reply) => handle(reply, () => {
    getAdminUserId(request)
    const query = z.object({
      appId: z.string().optional(),
      status: z.enum(['draft', 'confirmed', 'canceled', 'failed']).optional()
    }).parse(request.query)
    return success('common.success', runtime.admin.listDrafts(query))
  }))

  app.get('/api/agent-admin/v1/drafts/:id', async (request, reply) => handle(reply, () => {
    getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    return success('common.success', runtime.admin.getDraft(params.id))
  }))

  app.post('/api/agent-admin/v1/drafts/:id/approve', async (request, reply) => handle(reply, async () => {
    const userId = getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = z.object({ note: z.string().optional() }).parse(request.body)
    return success('common.success', await runtime.admin.approveDraft(userId, params.id, body.note))
  }))

  app.post('/api/agent-admin/v1/drafts/:id/reject', async (request, reply) => handle(reply, () => {
    const userId = getAdminUserId(request)
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = z.object({ note: z.string().optional() }).parse(request.body)
    return success('common.success', runtime.admin.rejectDraft(userId, params.id, body.note))
  }))

  app.get('/api/agent-admin/v1/audit', async (request, reply) => handle(reply, () => {
    getAdminUserId(request)
    return success('common.success', runtime.admin.listAudit())
  }))

  return app
}

async function handle(reply: FastifyReply, fn: () => Promise<unknown> | unknown): Promise<unknown> {
  const value = await fn()
  return reply.send(value)
}

export async function buildReferenceDemoApp(
  options: OpenPortRuntimeOptions = {}
): Promise<{ app: FastifyInstance; runtime: OpenPortRuntime; bootstrap: Record<string, unknown> }> {
  const runtime = createOpenPortRuntime(options)
  const app = buildReferenceApp(runtime)

  const bootstrap = runtime.admin.createApp('admin_demo', {
    scope: 'workspace',
    name: 'Demo Integration',
    description: 'Reference integration for local testing',
    org_id: 'org_demo',
    service_user_id: 'svc_org_demo',
    scopes: ['ledger.read', 'transaction.read', 'transaction.write', 'transaction.delete', 'transaction.export']
  })

  return {
    app,
    runtime,
    bootstrap
  }
}
