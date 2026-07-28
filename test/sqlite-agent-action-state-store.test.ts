import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SqliteAgentActionStateStore,
  type SqliteAgentActionStateFaultPoint
} from '../packages/openport-core/src/index.js'
import type { AgentDraft } from '../packages/openport-core/src/types.js'

const roots: string[] = []

function fixture(): { root: string; database: string } {
  const root = mkdtempSync(join(tmpdir(), 'openport-action-state-'))
  roots.push(root)
  return { root, database: join(root, 'action-state.sqlite') }
}

function draftInput(overrides: Partial<AgentDraft> = {}): Omit<AgentDraft, 'id' | 'created_at' | 'updated_at'> & { id?: string } {
  return {
    id: 'drf_durable_reference',
    app_id: 'app_reference',
    key_id: 'key_reference',
    actor_user_id: 'actor_reference',
    action_type: 'transaction.create',
    payload: { ledgerId: 'ledger_main', amount_home: 25 },
    status: 'confirmed',
    requires_confirmation: true,
    auto_execute_requested: true,
    request_id: 'request-reference',
    idempotency_key: 'idem-reference',
    justification: null,
    preflight: null,
    preflight_hash: null,
    preflight_state_witness: null,
    preflight_state_witness_hash: null,
    policy_snapshot: { risk: 'medium' },
    confirmed_by_user_id: null,
    confirmed_at: '2026-07-13T00:00:00.000Z',
    canceled_at: null,
    ...overrides
  }
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

describe('SQLite HTTP action state store', () => {
  it('persists drafts and successful execution fingerprints across reconstruction', async () => {
    const paths = fixture()
    const first = await SqliteAgentActionStateStore.open(paths.database)
    const draft = first.saveDraft(draftInput())
    const failed = first.saveExecution({
      draft_id: draft.id,
      app_id: draft.app_id,
      idempotency_key: draft.idempotency_key,
      status: 'failed',
      result: null,
      error: 'synthetic failure'
    }, 'fingerprint-reference')
    expect(first.findExecutionByIdempotency(draft.app_id, draft.idempotency_key!)).toBeNull()
    const success = first.saveExecution({
      draft_id: draft.id,
      app_id: draft.app_id,
      idempotency_key: draft.idempotency_key,
      status: 'success',
      result: { transaction: { id: 'txn_reference' } },
      error: null
    }, 'fingerprint-reference')
    first.close()

    const second = await SqliteAgentActionStateStore.open(paths.database, { initialize: false })
    try {
      expect(second.getDraft(draft.id)).toMatchObject({ id: draft.id, payload: draft.payload })
      expect(second.getLatestExecutionForDraft(draft.id)?.id).toBe(success.id)
      expect(second.findExecutionByIdempotency(draft.app_id, draft.idempotency_key!)?.id).toBe(success.id)
      expect(second.getExecutionRequestFingerprint(success.id)).toBe('fingerprint-reference')
      expect(second.getExecutionRequestFingerprint(failed.id)).toBe('fingerprint-reference')
      expect(second.snapshot()).toEqual({ drafts: 1, successfulExecutions: 1, failedExecutions: 1 })
    } finally {
      second.close()
    }
  })

  it('replays an equivalent draft and rejects changed idempotency-key reuse', async () => {
    const paths = fixture()
    const store = await SqliteAgentActionStateStore.open(paths.database)
    try {
      const first = store.saveDraft(draftInput())
      expect(store.saveDraft(draftInput({ id: 'drf_other' })).id).toBe(first.id)
      expect(() => store.saveDraft(draftInput({
        id: 'drf_changed',
        payload: { ledgerId: 'ledger_main', amount_home: 50 }
      }))).toThrowError(expect.objectContaining({ code: 'agent.idempotency_mismatch' }))
    } finally {
      store.close()
    }
  })

  it.each<SqliteAgentActionStateFaultPoint>([
    'after_draft_write_before_commit',
    'after_execution_write_before_commit'
  ])('rolls back an injected precommit fault at %s', async (point) => {
    const paths = fixture()
    const store = await SqliteAgentActionStateStore.open(paths.database, {
      faultInjector: (candidate) => {
        if (candidate === point) throw new Error('fault:' + point)
      }
    })
    try {
      if (point === 'after_draft_write_before_commit') {
        expect(() => store.saveDraft(draftInput())).toThrow('fault:' + point)
        expect(store.snapshot()).toEqual({ drafts: 0, successfulExecutions: 0, failedExecutions: 0 })
      } else {
        const draft = store.saveDraft(draftInput())
        expect(() => store.saveExecution({
          draft_id: draft.id,
          app_id: draft.app_id,
          idempotency_key: draft.idempotency_key,
          status: 'success',
          result: { ok: true },
          error: null
        }, 'fingerprint-reference')).toThrow('fault:' + point)
        expect(store.snapshot()).toEqual({ drafts: 1, successfulExecutions: 0, failedExecutions: 0 })
      }
    } finally {
      store.close()
    }
  })

  it.each<SqliteAgentActionStateFaultPoint>([
    'after_draft_commit_before_return',
    'after_execution_commit_before_return'
  ])('preserves an injected postcommit write at %s', async (point) => {
    const paths = fixture()
    let armed = point === 'after_draft_commit_before_return'
    const store = await SqliteAgentActionStateStore.open(paths.database, {
      faultInjector: (candidate) => {
        if (armed && candidate === point) throw new Error('fault:' + point)
      }
    })
    try {
      if (point === 'after_draft_commit_before_return') {
        expect(() => store.saveDraft(draftInput())).toThrow('fault:' + point)
        armed = false
        expect(store.saveDraft(draftInput()).id).toBe('drf_durable_reference')
      } else {
        const draft = store.saveDraft(draftInput())
        armed = true
        expect(() => store.saveExecution({
          draft_id: draft.id,
          app_id: draft.app_id,
          idempotency_key: draft.idempotency_key,
          status: 'success',
          result: { ok: true },
          error: null
        }, 'fingerprint-reference')).toThrow('fault:' + point)
        armed = false
        expect(store.findExecutionByIdempotency(draft.app_id, draft.idempotency_key!)).not.toBeNull()
      }
    } finally {
      store.close()
    }
  })

  it('deletes one application action graph without touching another application', async () => {
    const paths = fixture()
    const store = await SqliteAgentActionStateStore.open(paths.database)
    try {
      store.saveDraft(draftInput())
      store.saveDraft(draftInput({
        id: 'drf_other_app',
        app_id: 'app_other',
        idempotency_key: 'idem-other'
      }))
      store.deleteActionsForApp('app_reference')
      expect(store.listDrafts()).toHaveLength(1)
      expect(store.listDrafts()[0].app_id).toBe('app_other')
    } finally {
      store.close()
    }
  })
})
