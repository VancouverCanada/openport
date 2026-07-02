import { describe, expect, it } from 'vitest'
import { buildDemoApp } from '../src/app.js'

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` }
}

function pseudoRandomString(seed: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_-'
  let v = seed * 9301 + 49297
  let out = ''
  for (let i = 0; i < 12; i += 1) {
    v = (v * 1103515245 + 12345) % 2147483647
    out += chars[v % chars.length]
  }
  return out
}

describe('fuzz http surface', () => {
  it('does not return 5xx for malformed-but-valid-json action requests', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      for (let i = 0; i < 40; i += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/agent/v1/actions',
          headers: bearer(token),
          payload: {
            action: pseudoRandomString(i),
            payload: {
              weird: pseudoRandomString(i + 1000),
              nested: { n: i, x: pseudoRandomString(i + 2000) }
            },
            execute: i % 2 === 0
          }
        })

        expect(response.statusCode).not.toBe(500)
      }
    } finally {
      await app.close()
    }
  })

  it('does not return 5xx for malformed transaction query combinations', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      for (let i = 0; i < 40; i += 1) {
        const ledgerId = encodeURIComponent(pseudoRandomString(i))
        const startDate = encodeURIComponent(`2026-99-${(i % 31) + 1}`)
        const endDate = encodeURIComponent(`xx-${pseudoRandomString(i + 3000)}`)
        const response = await app.inject({
          method: 'GET',
          url: `/api/agent/v1/transactions?ledgerId=${ledgerId}&startDate=${startDate}&endDate=${endDate}&page=-1&pageSize=abc`,
          headers: bearer(token)
        })

        expect(response.statusCode).not.toBe(500)
      }
    } finally {
      await app.close()
    }
  })

  it('does not return 5xx for malformed intent certificate inputs and invalid manifest bindings', async () => {
    const { app, bootstrap } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      const malformedBodies = [
        null,
        { request: 123, confidence: 'high' },
        { intentClasses: ['read', 'totally_invalid'], confidence: -10 },
        { intentClasses: 'read', resourceBounds: [] },
        { reviewMode: 'split', effectBounds: 'bad-shape' }
      ]

      for (const payload of malformedBodies) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/agent/v1/intent',
          headers: bearer(token),
          payload
        })
        expect(response.statusCode).toBeGreaterThanOrEqual(400)
        expect(response.statusCode).toBeLessThan(500)
      }

      for (let i = 0; i < 20; i += 1) {
        const response = await app.inject({
          method: 'GET',
          url: `/api/agent/v1/manifest?intentCertificateId=${encodeURIComponent(`bad-${pseudoRandomString(i)}`)}`,
          headers: bearer(token)
        })
        expect(response.statusCode).toBeGreaterThanOrEqual(400)
        expect(response.statusCode).toBeLessThan(500)
      }
    } finally {
      await app.close()
    }
  })
})
