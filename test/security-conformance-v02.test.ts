import { describe, expect, it } from 'vitest'
import { buildDemoApp } from '../src/app.js'
import { InMemoryDomainAdapter } from '../packages/openport-core/src/domain.js'
import type { ListTransactionsInput, Transaction } from '../packages/openport-core/src/types.js'

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` }
}

function storeCounts(runtime: Awaited<ReturnType<typeof buildDemoApp>>['runtime']): Record<string, number> {
  return {
    audits: runtime.audit.list().length,
    drafts: runtime.store.drafts.size,
    executions: runtime.store.executions.size,
    preflights: runtime.store.preflights.size
  }
}

class CountingDomainAdapter extends InMemoryDomainAdapter {
  readonly calls = {
    listLedgers: 0,
    listTransactions: 0,
    createTransaction: 0,
    updateTransaction: 0,
    softDeleteTransaction: 0,
    hardDeleteTransaction: 0,
    getTransactionById: 0
  }

  async listLedgers(actorUserId: string) {
    this.calls.listLedgers += 1
    return super.listLedgers(actorUserId)
  }

  async listTransactions(actorUserId: string, input: ListTransactionsInput) {
    this.calls.listTransactions += 1
    return super.listTransactions(actorUserId, input)
  }

  async createTransaction(actorUserId: string, payload: Record<string, unknown>) {
    this.calls.createTransaction += 1
    return super.createTransaction(actorUserId, payload)
  }

  async updateTransaction(actorUserId: string, transactionId: string, payload: Record<string, unknown>): Promise<Transaction> {
    this.calls.updateTransaction += 1
    return super.updateTransaction(actorUserId, transactionId, payload)
  }

  async softDeleteTransaction(actorUserId: string, transactionId: string) {
    this.calls.softDeleteTransaction += 1
    return super.softDeleteTransaction(actorUserId, transactionId)
  }

  async hardDeleteTransaction(actorUserId: string, transactionId: string) {
    this.calls.hardDeleteTransaction += 1
    return super.hardDeleteTransaction(actorUserId, transactionId)
  }

  async getTransactionById(actorUserId: string, transactionId: string) {
    this.calls.getTransactionById += 1
    return super.getTransactionById(actorUserId, transactionId)
  }
}

describe('OpenPort Security Conformance Profile v0.2', () => {
  it('covers state witness execution-time revalidation with fail-closed no-side-effect behavior', async () => {
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

    const transaction = await runtime.domain.getTransactionById('svc_org_demo', 'txn_2')
    expect(transaction?.is_deleted).toBe(false)
    expect(runtime.store.executions.size).toBe(0)

    const deniedAudit = runtime.audit.list().find((event) => event.code === 'agent.precondition_failed')
    expect(deniedAudit).toMatchObject({
      app_id: (bootstrap as any).app.id,
      key_id: (bootstrap as any).key.id,
      draft_id: draftId,
      action: 'agent.action.execute',
      status: 'denied'
    })

    await app.close()
  })

  it('covers idempotency replay by retrying the same execute request 100 times with one execution effect', async () => {
    const { app, bootstrap, runtime } = await buildDemoApp()
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

    let replayCount = 0
    const executionIds = new Set<string>()

    for (let index = 0; index < 100; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/agent/v1/actions',
        headers: bearer(token),
        payload: {
          action: 'transaction.delete',
          preflightId: preflightData.preflightId,
          execute: true,
          justification: 'profile replay regression',
          idempotencyKey: 'security-profile-replay-1',
          preflightHash: preflightData.impactHash,
          stateWitnessHash: preflightData.stateWitnessHash
        }
      })

      expect(response.statusCode).toBe(200)
      const data = response.json().data
      expect(data.status).toBe('executed')
      if (data.replayed) replayCount += 1
      executionIds.add(String(data.execution.id))
    }

    expect(runtime.store.executions.size).toBe(1)
    expect(runtime.store.drafts.size).toBe(1)
    expect(executionIds.size).toBe(1)
    expect(replayCount).toBe(99)

    const replayAudits = runtime.audit.list().filter((event) => event.action === 'agent.action.idempotency_replay')
    expect(replayAudits).toHaveLength(99)

    await app.close()
  })

  it('covers endpoint 429 behavior with no draft, execution, audit, preflight, or adapter side effects', async () => {
    const domain = new CountingDomainAdapter()
    const { app, bootstrap, runtime } = await buildDemoApp({ domain })
    const token = String((bootstrap as any).token)

    for (let index = 0; index < 240; index += 1) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/agent/v1/manifest',
        headers: bearer(token)
      })
      expect(response.statusCode).toBe(200)
    }

    const beforeCounts = storeCounts(runtime)
    const beforeCalls = { ...domain.calls }

    const limited = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/actions',
      headers: bearer(token),
      payload: {
        action: 'transaction.create',
        payload: {
          ledgerId: 'ledger_main',
          kind: 'expense',
          title: 'Should not be created',
          amount_home: 10,
          currency_home: 'USD',
          date: '2026-02-01T00:00:00.000Z'
        }
      }
    })

    expect(limited.statusCode).toBe(429)
    expect(limited.json().code).toBe('agent.rate_limited')
    expect(storeCounts(runtime)).toEqual(beforeCounts)
    expect(domain.calls).toEqual(beforeCalls)

    await app.close()
  })

  it('covers audit completeness for authenticated allow, deny, and fail paths', async () => {
    const { app, bootstrap, runtime } = await buildDemoApp()
    const token = String((bootstrap as any).token)
    const appId = String((bootstrap as any).app.id)
    const keyId = String((bootstrap as any).key.id)

    const allow = await app.inject({
      method: 'GET',
      url: '/api/agent/v1/ledgers',
      headers: bearer(token)
    })
    expect(allow.statusCode).toBe(200)

    const deny = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/actions',
      headers: bearer(token),
      payload: {
        action: 'transaction.delete',
        payload: { transactionId: 'txn_2' },
        execute: true,
        justification: 'missing preflight and idempotency'
      }
    })
    expect(deny.statusCode).toBe(200)
    expect(deny.json().data.autoExecuteDeniedCode).toBe('agent.auto_execute_disabled')

    const failedDraft = await app.inject({
      method: 'POST',
      url: '/api/agent/v1/actions',
      headers: bearer(token),
      payload: {
        action: 'transaction.create',
        payload: {
          ledgerId: 'ledger_main',
          kind: 'expense',
          title: 'Invalid amount draft',
          amount_home: 'not-a-number',
          currency_home: 'USD',
          date: '2026-02-01T00:00:00.000Z'
        }
      }
    })
    expect(failedDraft.statusCode).toBe(200)
    const failedDraftId = failedDraft.json().data.draft.id

    const fail = await app.inject({
      method: 'POST',
      url: `/api/agent-admin/v1/drafts/${failedDraftId}/approve`,
      headers: { 'x-admin-user': 'admin_demo' },
      payload: { note: 'force adapter validation failure' }
    })
    expect(fail.statusCode).toBe(400)
    expect(fail.json().code).toBe('agent.action_invalid')

    const audits = runtime.audit.list()
    const allowAudit = audits.find((event) => event.action === 'agent.ledger.list' && event.status === 'success')
    expect(allowAudit).toMatchObject({
      app_id: appId,
      key_id: keyId,
      actor_user_id: 'svc_org_demo',
      status: 'success'
    })

    const denyAudit = audits.find((event) => event.code === 'agent.auto_execute_disabled')
    expect(denyAudit).toMatchObject({
      app_id: appId,
      key_id: keyId,
      actor_user_id: 'svc_org_demo',
      action: 'agent.action.draft.created',
      status: 'denied'
    })
    expect(denyAudit?.draft_id).toBeTruthy()

    const failAudit = audits.find((event) => event.action === 'agent.action.execute' && event.status === 'failed')
    expect(failAudit).toMatchObject({
      app_id: appId,
      key_id: keyId,
      actor_user_id: 'svc_org_demo',
      draft_id: failedDraftId,
      status: 'failed',
      code: 'agent.action_invalid'
    })
    expect(failAudit?.execution_id).toBeTruthy()

    await app.close()
  })
})
