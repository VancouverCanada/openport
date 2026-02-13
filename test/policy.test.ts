import { describe, expect, it } from 'vitest'
import { resolveDateRange } from '../src/policy.js'
import type { AgentRequestContext } from '../src/types.js'

function ctx(maxDays: number): AgentRequestContext {
  return {
    app: {
      id: 'app_1',
      scope: 'personal',
      status: 'active',
      name: 'test',
      description: null,
      user_id: 'u1',
      org_id: null,
      service_user_id: null,
      scopes: ['transaction.read'],
      policy: {
        data: {
          max_days: maxDays,
          allow_sensitive_fields: true
        }
      },
      auto_execute: {},
      created_by: 'u1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    },
    key: {
      id: 'k1',
      app_id: 'app_1',
      name: 'k',
      token_prefix: 'x',
      token_hash: 'y',
      last_used_at: null,
      expires_at: null,
      revoked_at: null,
      created_by: 'u1',
      created_at: '2026-01-01T00:00:00.000Z'
    },
    actorUserId: 'u1',
    ip: null,
    userAgent: null
  }
}

describe('policy date range', () => {
  it('applies default range when max_days is configured', () => {
    const out = resolveDateRange(ctx(30), {
      now: new Date('2026-02-13T00:00:00.000Z')
    })

    expect(out.startDate).toBe('2026-01-14')
    expect(out.endDate).toBe('2026-02-13')
  })

  it('throws when requested range exceeds policy window', () => {
    expect(() => resolveDateRange(ctx(7), {
      startDate: '2026-01-01',
      endDate: '2026-02-01'
    })).toThrowError('Date range exceeds allowed window')
  })
})
