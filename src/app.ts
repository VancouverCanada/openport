import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { AgentRequestContext } from './types.js'
import { createOpenMCPRuntime, type OpenMCPRuntime, type OpenMCPRuntimeOptions } from './runtime.js'
import { toErrorResponse } from './errors.js'

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

function getAgentContext(request: FastifyRequest, runtime: OpenMCPRuntime): AgentRequestContext {
  const headers = request.headers as Record<string, string | string[] | undefined>
  const ip = request.ip || '127.0.0.1'
  return runtime.auth.authenticate(headers, ip)
}

const listTransactionsSchema = z.object({
  ledgerId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
})

const actionBodySchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown()),
  execute: z.boolean().optional(),
  forceDraft: z.boolean().optional(),
  requestId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  justification: z.string().optional(),
  preflightHash: z.string().optional()
})

const preflightBodySchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown())
})

export function buildApp(runtime: OpenMCPRuntime = createOpenMCPRuntime()): FastifyInstance {
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

  app.get('/api/agent/v1/manifest', async (request, reply) => {
    return handle(reply, async () => {
      const ctx = getAgentContext(request, runtime)
      const data = runtime.agent.manifest(ctx)
      return success('common.success', data)
    })
  })

  app.get('/api/agent/v1/ledgers', async (request, reply) => {
    return handle(reply, async () => {
      const ctx = getAgentContext(request, runtime)
      const data = await runtime.agent.listLedgers(ctx)
      return success('common.success', data)
    })
  })

  app.get('/api/agent/v1/transactions', async (request, reply) => {
    return handle(reply, async () => {
      const ctx = getAgentContext(request, runtime)
      const parsed = listTransactionsSchema.parse(request.query)
      const data = await runtime.agent.listTransactions(ctx, parsed)
      return success('common.success', data)
    })
  })

  app.post('/api/agent/v1/preflight', async (request, reply) => {
    return handle(reply, async () => {
      const ctx = getAgentContext(request, runtime)
      const parsed = preflightBodySchema.parse(request.body)
      const data = await runtime.agent.preflight(ctx, parsed)
      return success('common.success', data)
    })
  })

  app.post('/api/agent/v1/actions', async (request, reply) => {
    return handle(reply, async () => {
      const ctx = getAgentContext(request, runtime)
      const parsed = actionBodySchema.parse(request.body)
      const data = await runtime.agent.createAction(ctx, parsed)
      return success('common.success', data)
    })
  })

  app.get('/api/agent/v1/drafts/:id', async (request, reply) => {
    return handle(reply, async () => {
      const ctx = getAgentContext(request, runtime)
      const params = z.object({ id: z.string().min(1) }).parse(request.params)
      const data = await runtime.agent.getDraft(ctx, params.id)
      return success('common.success', data)
    })
  })

  app.get('/api/agent-admin/v1/apps', async (request, reply) => {
    return handle(reply, async () => {
      getAdminUserId(request)
      return success('common.success', runtime.admin.listApps())
    })
  })

  app.post('/api/agent-admin/v1/apps', async (request, reply) => {
    return handle(reply, async () => {
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
      const data = runtime.admin.createApp(userId, body)
      return success('common.success', data)
    })
  })

  app.post('/api/agent-admin/v1/apps/:id/keys', async (request, reply) => {
    return handle(reply, async () => {
      const userId = getAdminUserId(request)
      const params = z.object({ id: z.string() }).parse(request.params)
      const body = z.object({ name: z.string().optional(), expiresAt: z.string().optional() }).parse(request.body)
      const data = runtime.admin.createKey(userId, params.id, body)
      return success('common.success', data)
    })
  })

  app.post('/api/agent-admin/v1/apps/:id/revoke', async (request, reply) => {
    return handle(reply, async () => {
      const userId = getAdminUserId(request)
      const params = z.object({ id: z.string() }).parse(request.params)
      const data = runtime.admin.revokeApp(userId, params.id)
      return success('common.success', data)
    })
  })

  app.post('/api/agent-admin/v1/keys/:id/revoke', async (request, reply) => {
    return handle(reply, async () => {
      const userId = getAdminUserId(request)
      const params = z.object({ id: z.string() }).parse(request.params)
      const data = runtime.admin.revokeKey(userId, params.id)
      return success('common.success', data)
    })
  })

  app.patch('/api/agent-admin/v1/apps/:id/policy', async (request, reply) => {
    return handle(reply, async () => {
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
      const data = runtime.admin.updatePolicy(userId, params.id, body)
      return success('common.success', data)
    })
  })

  app.patch('/api/agent-admin/v1/apps/:id/auto-execute', async (request, reply) => {
    return handle(reply, async () => {
      const userId = getAdminUserId(request)
      const params = z.object({ id: z.string() }).parse(request.params)
      const body = z.object({
        writes: z.object({ enabled: z.boolean().optional(), expires_at: z.string().nullable().optional(), allowed_actions: z.array(z.string()).nullable().optional() }).optional(),
        high_risk: z.object({
          enabled: z.boolean().optional(),
          expires_at: z.string().nullable().optional(),
          require_preflight: z.boolean().optional(),
          require_idempotency: z.boolean().optional(),
          max_export_rows: z.number().int().optional(),
          allowed_actions: z.array(z.string()).nullable().optional()
        }).optional()
      }).parse(request.body)
      const data = runtime.admin.updateAutoExecute(userId, params.id, body)
      return success('common.success', data)
    })
  })

  app.get('/api/agent-admin/v1/apps/:id/tools', async (request, reply) => {
    return handle(reply, async () => {
      getAdminUserId(request)
      const params = z.object({ id: z.string() }).parse(request.params)
      const data = runtime.admin.listAppTools(params.id)
      return success('common.success', data)
    })
  })

  app.get('/api/agent-admin/v1/drafts', async (request, reply) => {
    return handle(reply, async () => {
      getAdminUserId(request)
      const query = z.object({ appId: z.string().optional(), status: z.enum(['draft', 'confirmed', 'canceled', 'failed']).optional() }).parse(request.query)
      const data = runtime.admin.listDrafts(query)
      return success('common.success', data)
    })
  })

  app.get('/api/agent-admin/v1/drafts/:id', async (request, reply) => {
    return handle(reply, async () => {
      getAdminUserId(request)
      const params = z.object({ id: z.string() }).parse(request.params)
      const data = runtime.admin.getDraft(params.id)
      return success('common.success', data)
    })
  })

  app.post('/api/agent-admin/v1/drafts/:id/approve', async (request, reply) => {
    return handle(reply, async () => {
      const userId = getAdminUserId(request)
      const params = z.object({ id: z.string() }).parse(request.params)
      const body = z.object({ note: z.string().optional() }).parse(request.body)
      const data = await runtime.admin.approveDraft(userId, params.id, body.note)
      return success('common.success', data)
    })
  })

  app.post('/api/agent-admin/v1/drafts/:id/reject', async (request, reply) => {
    return handle(reply, async () => {
      const userId = getAdminUserId(request)
      const params = z.object({ id: z.string() }).parse(request.params)
      const body = z.object({ note: z.string().optional() }).parse(request.body)
      const data = runtime.admin.rejectDraft(userId, params.id, body.note)
      return success('common.success', data)
    })
  })

  app.get('/api/agent-admin/v1/audit', async (request, reply) => {
    return handle(reply, async () => {
      getAdminUserId(request)
      const data = runtime.admin.listAudit()
      return success('common.success', data)
    })
  })

  return app
}

async function handle(reply: FastifyReply, fn: () => Promise<unknown> | unknown): Promise<unknown> {
  const value = await fn()
  return reply.send(value)
}

export async function buildDemoApp(options: OpenMCPRuntimeOptions = {}): Promise<{ app: FastifyInstance; runtime: OpenMCPRuntime; bootstrap: Record<string, unknown> }> {
  const runtime = createOpenMCPRuntime(options)
  const app = buildApp(runtime)

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
