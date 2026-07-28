import crypto from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import {
  InMemoryDomainAdapter,
  base64Url,
  jcs,
  sha256JcsHex,
  SingleHostDurableActionExecutor,
  SqliteAgentActionStateStore,
  SqliteDurableActionStore
} from '../packages/openport-core/src/index.js'
import type {
  DurableEffectReceipt,
  DurableEffectReceiptLookup
} from '../packages/openport-core/src/durable-action-executor.js'
import type { DomainEffectContext, Transaction } from '../packages/openport-core/src/types.js'
import { buildApp, buildDemoApp } from '../src/app.js'
import { createOpenPortRuntime } from '../src/runtime.js'

const roots: string[] = []

function fixture(): { root: string; action: string; obligation: string; effect: string } {
  const root = mkdtempSync(join(tmpdir(), 'openport-durable-http-action-'))
  roots.push(root)
  return {
    root,
    action: join(root, 'action.sqlite'),
    obligation: join(root, 'obligation.sqlite'),
    effect: join(root, 'effect.sqlite')
  }
}

class SqliteSyntheticEffectDomain extends InMemoryDomainAdapter {
  private readonly db: DatabaseSync
  private failAfterCommit: boolean

  constructor(
    filePath: string,
    private readonly receiverMode: 'stable_idempotent' | 'non_idempotent' = 'stable_idempotent',
    failAfterCommit = false,
    private readonly receiptSigner?: { keyId: string; privateKey: crypto.KeyObject }
  ) {
    super()
    this.db = new DatabaseSync(filePath)
    this.db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; ' +
      'CREATE TABLE IF NOT EXISTS synthetic_effects (' +
      'sequence INTEGER PRIMARY KEY AUTOINCREMENT, obligation_id TEXT NOT NULL, effect_id TEXT NOT NULL, ' +
      'request_fingerprint TEXT NOT NULL, action_type TEXT NOT NULL, result_json TEXT NOT NULL, ' +
      'result_digest TEXT NOT NULL, receipt_key_id TEXT, receipt_signature TEXT);'
    )
    this.failAfterCommit = failAfterCommit
  }

  override async createTransaction(
    _actorUserId: string,
    payload: Record<string, unknown>,
    effectContext?: DomainEffectContext
  ): Promise<Transaction> {
    if (!effectContext?.effectId) throw new Error('stable effect identifier required')
    if (this.receiverMode === 'stable_idempotent') {
      const replay = this.db.prepare(
        'SELECT result_json FROM synthetic_effects WHERE effect_id = ? ORDER BY sequence LIMIT 1'
      ).get(effectContext.effectId) as { result_json?: unknown } | undefined
      if (replay?.result_json) return JSON.parse(String(replay.result_json)) as Transaction
    }

    const sequence = Number((this.db.prepare(
      'SELECT COUNT(*) AS total FROM synthetic_effects'
    ).get() as { total?: unknown }).total || 0) + 1
    const now = '2026-07-13T00:00:00.000Z'
    const transaction: Transaction = {
      id: 'txn_synthetic_' + sequence,
      ledger_id: String(payload.ledgerId || payload.ledger_id || 'ledger_main'),
      kind: String(payload.kind || 'expense') as Transaction['kind'],
      title: String(payload.title || 'Synthetic durable action'),
      amount_home: Number(payload.amount_home || 25),
      currency_home: String(payload.currency_home || 'USD'),
      date: String(payload.date || now),
      notes: null,
      is_deleted: false,
      created_at: now,
      updated_at: now
    }
    const resultDigest = 'sha256:' + sha256JcsHex({ transaction })
    const receiptSignature = this.receiptSigner
      ? base64Url(crypto.sign(null, Buffer.from(jcs({
          version: 1,
          purpose: 'openport.durable-effect-receipt',
          keyId: this.receiptSigner.keyId,
          obligationId: effectContext.obligationId,
          effectId: effectContext.effectId,
          requestFingerprint: effectContext.requestFingerprint,
          actionType: effectContext.actionType,
          resultDigest
        }), 'utf8'), this.receiptSigner.privateKey))
      : null
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.prepare(
        'INSERT INTO synthetic_effects ' +
        '(obligation_id, effect_id, request_fingerprint, action_type, result_json, result_digest, ' +
        'receipt_key_id, receipt_signature) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        effectContext.obligationId,
        effectContext.effectId,
        effectContext.requestFingerprint,
        effectContext.actionType,
        JSON.stringify(transaction),
        resultDigest,
        this.receiptSigner?.keyId || null,
        receiptSignature
      )
      this.db.exec('COMMIT')
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      throw error
    }
    if (this.failAfterCommit) {
      this.failAfterCommit = false
      throw new Error('synthetic response lost after effect commit')
    }
    return transaction
  }

  effectCount(): number {
    return Number((this.db.prepare(
      'SELECT COUNT(*) AS total FROM synthetic_effects'
    ).get() as { total?: unknown }).total || 0)
  }

  receiptLookup(
    mode: 'valid' | 'missing' | 'unavailable' | 'effect' | 'fingerprint' | 'action' | 'digest' | 'result' |
      'unsigned' | 'algorithm' | 'unknown_key' | 'malformed_signature' | 'signature' | 'other_effect' = 'valid'
  ): DurableEffectReceiptLookup {
    return async (input) => {
      if (mode === 'unavailable') throw new Error('synthetic receipt lookup unavailable')
      if (mode === 'missing') return null
      const row = this.db.prepare(
        'SELECT obligation_id, effect_id, request_fingerprint, action_type, result_json, result_digest, ' +
        'receipt_key_id, receipt_signature FROM synthetic_effects WHERE ' +
        (mode === 'other_effect' ? 'effect_id <> ? ORDER BY sequence DESC LIMIT 1' : 'effect_id = ? ORDER BY sequence LIMIT 1')
      ).get(input.effectId) as Record<string, unknown> | undefined
      if (!row) return null
      const transaction = JSON.parse(String(row.result_json)) as Record<string, unknown>
      const signature = String(row.receipt_signature || '')
      const receipt: DurableEffectReceipt = {
        obligationId: String(row.obligation_id),
        effectId: mode === 'effect' ? 'eff_mismatched' : String(row.effect_id),
        requestFingerprint: mode === 'fingerprint' ? 'fingerprint-mismatched' : String(row.request_fingerprint),
        actionType: mode === 'action' ? 'transaction.delete' : String(row.action_type),
        resultDigest: mode === 'digest' ? 'sha256:' + '0'.repeat(64) : String(row.result_digest),
        result: mode === 'result'
          ? { transaction: { ...transaction, amount_home: 999 } }
          : { transaction }
      }
      if (mode !== 'unsigned' && row.receipt_key_id && row.receipt_signature) {
        receipt.authentication = {
          algorithm: mode === 'algorithm' ? 'Ed448' : 'Ed25519',
          keyId: mode === 'unknown_key' ? 'synthetic-unknown-key' : String(row.receipt_key_id),
          signature: mode === 'malformed_signature'
            ? 'not-base64url'
            : mode === 'signature'
              ? base64Url(Buffer.from(signature, 'base64url').map((byte, index) => index === 0 ? byte ^ 1 : byte))
              : signature
        }
      }
      return receipt
    }
  }

  override async close(): Promise<void> {
    this.db.close()
  }
}

function bearer(token: string): Record<string, string> {
  return { authorization: 'Bearer ' + token }
}

function actionRequest(idempotencyKey: string, amount = 25) {
  return {
    method: 'POST' as const,
    url: '/api/agent/v1/actions',
    payload: {
      action: 'transaction.create',
      payload: {
        ledgerId: 'ledger_main',
        kind: 'expense',
        title: 'Durable HTTP action',
        amount_home: amount,
        currency_home: 'USD',
        date: '2026-07-13T00:00:00.000Z'
      },
      execute: true,
      requestId: idempotencyKey,
      idempotencyKey
    }
  }
}

function receiptKey(keyId: string): {
  keyId: string
  privateKey: crypto.KeyObject
  publicKeyPem: string
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
  return {
    keyId,
    privateKey,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString()
  }
}

function enableAutoExecute(runtime: Awaited<ReturnType<typeof buildDemoApp>>['runtime'], appId: string): void {
  runtime.admin.updateAutoExecute('admin_demo', appId, {
    writes: {
      enabled: true,
      expires_at: '2099-01-01T00:00:00.000Z',
      allowed_actions: ['transaction.create']
    }
  })
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

describe('single-host durable HTTP action path', () => {
  it('persists and replays one HTTP action across a full runtime reconstruction', async () => {
    const paths = fixture()
    const actionState1 = await SqliteAgentActionStateStore.open(paths.action)
    const obligation1 = await SqliteDurableActionStore.open(paths.obligation)
    const domain1 = new SqliteSyntheticEffectDomain(paths.effect)
    const durable1 = new SingleHostDurableActionExecutor(obligation1, {
      ambiguousFailureDisposition: 'retry'
    })
    const first = await buildDemoApp({
      actionStateStore: actionState1,
      durableActionExecutor: durable1,
      domain: domain1
    })
    const token = String((first.bootstrap as any).token)
    const appId = String((first.bootstrap as any).app.id)
    enableAutoExecute(first.runtime, appId)

    const initial = await first.app.inject({
      ...actionRequest('durable-http-restart-1'),
      headers: bearer(token)
    })
    expect(initial.statusCode).toBe(200)
    expect(initial.json().data).toMatchObject({ status: 'executed' })
    expect(domain1.effectCount()).toBe(1)
    expect(actionState1.snapshot()).toEqual({ drafts: 1, successfulExecutions: 1, failedExecutions: 0 })
    expect(obligation1.snapshot()).toMatchObject({ total: 1, succeeded: 1 })
    await first.app.close()
    actionState1.close()
    obligation1.close()

    const actionState2 = await SqliteAgentActionStateStore.open(paths.action, { initialize: false })
    const obligation2 = await SqliteDurableActionStore.open(paths.obligation, { initialize: false })
    const domain2 = new SqliteSyntheticEffectDomain(paths.effect)
    const runtime2 = createOpenPortRuntime({
      store: first.runtime.store,
      actionStateStore: actionState2,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation2, {
        ambiguousFailureDisposition: 'retry'
      }),
      domain: domain2
    })
    const app2 = buildApp(runtime2)
    try {
      const replay = await app2.inject({
        ...actionRequest('durable-http-restart-1'),
        headers: bearer(token)
      })
      expect(replay.statusCode).toBe(200)
      expect(replay.json().data.execution.replayed).toBe(true)
      expect(domain2.effectCount()).toBe(1)
      expect(actionState2.snapshot()).toEqual({ drafts: 1, successfulExecutions: 1, failedExecutions: 0 })
      expect(obligation2.snapshot()).toMatchObject({ total: 1, succeeded: 1 })
    } finally {
      await app2.close()
      actionState2.close()
      obligation2.close()
    }
  })

  it('converges 32 concurrent same-key HTTP requests to one durable receiver effect', async () => {
    const paths = fixture()
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect)
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
        ambiguousFailureDisposition: 'retry'
      }),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    enableAutoExecute(fixtureApp.runtime, String((fixtureApp.bootstrap as any).app.id))
    try {
      const responses = await Promise.all(Array.from({ length: 32 }, () => fixtureApp.app.inject({
        ...actionRequest('durable-http-race-1'),
        headers: bearer(token)
      })))
      expect(responses.every((response) => response.statusCode === 200)).toBe(true)
      expect(responses.filter((response) => response.json().data.execution.replayed === true)).toHaveLength(31)
      expect(domain.effectCount()).toBe(1)
      expect(actionState.snapshot()).toEqual({ drafts: 1, successfulExecutions: 1, failedExecutions: 0 })
      expect(obligation.snapshot()).toMatchObject({ total: 1, succeeded: 1 })
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it('recovers ambiguous stable-identifier delivery without duplicating the effect', async () => {
    const paths = fixture()
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect, 'stable_idempotent', true)
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
        ambiguousFailureDisposition: 'retry'
      }),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    enableAutoExecute(fixtureApp.runtime, String((fixtureApp.bootstrap as any).app.id))
    try {
      const first = await fixtureApp.app.inject({
        ...actionRequest('durable-http-ambiguous-1'),
        headers: bearer(token)
      })
      expect(first.statusCode).toBe(500)
      expect(obligation.snapshot()).toMatchObject({ pending: 1 })

      const retry = await fixtureApp.app.inject({
        ...actionRequest('durable-http-ambiguous-1'),
        headers: bearer(token)
      })
      expect(retry.statusCode).toBe(200)
      expect(domain.effectCount()).toBe(1)
      expect(actionState.snapshot()).toEqual({ drafts: 1, successfulExecutions: 1, failedExecutions: 1 })
      expect(obligation.getById(obligation.findByScopeKey(
        String((fixtureApp.bootstrap as any).app.id) + ':durable-http-ambiguous-1'
      )!.id)?.actionAttemptCount).toBe(2)
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it('fails closed to manual review when receiver idempotency is not asserted', async () => {
    const paths = fixture()
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect, 'stable_idempotent', true)
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    enableAutoExecute(fixtureApp.runtime, String((fixtureApp.bootstrap as any).app.id))
    try {
      const first = await fixtureApp.app.inject({
        ...actionRequest('durable-http-manual-1'),
        headers: bearer(token)
      })
      expect(first.statusCode).toBe(500)
      expect(obligation.snapshot()).toMatchObject({ manual_review: 1 })
      const retry = await fixtureApp.app.inject({
        ...actionRequest('durable-http-manual-1'),
        headers: bearer(token)
      })
      expect(retry.statusCode).toBe(409)
      expect(retry.json()).toMatchObject({
        code: 'agent.precondition_failed',
        details: { reason: 'durable_action_manual_review' }
      })
      expect(domain.effectCount()).toBe(1)
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it('reproduces duplicate effects when retry is enabled against a non-idempotent receiver', async () => {
    const paths = fixture()
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect, 'non_idempotent', true)
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
        ambiguousFailureDisposition: 'retry'
      }),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    enableAutoExecute(fixtureApp.runtime, String((fixtureApp.bootstrap as any).app.id))
    try {
      const first = await fixtureApp.app.inject({
        ...actionRequest('durable-http-negative-1'),
        headers: bearer(token)
      })
      expect(first.statusCode).toBe(500)
      const retry = await fixtureApp.app.inject({
        ...actionRequest('durable-http-negative-1'),
        headers: bearer(token)
      })
      expect(retry.statusCode).toBe(200)
      expect(domain.effectCount()).toBe(2)
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it('reconciles an execution-record postcommit response loss without a second effect', async () => {
    const paths = fixture()
    let armed = true
    const actionState = await SqliteAgentActionStateStore.open(paths.action, {
      faultInjector: (point) => {
        if (armed && point === 'after_execution_commit_before_return') {
          armed = false
          throw new Error('synthetic execution response loss')
        }
      }
    })
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect)
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
        ambiguousFailureDisposition: 'retry'
      }),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    enableAutoExecute(fixtureApp.runtime, String((fixtureApp.bootstrap as any).app.id))
    try {
      const first = await fixtureApp.app.inject({
        ...actionRequest('durable-http-execution-commit-1'),
        headers: bearer(token)
      })
      expect(first.statusCode).toBe(500)
      expect(actionState.snapshot()).toEqual({ drafts: 1, successfulExecutions: 1, failedExecutions: 0 })

      const retry = await fixtureApp.app.inject({
        ...actionRequest('durable-http-execution-commit-1'),
        headers: bearer(token)
      })
      expect(retry.statusCode).toBe(200)
      expect(retry.json().data.execution.replayed).toBe(true)
      expect(domain.effectCount()).toBe(1)
      expect(obligation.snapshot()).toMatchObject({ succeeded: 1 })
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it('reconstructs a deleted successful execution from a bound receiver receipt', async () => {
    const paths = fixture()
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect)
    const durable = new SingleHostDurableActionExecutor(obligation, {
      ambiguousFailureDisposition: 'retry',
      effectReceiptLookup: domain.receiptLookup()
    })
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: durable,
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    const appId = String((fixtureApp.bootstrap as any).app.id)
    enableAutoExecute(fixtureApp.runtime, appId)
    try {
      const first = await fixtureApp.app.inject({
        ...actionRequest('durable-http-receipt-1'),
        headers: bearer(token)
      })
      expect(first.statusCode).toBe(200)
      const boundObligation = obligation.findByScopeKey(appId + ':durable-http-receipt-1')!
      await expect(durable.reconcileSucceededEffect({
        scopeKey: appId + ':different-key',
        requestFingerprint: boundObligation.requestFingerprint,
        actionType: boundObligation.actionType,
        opaqueEffectEnvelope: boundObligation.opaqueEffectEnvelope
      }, boundObligation)).rejects.toMatchObject({
        details: { reason: 'durable_effect_receipt_invalid' }
      })
      const tamper = new DatabaseSync(paths.action)
      const deleted = tamper.prepare(
        "DELETE FROM agent_action_executions WHERE app_id = ? AND idempotency_key = ? AND status = 'success'"
      ).run(appId, 'durable-http-receipt-1')
      tamper.close()
      expect(Number(deleted.changes)).toBe(1)

      const recovered = await fixtureApp.app.inject({
        ...actionRequest('durable-http-receipt-1'),
        headers: bearer(token)
      })
      expect(recovered.statusCode).toBe(200)
      expect(recovered.json().data.execution).toMatchObject({
        replayed: true,
        receipt_reconciled: true
      })
      expect(actionState.snapshot()).toEqual({ drafts: 1, successfulExecutions: 1, failedExecutions: 0 })
      expect(domain.effectCount()).toBe(1)

      const replay = await fixtureApp.app.inject({
        ...actionRequest('durable-http-receipt-1'),
        headers: bearer(token)
      })
      expect(replay.statusCode).toBe(200)
      expect(replay.json().data.execution.replayed).toBe(true)
      expect(domain.effectCount()).toBe(1)
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it('authenticates an Ed25519/JCS receiver receipt before reconstruction', async () => {
    const paths = fixture()
    const signingKey = receiptKey('synthetic-receiver-key-a')
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(
      paths.effect,
      'stable_idempotent',
      false,
      signingKey
    )
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
        ambiguousFailureDisposition: 'retry',
        effectReceiptLookup: domain.receiptLookup(),
        effectReceiptAuthentication: {
          trustedEd25519PublicKeys: { [signingKey.keyId]: signingKey.publicKeyPem }
        }
      }),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    const appId = String((fixtureApp.bootstrap as any).app.id)
    const key = 'durable-http-authenticated-receipt-1'
    enableAutoExecute(fixtureApp.runtime, appId)
    try {
      expect((await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })).statusCode).toBe(200)
      const tamper = new DatabaseSync(paths.action)
      const deleted = tamper.prepare(
        "DELETE FROM agent_action_executions WHERE app_id = ? AND idempotency_key = ? AND status = 'success'"
      ).run(appId, key)
      tamper.close()
      expect(Number(deleted.changes)).toBe(1)

      const recovered = await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })
      expect(recovered.statusCode).toBe(200)
      expect(recovered.json().data.execution).toMatchObject({
        replayed: true,
        receipt_reconciled: true,
        receipt_authenticated: true,
        receipt_key_id: signingKey.keyId
      })
      expect(domain.effectCount()).toBe(1)

      const replay = await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })
      expect(replay.statusCode).toBe(200)
      expect(replay.json().data.execution.replayed).toBe(true)
      expect(domain.effectCount()).toBe(1)
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it.each([
    'unsigned',
    'algorithm',
    'unknown_key',
    'malformed_signature',
    'signature',
    'digest'
  ] as const)('fails closed for %s authenticated receipt evidence', async (mode) => {
    const paths = fixture()
    const signingKey = receiptKey('synthetic-receiver-key-a')
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect, 'stable_idempotent', false, signingKey)
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
        ambiguousFailureDisposition: 'retry',
        effectReceiptLookup: domain.receiptLookup(mode),
        effectReceiptAuthentication: {
          trustedEd25519PublicKeys: { [signingKey.keyId]: signingKey.publicKeyPem }
        }
      }),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    const appId = String((fixtureApp.bootstrap as any).app.id)
    const key = 'durable-http-authenticated-negative-' + mode
    enableAutoExecute(fixtureApp.runtime, appId)
    try {
      expect((await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })).statusCode).toBe(200)
      const tamper = new DatabaseSync(paths.action)
      tamper.prepare(
        "DELETE FROM agent_action_executions WHERE app_id = ? AND idempotency_key = ? AND status = 'success'"
      ).run(appId, key)
      tamper.close()

      const retry = await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })
      expect(retry.statusCode).toBe(409)
      expect(retry.json()).toMatchObject({
        code: 'agent.precondition_failed',
        details: { reason: 'durable_effect_receipt_authentication_failed' }
      })
      expect(actionState.snapshot()).toEqual({ drafts: 1, successfulExecutions: 0, failedExecutions: 0 })
      expect(domain.effectCount()).toBe(1)
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it('rejects a validly signed receipt bound to another effect', async () => {
    const paths = fixture()
    const signingKey = receiptKey('synthetic-receiver-key-a')
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect, 'stable_idempotent', false, signingKey)
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
        ambiguousFailureDisposition: 'retry',
        effectReceiptLookup: domain.receiptLookup('other_effect'),
        effectReceiptAuthentication: {
          trustedEd25519PublicKeys: { [signingKey.keyId]: signingKey.publicKeyPem }
        }
      }),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    const appId = String((fixtureApp.bootstrap as any).app.id)
    const targetKey = 'durable-http-authenticated-target'
    const decoyKey = 'durable-http-authenticated-decoy'
    enableAutoExecute(fixtureApp.runtime, appId)
    try {
      expect((await fixtureApp.app.inject({ ...actionRequest(targetKey), headers: bearer(token) })).statusCode).toBe(200)
      expect((await fixtureApp.app.inject({ ...actionRequest(decoyKey, 26), headers: bearer(token) })).statusCode).toBe(200)
      const tamper = new DatabaseSync(paths.action)
      tamper.prepare(
        "DELETE FROM agent_action_executions WHERE app_id = ? AND idempotency_key = ? AND status = 'success'"
      ).run(appId, targetKey)
      tamper.close()

      const retry = await fixtureApp.app.inject({ ...actionRequest(targetKey), headers: bearer(token) })
      expect(retry.statusCode).toBe(409)
      expect(retry.json()).toMatchObject({
        code: 'agent.precondition_failed',
        details: { reason: 'durable_effect_receipt_invalid' }
      })
      expect(actionState.snapshot().successfulExecutions).toBe(1)
      expect(domain.effectCount()).toBe(2)
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it('supports an overlapping Ed25519 trust set and rejects a removed old key', async () => {
    const oldKey = receiptKey('synthetic-receiver-key-old')
    const newKey = receiptKey('synthetic-receiver-key-new')
    const overlappingKeys = {
      [oldKey.keyId]: oldKey.publicKeyPem,
      [newKey.keyId]: newKey.publicKeyPem
    }

    for (const signingKey of [oldKey, newKey]) {
      const paths = fixture()
      const actionState = await SqliteAgentActionStateStore.open(paths.action)
      const obligation = await SqliteDurableActionStore.open(paths.obligation)
      const domain = new SqliteSyntheticEffectDomain(paths.effect, 'stable_idempotent', false, signingKey)
      const fixtureApp = await buildDemoApp({
        actionStateStore: actionState,
        durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
          ambiguousFailureDisposition: 'retry',
          effectReceiptLookup: domain.receiptLookup(),
          effectReceiptAuthentication: { trustedEd25519PublicKeys: overlappingKeys }
        }),
        domain
      })
      const token = String((fixtureApp.bootstrap as any).token)
      const appId = String((fixtureApp.bootstrap as any).app.id)
      const key = 'durable-http-key-overlap-' + signingKey.keyId
      enableAutoExecute(fixtureApp.runtime, appId)
      try {
        expect((await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })).statusCode).toBe(200)
        const tamper = new DatabaseSync(paths.action)
        tamper.prepare(
          "DELETE FROM agent_action_executions WHERE app_id = ? AND idempotency_key = ? AND status = 'success'"
        ).run(appId, key)
        tamper.close()
        const recovered = await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })
        expect(recovered.statusCode).toBe(200)
        expect(recovered.json().data.execution).toMatchObject({
          receipt_authenticated: true,
          receipt_key_id: signingKey.keyId
        })
        expect(domain.effectCount()).toBe(1)
      } finally {
        await fixtureApp.app.close()
        actionState.close()
        obligation.close()
      }
    }

    const paths = fixture()
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect, 'stable_idempotent', false, oldKey)
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
        ambiguousFailureDisposition: 'retry',
        effectReceiptLookup: domain.receiptLookup(),
        effectReceiptAuthentication: {
          trustedEd25519PublicKeys: { [newKey.keyId]: newKey.publicKeyPem }
        }
      }),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    const appId = String((fixtureApp.bootstrap as any).app.id)
    const key = 'durable-http-key-old-removed'
    enableAutoExecute(fixtureApp.runtime, appId)
    try {
      expect((await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })).statusCode).toBe(200)
      const tamper = new DatabaseSync(paths.action)
      tamper.prepare(
        "DELETE FROM agent_action_executions WHERE app_id = ? AND idempotency_key = ? AND status = 'success'"
      ).run(appId, key)
      tamper.close()
      const rejected = await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })
      expect(rejected.statusCode).toBe(409)
      expect(rejected.json()).toMatchObject({
        details: { reason: 'durable_effect_receipt_authentication_failed' }
      })
      expect(domain.effectCount()).toBe(1)
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it('rejects non-SPKI or non-Ed25519 trusted receipt keys at configuration time', async () => {
    const paths = fixture()
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const ed25519 = crypto.generateKeyPairSync('ed25519')
    const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    try {
      expect(() => new SingleHostDurableActionExecutor(obligation, {
        effectReceiptAuthentication: {
          trustedEd25519PublicKeys: {
            private_material: ed25519.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
          }
        }
      })).toThrow(/SPKI public-key PEM/)
      expect(() => new SingleHostDurableActionExecutor(obligation, {
        effectReceiptAuthentication: {
          trustedEd25519PublicKeys: {
            rsa_public: rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString()
          }
        }
      })).toThrow(/Ed25519 public keys/)
    } finally {
      obligation.close()
    }
  })

  it.each([
    ['missing', 'durable_execution_record_missing'],
    ['unavailable', 'durable_effect_receipt_unavailable'],
    ['effect', 'durable_effect_receipt_invalid'],
    ['fingerprint', 'durable_effect_receipt_invalid'],
    ['action', 'durable_effect_receipt_invalid'],
    ['digest', 'durable_effect_receipt_invalid'],
    ['result', 'durable_effect_receipt_invalid']
  ] as const)('fails closed for %s receiver receipt evidence', async (mode, reason) => {
    const paths = fixture()
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect)
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
        ambiguousFailureDisposition: 'retry',
        effectReceiptLookup: domain.receiptLookup(mode)
      }),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    const appId = String((fixtureApp.bootstrap as any).app.id)
    const key = 'durable-http-receipt-negative-' + mode
    enableAutoExecute(fixtureApp.runtime, appId)
    try {
      const first = await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })
      expect(first.statusCode).toBe(200)
      const tamper = new DatabaseSync(paths.action)
      tamper.prepare(
        "DELETE FROM agent_action_executions WHERE app_id = ? AND idempotency_key = ? AND status = 'success'"
      ).run(appId, key)
      tamper.close()

      const retry = await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })
      expect(retry.statusCode).toBe(409)
      expect(retry.json()).toMatchObject({
        code: 'agent.precondition_failed',
        details: { reason }
      })
      expect(actionState.snapshot()).toEqual({ drafts: 1, successfulExecutions: 0, failedExecutions: 0 })
      expect(domain.effectCount()).toBe(1)
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })

  it('rejects a malformed terminal obligation result envelope', async () => {
    const paths = fixture()
    const actionState = await SqliteAgentActionStateStore.open(paths.action)
    const obligation = await SqliteDurableActionStore.open(paths.obligation)
    const domain = new SqliteSyntheticEffectDomain(paths.effect)
    const fixtureApp = await buildDemoApp({
      actionStateStore: actionState,
      durableActionExecutor: new SingleHostDurableActionExecutor(obligation, {
        ambiguousFailureDisposition: 'retry',
        effectReceiptLookup: domain.receiptLookup()
      }),
      domain
    })
    const token = String((fixtureApp.bootstrap as any).token)
    const appId = String((fixtureApp.bootstrap as any).app.id)
    const key = 'durable-http-receipt-malformed-envelope'
    enableAutoExecute(fixtureApp.runtime, appId)
    try {
      expect((await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })).statusCode).toBe(200)
      const actionDb = new DatabaseSync(paths.action)
      actionDb.prepare(
        "DELETE FROM agent_action_executions WHERE app_id = ? AND idempotency_key = ? AND status = 'success'"
      ).run(appId, key)
      actionDb.close()
      const obligationDb = new DatabaseSync(paths.obligation)
      obligationDb.prepare(
        "UPDATE durable_action_obligations SET opaque_result_envelope = ? WHERE status = 'succeeded'"
      ).run('{"version":1,"resultDigest":"invalid"}')
      obligationDb.close()

      const retry = await fixtureApp.app.inject({ ...actionRequest(key), headers: bearer(token) })
      expect(retry.statusCode).toBe(409)
      expect(retry.json()).toMatchObject({
        code: 'agent.precondition_failed',
        details: { reason: 'durable_effect_receipt_invalid' }
      })
      expect(actionState.snapshot().successfulExecutions).toBe(0)
      expect(domain.effectCount()).toBe(1)
    } finally {
      await fixtureApp.app.close()
      actionState.close()
      obligation.close()
    }
  })
})
