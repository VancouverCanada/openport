import { describe, expect, it } from 'vitest'
import { buildDemoApp } from '../src/app.js'
import { RateLimiter } from '../src/rate-limit.js'

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` }
}

describe('security abuse controls', () => {
  it('rate limiter blocks when quota is exceeded', () => {
    const limiter = new RateLimiter()
    limiter.check('abuse:test', 2, 60_000)
    limiter.check('abuse:test', 2, 60_000)
    expect(() => limiter.check('abuse:test', 2, 60_000)).toThrowError(/Rate limit exceeded/)
  })

  it('rejects malformed action payload without 5xx', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/agent/v1/actions',
        headers: bearer(token),
        payload: {
          payload: { ledgerId: 'ledger_main' }
        }
      })

      expect(response.statusCode).toBe(400)
      expect(response.statusCode).not.toBe(500)
      const body = response.json()
      expect(body.ok).toBe(false)
    } finally {
      await app.close()
    }
  })
})
