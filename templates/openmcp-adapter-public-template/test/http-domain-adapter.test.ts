import { describe, expect, it } from 'vitest'
import { HttpDomainAdapter } from '../src/http-domain-adapter.js'

describe('HttpDomainAdapter', () => {
  it('sends listTransactions query with ledgerId', async () => {
    let capturedUrl = ''

    const adapter = new HttpDomainAdapter({
      baseUrl: 'https://adapter.example.com',
      fetchImpl: (async (input: RequestInfo | URL) => {
        capturedUrl = String(input)
        return {
          ok: true,
          json: async () => ({ items: [], total: 0, page: 1, pageSize: 50, hasMore: false })
        } as Response
      }) as typeof fetch
    })

    const result = await adapter.listTransactions('actor_demo', { ledgerId: 'ledger_main' })

    expect(capturedUrl).toContain('/transactions?')
    expect(capturedUrl).toContain('ledgerId=ledger_main')
    expect(result.total).toBe(0)
  })
})
