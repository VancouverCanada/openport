import { describe, expect, it } from 'vitest'
import { ProcessLocalActionExecutionCoordinator } from '../packages/openport-core/src/action-execution-coordinator.js'

describe('process-local action execution coordinator', () => {
  it('shares one in-flight execution across concurrent equivalent retries', async () => {
    const coordinator = new ProcessLocalActionExecutionCoordinator()
    let calls = 0
    const results = await Promise.all(Array.from({ length: 16 }, () =>
      coordinator.coordinate(
        { scopeKey: 'scope-a', requestFingerprint: 'fingerprint-a' },
        async () => {
          calls += 1
          await new Promise((resolve) => setTimeout(resolve, 20))
          return { effectId: 'effect-a' }
        }
      )
    ))

    expect(calls).toBe(1)
    expect(results.filter((row) => row.replayed)).toHaveLength(15)
    expect(new Set(results.map((row) => row.value.effectId))).toEqual(new Set(['effect-a']))
  })

  it('rejects a concurrent payload mismatch under the same scoped key', async () => {
    const coordinator = new ProcessLocalActionExecutionCoordinator()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const first = coordinator.coordinate(
      { scopeKey: 'scope-b', requestFingerprint: 'fingerprint-a' },
      async () => {
        await gate
        return { effectId: 'effect-a' }
      }
    )

    await expect(coordinator.coordinate(
      { scopeKey: 'scope-b', requestFingerprint: 'fingerprint-b' },
      async () => ({ effectId: 'effect-b' })
    )).rejects.toMatchObject({
      statusCode: 409,
      code: 'agent.idempotency_mismatch'
    })
    release()
    await expect(first).resolves.toMatchObject({ replayed: false })
  })

  it('releases a failed in-flight claim so a later retry can run', async () => {
    const coordinator = new ProcessLocalActionExecutionCoordinator()
    await expect(coordinator.coordinate(
      { scopeKey: 'scope-c', requestFingerprint: 'fingerprint-a' },
      async () => { throw new Error('synthetic failure') }
    )).rejects.toThrow('synthetic failure')

    await expect(coordinator.coordinate(
      { scopeKey: 'scope-c', requestFingerprint: 'fingerprint-a' },
      async () => ({ effectId: 'effect-after-retry' })
    )).resolves.toMatchObject({
      replayed: false,
      value: { effectId: 'effect-after-retry' }
    })
  })
})
