import { describe, expect, it } from 'vitest'
import { buildDemoApp } from '../src/app.js'

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` }
}

describe('openmcp reference runtime', () => {
  it('exposes manifest for authenticated agent', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    const response = await app.inject({
      method: 'GET',
      url: '/api/agent/v1/manifest',
      headers: bearer(token)
    })

    expect(response.statusCode).toBe(200)
    const payload = response.json()
    expect(payload.ok).toBe(true)
    expect(Array.isArray(payload.data.tools)).toBe(true)
    expect(payload.data.tools.length).toBeGreaterThan(0)

    await app.close()
  })

  it('redacts sensitive fields when policy disables them', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)
    const appId = String((bootstrap as any).app.id)

    const policyPatch = await app.inject({
      method: 'PATCH',
      url: `/api/agent-admin/v1/apps/${appId}/policy`,
      headers: { 'x-admin-user': 'admin_demo' },
      payload: {
        data: {
          allow_sensitive_fields: false,
          allowed_ledger_ids: ['ledger_main']
        }
      }
    })

    expect(policyPatch.statusCode).toBe(200)

    const response = await app.inject({
      method: 'GET',
      url: '/api/agent/v1/transactions?ledgerId=ledger_main&page=1&pageSize=10',
      headers: bearer(token)
    })

    expect(response.statusCode).toBe(200)
    const payload = response.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.items[0].title).toBe('[redacted]')

    await app.close()
  })

  it('requires preflight for high-risk auto execute', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)
    const appId = String((bootstrap as any).app.id)

    const autoPatch = await app.inject({
      method: 'PATCH',
      url: `/api/agent-admin/v1/apps/${appId}/auto-execute`,
      headers: { 'x-admin-user': 'admin_demo' },
      payload: {
        high_risk: {
          enabled: true,
          expires_at: '2099-01-01T00:00:00.000Z',
          require_preflight: true,
          require_idempotency: true,
          allowed_actions: ['transaction.delete']
        }
      }
    })

    expect(autoPatch.statusCode).toBe(200)

    const denied = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/actions',
      headers: bearer(token),
      payload: {
        action: 'transaction.delete',
        payload: { transactionId: 'txn_2' },
        execute: true,
        justification: 'cleanup old item'
      }
    })

    expect(denied.statusCode).toBe(200)
    const deniedPayload = denied.json()
    expect(deniedPayload.data.status).toBe('draft')
    expect(deniedPayload.data.autoExecuteDeniedCode).toBe('agent.idempotency_required')

    const preflight = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/preflight',
      headers: bearer(token),
      payload: {
        action: 'transaction.delete',
        payload: { transactionId: 'txn_2' }
      }
    })

    expect(preflight.statusCode).toBe(200)
    const preflightHash = preflight.json().data.impactHash

    const executed = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/actions',
      headers: bearer(token),
      payload: {
        action: 'transaction.delete',
        payload: { transactionId: 'txn_2' },
        execute: true,
        justification: 'cleanup old item',
        idempotencyKey: 'idem-delete-1',
        preflightHash
      }
    })

    expect(executed.statusCode).toBe(200)
    const executedPayload = executed.json()
    expect(executedPayload.data.status).toBe('executed')
    expect(executedPayload.data.execution.status).toBe('success')

    await app.close()
  })

  it('approves draft via admin endpoint', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    const draftResp = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/actions',
      headers: bearer(token),
      payload: {
        action: 'transaction.create',
        payload: {
          ledgerId: 'ledger_main',
          kind: 'expense',
          title: 'Stationery',
          amount_home: 25,
          currency_home: 'USD',
          date: '2026-02-01T00:00:00.000Z'
        }
      }
    })

    expect(draftResp.statusCode).toBe(200)
    const draftId = draftResp.json().data.draft.id

    const approved = await app.inject({
      method: 'POST',
      url: `/api/agent-admin/v1/drafts/${draftId}/approve`,
      headers: { 'x-admin-user': 'admin_demo' },
      payload: { note: 'approved for test' }
    })

    expect(approved.statusCode).toBe(200)
    expect(approved.json().data.execution.status).toBe('success')

    await app.close()
  })

  it('revoked key is blocked immediately', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)
    const keyId = String((bootstrap as any).key.id)

    const revoke = await app.inject({
      method: 'POST',
      url: `/api/agent-admin/v1/keys/${keyId}/revoke`,
      headers: { 'x-admin-user': 'admin_demo' },
      payload: {}
    })

    expect(revoke.statusCode).toBe(200)

    const after = await app.inject({
      method: 'GET',
      url: '/api/agent/v1/manifest',
      headers: bearer(token)
    })

    expect(after.statusCode).toBe(401)
    expect(after.json().code).toBe('agent.token_invalid')

    await app.close()
  })
})
