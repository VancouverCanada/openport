import { describe, expect, it } from 'vitest'
import { buildDemoApp } from '../src/app.js'
import { InMemoryDomainAdapter } from '../src/domain.js'

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` }
}

describe('security controls', () => {
  it('blocks cross-workspace ledger access', async () => {
    const domain = new InMemoryDomainAdapter({
      ledgers: [
        {
          id: 'ledger_main',
          name: 'Main Ledger',
          currency_home: 'USD',
          tz: 'America/Los_Angeles',
          organization_id: 'org_demo'
        },
        {
          id: 'ledger_other',
          name: 'Other Ledger',
          currency_home: 'USD',
          tz: 'America/New_York',
          organization_id: 'org_other'
        }
      ],
      transactions: []
    })

    const { app, bootstrap } = await buildDemoApp({ domain })
    const token = String((bootstrap as any).token)

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/agent/v1/transactions?ledgerId=ledger_other',
        headers: bearer(token)
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().code).toBe('agent.policy_denied')
    } finally {
      await app.close()
    }
  })

  it('blocks non-allowlisted IPs', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)
    const appId = String((bootstrap as any).app.id)

    try {
      const policyPatch = await app.inject({
        method: 'PATCH',
        url: `/api/agent-admin/v1/apps/${appId}/policy`,
        headers: { 'x-admin-user': 'admin_demo' },
        payload: { network: { allowed_ips: ['127.0.0.1'] } }
      })
      expect(policyPatch.statusCode).toBe(200)

      const denied = await app.inject({
        method: 'GET',
        url: '/api/agent/v1/manifest',
        headers: {
          ...bearer(token),
          'x-forwarded-for': '10.21.12.5'
        }
      })

      expect(denied.statusCode).toBe(403)
      expect(denied.json().code).toBe('agent.policy_denied')
    } finally {
      await app.close()
    }
  })

  it('blocks date ranges outside policy max_days', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)
    const appId = String((bootstrap as any).app.id)

    try {
      const policyPatch = await app.inject({
        method: 'PATCH',
        url: `/api/agent-admin/v1/apps/${appId}/policy`,
        headers: { 'x-admin-user': 'admin_demo' },
        payload: {
          data: {
            max_days: 7,
            allowed_ledger_ids: ['ledger_main']
          }
        }
      })
      expect(policyPatch.statusCode).toBe(200)

      const denied = await app.inject({
        method: 'GET',
        url: '/api/agent/v1/transactions?ledgerId=ledger_main&startDate=2025-01-01&endDate=2025-02-15',
        headers: bearer(token)
      })

      expect(denied.statusCode).toBe(403)
      expect(denied.json().code).toBe('agent.policy_denied')
    } finally {
      await app.close()
    }
  })
})
