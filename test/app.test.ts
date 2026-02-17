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
    const preflightData = preflight.json().data
    const preflightHash = preflightData.impactHash
    const preflightId = preflightData.preflightId
    const stateWitnessHash = preflightData.stateWitnessHash
    expect(typeof preflightId).toBe('string')
    expect(preflightId.length).toBeGreaterThan(6)
    expect(typeof stateWitnessHash).toBe('string')

    const executed = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/actions',
      headers: bearer(token),
      payload: {
        action: 'transaction.delete',
        preflightId,
        execute: true,
        justification: 'cleanup old item',
        idempotencyKey: 'idem-delete-1',
        preflightHash,
        stateWitnessHash
      }
    })

    expect(executed.statusCode).toBe(200)
    const executedPayload = executed.json()
    expect(executedPayload.data.status).toBe('executed')
    expect(executedPayload.data.execution.status).toBe('success')

    await app.close()
  })

  it('produces stable preflight hashes under payload key reordering', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    const payloadA = { transactionId: 'txn_2', meta: { a: 1, b: 2 }, tags: ['x', 'y'] }
    const payloadB = { tags: ['x', 'y'], meta: { b: 2, a: 1 }, transactionId: 'txn_2' }

    const preflight1 = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/preflight',
      headers: bearer(token),
      payload: { action: 'transaction.delete', payload: payloadA }
    })
    expect(preflight1.statusCode).toBe(200)

    const preflight2 = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/preflight',
      headers: bearer(token),
      payload: { action: 'transaction.delete', payload: payloadB }
    })
    expect(preflight2.statusCode).toBe(200)

    const a = preflight1.json().data
    const b = preflight2.json().data
    expect(a.impactHash).toBe(b.impactHash)
    expect(a.stateWitnessHash).toBe(b.stateWitnessHash)

    await app.close()
  })

  it('fails closed when state witness changes before approval', async () => {
    const { app, bootstrap, runtime } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    const draftResp = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/actions',
      headers: bearer(token),
      payload: {
        action: 'transaction.delete',
        payload: { transactionId: 'txn_2' }
      }
    })

    expect(draftResp.statusCode).toBe(200)
    const draftId = draftResp.json().data.draft.id

    await runtime.domain.updateTransaction('svc_org_demo', 'txn_2', { title: 'Changed before approval' })

    const approved = await app.inject({
      method: 'POST',
      url: `/api/agent-admin/v1/drafts/${draftId}/approve`,
      headers: { 'x-admin-user': 'admin_demo' },
      payload: { note: 'approve after state changed' }
    })

    expect(approved.statusCode).toBe(409)
    expect(approved.json().code).toBe('agent.precondition_failed')

    await app.close()
  })

  it('rejects preflightId reuse across keys', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token1 = String((bootstrap as any).token)
    const appId = String((bootstrap as any).app.id)

    const key2 = await app.inject({
      method: 'POST',
      url: `/api/agent-admin/v1/apps/${appId}/keys`,
      headers: { 'x-admin-user': 'admin_demo' },
      payload: { name: 'Key 2' }
    })
    expect(key2.statusCode).toBe(200)
    const token2 = key2.json().data.token

    const preflight = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/preflight',
      headers: bearer(token1),
      payload: { action: 'transaction.delete', payload: { transactionId: 'txn_1' } }
    })
    expect(preflight.statusCode).toBe(200)
    const preflightId = preflight.json().data.preflightId

    const attempt = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/actions',
      headers: bearer(token2),
      payload: {
        action: 'transaction.delete',
        preflightId,
        execute: false
      }
    })
    expect(attempt.statusCode).toBe(400)
    expect(attempt.json().code).toBe('agent.preflight_not_found')

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
