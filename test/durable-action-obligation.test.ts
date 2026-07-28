import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SqliteDurableActionStore,
  type DurableActionFaultPoint
} from '../packages/openport-core/src/index.js'

const roots: string[] = []

function fixturePath(): { root: string; state: string } {
  const root = mkdtempSync(join(tmpdir(), 'openport-durable-action-'))
  roots.push(root)
  return { root, state: join(root, 'action-state.sqlite') }
}

const baseSubmission = {
  scopeKey: 'app-public-reference:idempotency-key-1',
  requestFingerprint: 'a'.repeat(64),
  actionType: 'synthetic.transfer',
  opaqueEffectEnvelope: JSON.stringify({ from: 'account-a', to: 'account-b', units: 25 }),
  opaqueCompensationEnvelope: JSON.stringify({ reverse: true, units: 25 }),
  nowMs: 1_000
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

describe('SQLite durable action-obligation store', () => {
  it('binds one scoped request and rejects changed-fingerprint replay', async () => {
    const paths = fixturePath()
    const store = await SqliteDurableActionStore.open(paths.state)
    try {
      const first = store.submit(baseSubmission)
      const replay = store.submit(baseSubmission)

      expect(first.replayed).toBe(false)
      expect(replay.replayed).toBe(true)
      expect(replay.obligation.id).toBe(first.obligation.id)
      expect(first.obligation.scopeKeyDigest).toMatch(/^sha256:/)
      expect(first.obligation.scopeKeyDigest).not.toContain(baseSubmission.scopeKey)
      expect(store.snapshot()).toMatchObject({ total: 1, pending: 1, transitions: 1 })
      expect(() => store.submit({
        ...baseSubmission,
        requestFingerprint: 'b'.repeat(64)
      })).toThrowError(expect.objectContaining({
        statusCode: 409,
        code: 'agent.idempotency_mismatch'
      }))
    } finally {
      store.close()
    }
  })

  it('rolls back a precommit submission fault and safely reuses the scope', async () => {
    const paths = fixturePath()
    let activeFault: DurableActionFaultPoint | null = 'after_submit_before_commit'
    const store = await SqliteDurableActionStore.open(paths.state, {
      faultInjector: (point) => {
        if (point === activeFault) throw new Error('injected ' + point)
      }
    })
    try {
      expect(() => store.submit(baseSubmission)).toThrow('injected after_submit_before_commit')
      expect(store.snapshot()).toMatchObject({ total: 0, transitions: 0 })

      activeFault = null
      expect(store.submit(baseSubmission)).toMatchObject({ replayed: false })
      expect(store.snapshot()).toMatchObject({ total: 1, pending: 1, transitions: 1 })
    } finally {
      store.close()
    }
  })

  it('reclaims an expired action lease and fences the stale claimant', async () => {
    const paths = fixturePath()
    const store = await SqliteDurableActionStore.open(paths.state)
    try {
      store.submit(baseSubmission)
      const first = store.claimNextAction('worker-a', 100, 1_000)
      expect(first).not.toBeNull()
      expect(store.claimNextAction('worker-b', 100, 1_099)).toBeNull()

      expect(() => store.completeAction(
        first!.obligation.id,
        first!.claimToken,
        JSON.stringify({ ignored: true }),
        1_100
      )).toThrowError(expect.objectContaining({
        statusCode: 409,
        code: 'agent.precondition_failed'
      }))

      const replacement = store.claimNextAction('worker-b', 100, 1_100)
      expect(replacement).toMatchObject({ reclaimed: true })
      expect(() => store.completeAction(
        first!.obligation.id,
        first!.claimToken,
        JSON.stringify({ ignored: true }),
        1_101
      )).toThrowError(expect.objectContaining({
        statusCode: 409,
        code: 'agent.precondition_failed'
      }))

      const completed = store.completeAction(
        replacement!.obligation.id,
        replacement!.claimToken,
        JSON.stringify({ applied: true }),
        1_102
      )
      expect(completed).toMatchObject({ status: 'succeeded', actionAttemptCount: 2 })
      expect(store.verifyTransitionChain(completed.id)).toBe(true)
    } finally {
      store.close()
    }
  })

  it('recovers an action completion rollback through lease expiry and retry', async () => {
    const paths = fixturePath()
    let activeFault: DurableActionFaultPoint | null = 'after_action_complete_before_commit'
    const store = await SqliteDurableActionStore.open(paths.state, {
      faultInjector: (point) => {
        if (point === activeFault) throw new Error('injected ' + point)
      }
    })
    try {
      store.submit(baseSubmission)
      const first = store.claimNextAction('worker-a', 100, 1_000)!
      expect(() => store.completeAction(
        first.obligation.id,
        first.claimToken,
        JSON.stringify({ applied: true }),
        1_001
      )).toThrow('injected after_action_complete_before_commit')
      expect(store.getById(first.obligation.id)).toMatchObject({ status: 'in_progress' })

      activeFault = null
      const replacement = store.claimNextAction('worker-b', 100, 1_100)!
      const completed = store.completeAction(
        replacement.obligation.id,
        replacement.claimToken,
        JSON.stringify({ applied: true }),
        1_101
      )
      expect(completed).toMatchObject({ status: 'succeeded', actionAttemptCount: 2 })
      expect(store.snapshot()).toMatchObject({ total: 1, succeeded: 1 })
    } finally {
      store.close()
    }
  })

  it('supports explicit retry and recoverable compensation with a valid transition chain', async () => {
    const paths = fixturePath()
    const store = await SqliteDurableActionStore.open(paths.state)
    try {
      const submitted = store.submit(baseSubmission).obligation
      const first = store.claimNextAction('worker-a', 100, 1_000)!
      const pending = store.failAction(
        submitted.id,
        first.claimToken,
        'synthetic.transient',
        'retry',
        { nowMs: 1_001 }
      )
      expect(pending.status).toBe('pending')

      const retry = store.claimNextAction('worker-b', 100, 1_002)!
      const succeeded = store.completeAction(
        submitted.id,
        retry.claimToken,
        JSON.stringify({ applied: true }),
        1_003
      )
      expect(succeeded).toMatchObject({ status: 'succeeded', actionAttemptCount: 2 })

      expect(() => store.requestCompensation(
        submitted.id,
        JSON.stringify({ reverse: true, units: 10 }),
        1_004
      )).toThrowError(expect.objectContaining({
        statusCode: 409,
        code: 'agent.idempotency_mismatch'
      }))
      store.requestCompensation(submitted.id, baseSubmission.opaqueCompensationEnvelope, 1_004)
      const compensation = store.claimNextCompensation('worker-c', 100, 1_005)!
      const compensationPending = store.failCompensation(
        submitted.id,
        compensation.claimToken,
        'synthetic.transient',
        'retry',
        1_006
      )
      expect(compensationPending.status).toBe('compensation_pending')

      const compensationRetry = store.claimNextCompensation('worker-d', 100, 1_007)!
      const compensated = store.completeCompensation(
        submitted.id,
        compensationRetry.claimToken,
        JSON.stringify({ reversed: true }),
        1_008
      )
      expect(compensated).toMatchObject({
        status: 'compensated',
        compensationAttemptCount: 2
      })
      expect(store.verifyTransitionChain(submitted.id)).toBe(true)
      expect(store.listTransitions(submitted.id).map((row) => row.eventType)).toEqual([
        'action.submitted',
        'action.claimed',
        'action.failed.retry',
        'action.claimed',
        'action.completed',
        'compensation.requested',
        'compensation.claimed',
        'compensation.failed.retry',
        'compensation.claimed',
        'compensation.completed'
      ])
    } finally {
      store.close()
    }
  })

  it('keeps non-retryable failures visible for manual review', async () => {
    const paths = fixturePath()
    const store = await SqliteDurableActionStore.open(paths.state)
    try {
      const submitted = store.submit({
        ...baseSubmission,
        opaqueCompensationEnvelope: null
      }).obligation
      const claim = store.claimNextAction('worker-a', 100, 1_000)!
      const failed = store.failAction(
        submitted.id,
        claim.claimToken,
        'synthetic.unknown_outcome',
        'manual_review',
        { nowMs: 1_001 }
      )
      expect(failed).toMatchObject({
        status: 'manual_review',
        lastErrorCode: 'synthetic.unknown_outcome'
      })
      expect(store.claimNextAction('worker-b', 100, 1_100)).toBeNull()
      expect(store.claimNextCompensation('worker-b', 100, 1_100)).toBeNull()
    } finally {
      store.close()
    }
  })
})
