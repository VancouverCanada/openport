import { describe, expect, it } from 'vitest'
import { buildDemoApp } from '../src/app.js'
import { InMemoryStore } from '../packages/openport-core/src/store.js'

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` }
}

describe('intent hardening', () => {
  it('removes revoked intent certificates from the active store view', async () => {
    const { app, bootstrap, runtime } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/agent/v1/intent',
        headers: bearer(token),
        payload: {
          request: 'Show recent ledger_main transactions.',
          intentClasses: ['read'],
          confidence: 0.95,
          resourceBounds: { ledgerIds: ['ledger_main'] }
        }
      })

      expect(response.statusCode).toBe(200)
      const certificateId = String(response.json().data.certificate.id)
      expect(runtime.store.getIntentCertificate(certificateId)?.id).toBe(certificateId)

      const revoked = runtime.store.revokeIntentCertificate(certificateId)
      expect(revoked?.revoked_at).toBeTruthy()
      expect(runtime.store.getIntentCertificate(certificateId)).toBeNull()
      expect(runtime.store.intentCertificates.has(certificateId)).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('sweeps expired and revoked ephemeral records', () => {
    const store = new InMemoryStore()
    const past = '2000-01-01T00:00:00.000Z'
    const future = '2099-01-01T00:00:00.000Z'

    store.preflights.set('pfl_old', {
      id: 'pfl_old',
      app_id: 'app_1',
      key_id: 'key_1',
      actor_user_id: 'usr_1',
      action_type: 'transaction.delete',
      payload: {},
      impact_hash: 'impact',
      state_witness: null,
      state_witness_hash: null,
      created_at: past,
      expires_at: past
    })
    store.preflights.set('pfl_new', {
      id: 'pfl_new',
      app_id: 'app_1',
      key_id: 'key_1',
      actor_user_id: 'usr_1',
      action_type: 'transaction.delete',
      payload: {},
      impact_hash: 'impact',
      state_witness: null,
      state_witness_hash: null,
      created_at: future,
      expires_at: future
    })

    store.intentCertificates.set('int_old', {
      id: 'int_old',
      app_id: 'app_1',
      key_id: 'key_1',
      actor_user_id: 'usr_1',
      request_hash: 'req_old',
      request_excerpt: 'old',
      intent_classes: ['read'],
      resource_bounds: {},
      effect_bounds: {},
      confidence: 0.9,
      review_mode: 'allow',
      classifier_source: 'test',
      audit_digest: 'dig_old',
      created_at: past,
      expires_at: past,
      revoked_at: null
    })
    store.intentCertificates.set('int_revoked', {
      id: 'int_revoked',
      app_id: 'app_1',
      key_id: 'key_1',
      actor_user_id: 'usr_1',
      request_hash: 'req_revoked',
      request_excerpt: 'revoked',
      intent_classes: ['read'],
      resource_bounds: {},
      effect_bounds: {},
      confidence: 0.9,
      review_mode: 'allow',
      classifier_source: 'test',
      audit_digest: 'dig_revoked',
      created_at: future,
      expires_at: future,
      revoked_at: past
    })
    store.intentCertificates.set('int_new', {
      id: 'int_new',
      app_id: 'app_1',
      key_id: 'key_1',
      actor_user_id: 'usr_1',
      request_hash: 'req_new',
      request_excerpt: 'new',
      intent_classes: ['read'],
      resource_bounds: {},
      effect_bounds: {},
      confidence: 0.9,
      review_mode: 'allow',
      classifier_source: 'test',
      audit_digest: 'dig_new',
      created_at: future,
      expires_at: future,
      revoked_at: null
    })

    store.stepUpSessions.set('sus_old', { id: 'sus_old', user_id: 'usr_1', code: '123456', expires_at: past, consumed_at: null })
    store.stepUpSessions.set('sus_new', { id: 'sus_new', user_id: 'usr_1', code: '654321', expires_at: future, consumed_at: null })
    store.stepUpTokens.set('sut_old', { id: 'sut_old', user_id: 'usr_1', expires_at: past })
    store.stepUpTokens.set('sut_new', { id: 'sut_new', user_id: 'usr_1', expires_at: future })

    expect(store.sweepExpired()).toEqual({
      removedPreflights: 1,
      removedIntentCertificates: 2,
      removedContextRiskSnapshots: 0,
      removedRouteDecisions: 0,
      removedCapabilityLeases: 0,
      removedStepUpSessions: 1,
      removedStepUpTokens: 1
    })

    expect(store.preflights.has('pfl_old')).toBe(false)
    expect(store.preflights.has('pfl_new')).toBe(true)
    expect(store.intentCertificates.has('int_old')).toBe(false)
    expect(store.intentCertificates.has('int_revoked')).toBe(false)
    expect(store.intentCertificates.has('int_new')).toBe(true)
    expect(store.stepUpSessions.has('sus_old')).toBe(false)
    expect(store.stepUpSessions.has('sus_new')).toBe(true)
    expect(store.stepUpTokens.has('sut_old')).toBe(false)
    expect(store.stepUpTokens.has('sut_new')).toBe(true)
  })

  it('chains audit events with stable hashes for tamper-evident sequencing', async () => {
    const { app, bootstrap, runtime } = await buildDemoApp()
    const token = String((bootstrap as any).token)

    try {
      const first = await app.inject({
        method: 'GET',
        url: '/api/agent/v1/manifest',
        headers: bearer(token)
      })
      expect(first.statusCode).toBe(200)

      const second = await app.inject({
        method: 'GET',
        url: '/api/agent/v1/ledgers',
        headers: bearer(token)
      })
      expect(second.statusCode).toBe(200)

      const events = runtime.audit.list().slice().reverse()
      expect(events.length).toBeGreaterThanOrEqual(2)
      for (let index = 0; index < events.length; index += 1) {
        expect(events[index].event_hash).toMatch(/^[a-f0-9]{64}$/)
        if (index === 0) {
          expect(events[index].prev_event_hash).toBeNull()
        } else {
          expect(events[index].prev_event_hash).toBe(events[index - 1].event_hash)
        }
      }
    } finally {
      await app.close()
    }
  })
})
