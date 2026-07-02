import { describe, expect, it } from 'vitest'
import { buildDemoApp } from '../src/app.js'

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` }
}

async function createIntent(app: Awaited<ReturnType<typeof buildDemoApp>>['app'], token: string, payload: Record<string, unknown>) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/agent/v1/intent',
    headers: bearer(token),
    payload
  })
  expect(response.statusCode).toBe(200)
  return response.json().data.certificate
}

describe('Intent governance runtime', () => {
  it('creates intent certificates and monotonically narrows manifest tools', async () => {
    const { app, bootstrap, runtime } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      const staticManifest = await app.inject({
        method: 'GET',
        url: '/api/agent/v1/manifest',
        headers: bearer(token)
      })
      expect(staticManifest.statusCode).toBe(200)
      const staticTools = new Set(staticManifest.json().data.tools.map((tool: any) => tool.name))

      const certificate = await createIntent(app, token, {
        request: 'Show recent transactions in ledger_main.',
        intentClasses: ['read'],
        confidence: 0.94,
        resourceBounds: { ledgerIds: ['ledger_main'] }
      })

      const narrowed = await app.inject({
        method: 'GET',
        url: `/api/agent/v1/manifest?intentCertificateId=${certificate.id}`,
        headers: bearer(token)
      })

      expect(narrowed.statusCode).toBe(200)
      const narrowedTools = narrowed.json().data.tools.map((tool: any) => tool.name)
      expect(narrowedTools).toContain('transaction.list')
      expect(narrowedTools).not.toContain('transaction.create')
      expect(narrowedTools).not.toContain('transaction.delete')
      expect(narrowedTools).not.toContain('transactions.export_csv')
      expect(narrowedTools.every((name: string) => staticTools.has(name))).toBe(true)

      const audit = runtime.audit.list().find((event) => event.action === 'agent.intent.manifest')
      expect(audit?.details?.intentCertificateId).toBe(certificate.id)
      expect(audit?.details?.visibleToolCount).toBeLessThan(audit?.details?.staticToolCount as number)
    } finally {
      await app.close()
    }
  })

  it('denies intent-tool mismatch with a stable reason code and audit binding', async () => {
    const { app, bootstrap, runtime } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      const certificate = await createIntent(app, token, {
        request: 'Show transaction txn_2.',
        intentClasses: ['read'],
        confidence: 0.95,
        resourceBounds: { transactionIds: ['txn_2'] }
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/agent/v1/actions',
        headers: bearer(token),
        payload: {
          action: 'transaction.delete',
          payload: { transactionId: 'txn_2' },
          intentCertificateId: certificate.id
        }
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().code).toBe('agent.intent_tool_mismatch')
      expect(runtime.store.drafts.size).toBe(0)
      expect(runtime.store.executions.size).toBe(0)

      const deniedAudit = runtime.audit.list().find((event) => event.code === 'agent.intent_tool_mismatch')
      expect(deniedAudit?.details?.intentCertificateId).toBe(certificate.id)
      expect(deniedAudit?.details?.intentClasses).toEqual(['read'])
      expect(deniedAudit?.details?.reason).toBe('tool_not_covered_by_intent')
    } finally {
      await app.close()
    }
  })

  it('denies payloads outside certificate resource bounds', async () => {
    const { app, bootstrap, runtime } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      const certificate = await createIntent(app, token, {
        request: 'Create one expense in ledger_main.',
        intentClasses: ['create'],
        confidence: 0.91,
        resourceBounds: { ledgerIds: ['ledger_main'] },
        effectBounds: { maxAmount: 100 }
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/agent/v1/actions',
        headers: bearer(token),
        payload: {
          action: 'transaction.create',
          payload: {
            ledgerId: 'ledger_other',
            kind: 'expense',
            title: 'Out-of-bound expense',
            amount_home: 25,
            currency_home: 'USD',
            date: '2026-02-01T00:00:00.000Z'
          },
          intentCertificateId: certificate.id
        }
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().code).toBe('agent.intent_payload_exceeds_bound')
      const deniedAudit = runtime.audit.list().find((event) => event.code === 'agent.intent_payload_exceeds_bound')
      expect(deniedAudit?.details?.intentCertificateId).toBe(certificate.id)
      expect(deniedAudit?.details?.reason).toBe('ledger_outside_intent_bound')
    } finally {
      await app.close()
    }
  })

  it('binds valid intent certificates into draft policy snapshots and audit events', async () => {
    const { app, bootstrap, runtime } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      const certificate = await createIntent(app, token, {
        request: 'Create one expense in ledger_main for stationery.',
        intentClasses: ['create'],
        confidence: 0.92,
        resourceBounds: { ledgerIds: ['ledger_main'] },
        effectBounds: { maxAmount: 100 }
      })

      const response = await app.inject({
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
          },
          intentCertificateId: certificate.id
        }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json().data
      expect(body.status).toBe('draft')
      expect(body.draft.policy_snapshot.intent.certificateId).toBe(certificate.id)
      expect(body.draft.policy_snapshot.intent.intentClasses).toEqual(['create'])

      const audit = runtime.audit.list().find((event) => event.action === 'agent.action.draft.created')
      expect(audit?.details?.intentCertificateId).toBe(certificate.id)
      expect(audit?.details?.intentDecision).toBe('allow')
    } finally {
      await app.close()
    }
  })

  it('routes high-risk intent execution to draft with intent review reason code', async () => {
    const { app, bootstrap, runtime } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      const certificate = await createIntent(app, token, {
        request: 'Delete duplicate transaction txn_2 after review.',
        intentClasses: ['delete'],
        confidence: 0.93,
        resourceBounds: { transactionIds: ['txn_2'] }
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/agent/v1/actions',
        headers: bearer(token),
        payload: {
          action: 'transaction.delete',
          payload: { transactionId: 'txn_2' },
          execute: true,
          justification: 'duplicate transaction',
          intentCertificateId: certificate.id
        }
      })

      expect(response.statusCode).toBe(200)
      const data = response.json().data
      expect(data.status).toBe('draft')
      expect(data.autoExecuteDeniedCode).toBe('agent.intent_review_required')
      expect(runtime.store.executions.size).toBe(0)
      expect(data.draft.policy_snapshot.intent.certificateId).toBe(certificate.id)
    } finally {
      await app.close()
    }
  })

  it('does not allow one key to reuse another key intent certificate', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token1 = String((bootstrap as any).token)
    const appId = String((bootstrap as any).app.id)

    try {
      const certificate = await createIntent(app, token1, {
        request: 'Show recent transactions.',
        intentClasses: ['read'],
        confidence: 0.94
      })

      const key2 = await app.inject({
        method: 'POST',
        url: `/api/agent-admin/v1/apps/${appId}/keys`,
        headers: { 'x-admin-user': 'admin_demo' },
        payload: { name: 'Key 2' }
      })
      expect(key2.statusCode).toBe(200)
      const token2 = key2.json().data.token

      const response = await app.inject({
        method: 'GET',
        url: `/api/agent/v1/manifest?intentCertificateId=${certificate.id}`,
        headers: bearer(token2)
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().code).toBe('agent.intent_not_found')
    } finally {
      await app.close()
    }
  })
})
