import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SqliteAuditSink,
  SqliteCapabilityLeaseStore,
  type SqliteCapabilityLeaseFaultPoint
} from '../packages/openport-core/src/index.js'
import { buildApp, buildDemoApp } from '../src/app.js'
import { createOpenPortRuntime } from '../src/runtime.js'

const roots: string[] = []

function fixturePaths(): { root: string; state: string; audit: string } {
  const root = mkdtempSync(join(tmpdir(), 'openport-durable-lease-'))
  roots.push(root)
  return {
    root,
    state: join(root, 'lease-state.sqlite'),
    audit: join(root, 'audit.sqlite')
  }
}

function bearer(token: string): Record<string, string> {
  return { authorization: 'Bearer ' + token }
}

const actionPayload = {
  ledgerId: 'ledger_main',
  kind: 'expense',
  title: 'Durable lease action',
  amount_home: 25,
  currency_home: 'USD',
  date: '2026-07-13T00:00:00.000Z'
}

const actionFields = ['kind', 'title', 'amount_home', 'currency_home', 'date']

async function createLease(
  app: Awaited<ReturnType<typeof buildDemoApp>>['app'],
  token: string,
  overrides: Record<string, unknown> = {}
): Promise<Record<string, any>> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/agent/v1/capability-leases',
    headers: bearer(token),
    payload: {
      sessionId: 'durable-reference-session',
      allowedTools: ['transaction.create'],
      allowedResourceIds: ['ledger_main'],
      allowedFields: actionFields,
      maxRows: 1,
      maxEffectAmount: 100,
      maxCostUnits: 1,
      maxCalls: 1,
      effectModeCeiling: 'draft',
      ...overrides
    }
  })
  expect(response.statusCode).toBe(200)
  return response.json().data.lease
}

async function submit(
  app: Awaited<ReturnType<typeof buildDemoApp>>['app'],
  token: string,
  leaseId: string,
  idempotencyKey: string,
  title = actionPayload.title
) {
  return app.inject({
    method: 'POST',
    url: '/api/agent/v1/actions',
    headers: bearer(token),
    payload: {
      action: 'transaction.create',
      payload: { ...actionPayload, title },
      capabilityLeaseId: leaseId,
      requestId: idempotencyKey,
      idempotencyKey
    }
  })
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

describe('durable capability lease reference path', () => {
  it('atomically persists consumption, idempotency, and minimized audit evidence', async () => {
    const paths = fixturePaths()
    const leaseState = await SqliteCapabilityLeaseStore.open(paths.state)
    const auditSink = await SqliteAuditSink.open(paths.audit)
    const { app, bootstrap, runtime } = await buildDemoApp({
      capabilityLeaseStateStore: leaseState,
      auditSink
    })
    const token = String((bootstrap as any).token)
    try {
      const lease = await createLease(app, token)
      const response = await submit(app, token, lease.id, 'durable-clean-1')

      expect(response.statusCode).toBe(200)
      expect(response.json().data.capabilityLease.limits).toMatchObject({
        remainingCalls: 0,
        remainingCostUnits: 0
      })
      expect(leaseState.outboxSnapshot()).toEqual({
        total: 1,
        pending: 0,
        idempotencyRows: 1
      })
      const durableEvents = runtime.audit.list().filter((event) => event.id.startsWith('laud_'))
      expect(durableEvents).toHaveLength(1)
      expect(durableEvents[0].request_id).toBeNull()
      expect(durableEvents[0].details).toMatchObject({
        decision: 'allow',
        consumed: true,
        rawTaskStored: false,
        rawPolicyStored: false,
        rawRequestStored: false
      })
    } finally {
      await app.close()
      leaseState.close()
      auditSink.close()
    }
  })

  for (const point of [
    'after_lease_update_before_outbox',
    'after_outbox_before_commit'
  ] satisfies SqliteCapabilityLeaseFaultPoint[]) {
    it('rolls back the integrated transaction at ' + point, async () => {
      const paths = fixturePaths()
      let activeFault: SqliteCapabilityLeaseFaultPoint | null = point
      const leaseState = await SqliteCapabilityLeaseStore.open(paths.state, {
        faultInjector: (candidate) => {
          if (candidate === activeFault) throw new Error('injected ' + candidate)
        }
      })
      const auditSink = await SqliteAuditSink.open(paths.audit)
      const { app, bootstrap } = await buildDemoApp({
        capabilityLeaseStateStore: leaseState,
        auditSink
      })
      const token = String((bootstrap as any).token)
      try {
        const lease = await createLease(app, token)
        const failed = await submit(app, token, lease.id, 'durable-rollback-' + point)
        expect(failed.statusCode).toBe(500)
        expect(leaseState.getCapabilityLease(lease.id)).toMatchObject({
          remaining_calls: 1,
          remaining_cost_units: 1,
          version: 1
        })
        expect(leaseState.outboxSnapshot()).toEqual({
          total: 0,
          pending: 0,
          idempotencyRows: 0
        })

        activeFault = null
        const retry = await submit(app, token, lease.id, 'durable-rollback-' + point)
        expect(retry.statusCode).toBe(200)
        expect(leaseState.getCapabilityLease(lease.id)).toMatchObject({
          remaining_calls: 0,
          remaining_cost_units: 0,
          version: 2
        })
      } finally {
        await app.close()
        leaseState.close()
        auditSink.close()
      }
    })
  }

  it('replays a commit-before-response failure without consuming twice', async () => {
    const paths = fixturePaths()
    let activeFault: SqliteCapabilityLeaseFaultPoint | null = 'after_commit_before_return'
    const leaseState = await SqliteCapabilityLeaseStore.open(paths.state, {
      faultInjector: (candidate) => {
        if (candidate === activeFault) throw new Error('injected ' + candidate)
      }
    })
    const auditSink = await SqliteAuditSink.open(paths.audit)
    const { app, bootstrap } = await buildDemoApp({
      capabilityLeaseStateStore: leaseState,
      auditSink
    })
    const token = String((bootstrap as any).token)
    try {
      const lease = await createLease(app, token)
      const failed = await submit(app, token, lease.id, 'durable-postcommit-1')
      expect(failed.statusCode).toBe(500)
      expect(leaseState.getCapabilityLease(lease.id)).toMatchObject({
        remaining_calls: 0,
        remaining_cost_units: 0,
        version: 2
      })
      expect(leaseState.outboxSnapshot()).toEqual({
        total: 1,
        pending: 1,
        idempotencyRows: 1
      })

      activeFault = null
      const retry = await submit(app, token, lease.id, 'durable-postcommit-1')
      expect(retry.statusCode).toBe(200)
      expect(retry.json().data.capabilityLease.limits.remainingCalls).toBe(0)
      expect(leaseState.getCapabilityLease(lease.id)).toMatchObject({ version: 2 })
      expect(leaseState.outboxSnapshot()).toEqual({
        total: 1,
        pending: 0,
        idempotencyRows: 1
      })
    } finally {
      await app.close()
      leaseState.close()
      auditSink.close()
    }
  })

  for (const point of [
    'before_mark_delivered',
    'after_mark_before_commit'
  ] satisfies SqliteCapabilityLeaseFaultPoint[]) {
    it('deduplicates durable audit recovery at ' + point, async () => {
      const paths = fixturePaths()
      let activeFault: SqliteCapabilityLeaseFaultPoint | null = point
      const leaseState = await SqliteCapabilityLeaseStore.open(paths.state, {
        faultInjector: (candidate) => {
          if (candidate === activeFault) throw new Error('injected ' + candidate)
        }
      })
      const auditSink = await SqliteAuditSink.open(paths.audit)
      const { app, bootstrap, runtime } = await buildDemoApp({
        capabilityLeaseStateStore: leaseState,
        auditSink
      })
      const token = String((bootstrap as any).token)
      try {
        const lease = await createLease(app, token)
        const failed = await submit(app, token, lease.id, 'durable-delivery-' + point)
        expect(failed.statusCode).toBe(500)
        expect(leaseState.outboxSnapshot().pending).toBe(1)
        expect(runtime.audit.list().filter((event) => event.id.startsWith('laud_'))).toHaveLength(1)

        activeFault = null
        expect(await runtime.capabilityLease.flushDurableAuditOutbox()).toBe(1)
        expect(leaseState.outboxSnapshot().pending).toBe(0)
        expect(runtime.audit.list().filter((event) => event.id.startsWith('laud_'))).toHaveLength(1)
      } finally {
        await app.close()
        leaseState.close()
        auditSink.close()
      }
    })
  }

  it('reopens durable lease and audit state across runtime reconstruction', async () => {
    const paths = fixturePaths()
    const leaseState1 = await SqliteCapabilityLeaseStore.open(paths.state)
    const auditSink1 = await SqliteAuditSink.open(paths.audit)
    const first = await buildDemoApp({
      capabilityLeaseStateStore: leaseState1,
      auditSink: auditSink1
    })
    const token = String((first.bootstrap as any).token)
    const lease = await createLease(first.app, token, { maxCalls: 2, maxCostUnits: 2 })
    await first.app.close()
    leaseState1.close()
    auditSink1.close()

    const leaseState2 = await SqliteCapabilityLeaseStore.open(paths.state, { initialize: false })
    const auditSink2 = await SqliteAuditSink.open(paths.audit, { initialize: false })
    const runtime2 = createOpenPortRuntime({
      store: first.runtime.store,
      domain: first.runtime.domain,
      capabilityLeaseStateStore: leaseState2,
      auditSink: auditSink2
    })
    const app2 = buildApp(runtime2)
    try {
      const manifest = await app2.inject({
        method: 'GET',
        url: '/api/agent/v1/manifest?capabilityLeaseId=' + lease.id,
        headers: bearer(token)
      })
      expect(manifest.statusCode).toBe(200)
      const revoke = await app2.inject({
        method: 'POST',
        url: '/api/agent/v1/capability-leases/' + lease.id + '/revoke',
        headers: bearer(token)
      })
      expect(revoke.statusCode).toBe(200)
    } finally {
      await app2.close()
      leaseState2.close()
      auditSink2.close()
    }

    const leaseState3 = await SqliteCapabilityLeaseStore.open(paths.state, { initialize: false })
    const auditSink3 = await SqliteAuditSink.open(paths.audit, { initialize: false })
    const runtime3 = createOpenPortRuntime({
      store: first.runtime.store,
      domain: first.runtime.domain,
      capabilityLeaseStateStore: leaseState3,
      auditSink: auditSink3
    })
    const app3 = buildApp(runtime3)
    try {
      const denied = await app3.inject({
        method: 'GET',
        url: '/api/agent/v1/manifest?capabilityLeaseId=' + lease.id,
        headers: bearer(token)
      })
      expect(denied.statusCode).toBe(409)
      expect(denied.json().code).toBe('agent.lease_revoked')
    } finally {
      await app3.close()
      leaseState3.close()
      auditSink3.close()
    }
  })

  it('admits exactly one of 32 distinct durable action proposals', async () => {
    const paths = fixturePaths()
    const leaseState = await SqliteCapabilityLeaseStore.open(paths.state)
    const auditSink = await SqliteAuditSink.open(paths.audit)
    const { app, bootstrap } = await buildDemoApp({
      capabilityLeaseStateStore: leaseState,
      auditSink
    })
    const token = String((bootstrap as any).token)
    try {
      const lease = await createLease(app, token)
      const responses = await Promise.all(Array.from({ length: 32 }, (_, index) => submit(
        app,
        token,
        lease.id,
        'durable-distinct-' + index,
        'Durable distinct ' + index
      )))
      expect(responses.filter((response) => response.statusCode === 200)).toHaveLength(1)
      expect(responses.filter((response) => response.statusCode === 429)).toHaveLength(31)
      expect(new Set(
        responses
          .filter((response) => response.statusCode === 429)
          .map((response) => response.json().code)
      )).toEqual(new Set(['agent.lease_call_budget']))
      expect(leaseState.outboxSnapshot()).toEqual({
        total: 1,
        pending: 0,
        idempotencyRows: 1
      })
    } finally {
      await app.close()
      leaseState.close()
      auditSink.close()
    }
  })

  it('replays equivalent same-key proposals, rejects payload mismatch, and isolates keys across leases', async () => {
    const paths = fixturePaths()
    const leaseState = await SqliteCapabilityLeaseStore.open(paths.state)
    const auditSink = await SqliteAuditSink.open(paths.audit)
    const { app, bootstrap, runtime } = await buildDemoApp({
      capabilityLeaseStateStore: leaseState,
      auditSink
    })
    const token = String((bootstrap as any).token)
    try {
      const lease = await createLease(app, token)
      const responses = await Promise.all(Array.from({ length: 16 }, () => submit(
        app,
        token,
        lease.id,
        'durable-same-key'
      )))
      expect(responses.every((response) => response.statusCode === 200)).toBe(true)
      expect(leaseState.getCapabilityLease(lease.id)).toMatchObject({
        remaining_calls: 0,
        remaining_cost_units: 0,
        version: 2
      })
      expect(leaseState.outboxSnapshot()).toEqual({
        total: 1,
        pending: 0,
        idempotencyRows: 1
      })
      expect(runtime.audit.list().filter((event) => event.id.startsWith('laud_'))).toHaveLength(1)

      const mismatchedReplay = await submit(
        app,
        token,
        lease.id,
        'durable-same-key',
        'Changed payload under reused key'
      )
      expect(mismatchedReplay.statusCode).toBe(409)
      expect(mismatchedReplay.json().code).toBe('agent.idempotency_mismatch')
      expect(leaseState.outboxSnapshot()).toEqual({
        total: 1,
        pending: 0,
        idempotencyRows: 1
      })

      const secondLease = await createLease(app, token, {
        sessionId: 'durable-reference-session-2'
      })
      const secondLeaseResponse = await submit(
        app,
        token,
        secondLease.id,
        'durable-same-key'
      )
      expect(secondLeaseResponse.statusCode).toBe(200)
      expect(leaseState.getCapabilityLease(secondLease.id)).toMatchObject({
        remaining_calls: 0,
        remaining_cost_units: 0,
        version: 2
      })
      expect(leaseState.outboxSnapshot()).toEqual({
        total: 2,
        pending: 0,
        idempotencyRows: 2
      })
      expect(runtime.audit.list().filter((event) => event.id.startsWith('laud_'))).toHaveLength(2)
    } finally {
      await app.close()
      leaseState.close()
      auditSink.close()
    }
  })
})
