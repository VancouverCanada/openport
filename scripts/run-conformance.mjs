#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const profilePath = path.join(root, 'conformance/profile/openmcp-v1-profile.json')

const args = new Set(process.argv.slice(2))
const mode = args.has('--remote') ? 'remote' : 'local'

function parseJsonSafe(input) {
  if (!input) return {}
  try {
    return JSON.parse(input)
  } catch {
    return {}
  }
}

function ensureErrorEnvelope(payload) {
  assert.equal(payload?.ok, false)
  assert.equal(typeof payload?.code, 'string')
  assert.equal(typeof payload?.message, 'string')
}

function ensureSuccessEnvelope(payload) {
  assert.equal(payload?.ok, true)
  assert.equal(typeof payload?.code, 'string')
  assert.equal(typeof payload?.data, 'object')
}

async function buildClient() {
  if (mode === 'local') {
    const { buildDemoApp } = await import(path.join(root, 'dist/app.js'))
    const { app, bootstrap } = await buildDemoApp()
    const token = String(bootstrap.token)

    return {
      token,
      close: async () => app.close(),
      request: async ({ method, url, headers = {}, payload }) => {
        const response = await app.inject({
          method,
          url,
          headers,
          payload
        })
        return {
          status: response.statusCode,
          body: parseJsonSafe(response.body)
        }
      }
    }
  }

  const baseUrl = String(process.env.OPENMCP_BASE_URL || '').trim().replace(/\/$/, '')
  const token = String(process.env.OPENMCP_AGENT_TOKEN || '').trim()
  if (!baseUrl) throw new Error('OPENMCP_BASE_URL is required in --remote mode')
  if (!token) throw new Error('OPENMCP_AGENT_TOKEN is required in --remote mode')

  return {
    token,
    close: async () => {},
    request: async ({ method, url, headers = {}, payload }) => {
      const response = await fetch(`${baseUrl}${url}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...headers
        },
        body: payload === undefined ? undefined : JSON.stringify(payload)
      })
      return {
        status: response.status,
        body: parseJsonSafe(await response.text())
      }
    }
  }
}

async function run() {
  const profile = JSON.parse(await readFile(profilePath, 'utf8'))
  const missing = profile.requiredEndpoints.filter((row) => !row.path || !row.method)
  assert.equal(missing.length, 0, 'Conformance profile has invalid endpoint definitions')

  const client = await buildClient()
  const authHeaders = { authorization: `Bearer ${client.token}` }

  try {
    const unauthorized = await client.request({
      method: 'GET',
      url: '/api/agent/v1/manifest'
    })
    assert.equal(unauthorized.status, 401)
    ensureErrorEnvelope(unauthorized.body)

    const manifest = await client.request({
      method: 'GET',
      url: '/api/agent/v1/manifest',
      headers: authHeaders
    })
    assert.equal(manifest.status, 200)
    ensureSuccessEnvelope(manifest.body)
    assert.ok(Array.isArray(manifest.body.data.tools))

    const ledgers = await client.request({
      method: 'GET',
      url: '/api/agent/v1/ledgers',
      headers: authHeaders
    })
    assert.equal(ledgers.status, 200)
    ensureSuccessEnvelope(ledgers.body)
    assert.ok(Array.isArray(ledgers.body.data.items))

    const ledgerId = ledgers.body.data.items[0]?.id || 'ledger_main'
    const transactions = await client.request({
      method: 'GET',
      url: `/api/agent/v1/transactions?ledgerId=${encodeURIComponent(ledgerId)}`,
      headers: authHeaders
    })
    assert.equal(transactions.status, 200)
    ensureSuccessEnvelope(transactions.body)
    assert.ok(Array.isArray(transactions.body.data.items))

    const preflight = await client.request({
      method: 'POST',
      url: '/api/agent/v1/preflight',
      headers: authHeaders,
      payload: {
        action: 'transaction.delete',
        payload: { transactionId: 'txn_1' }
      }
    })
    assert.equal(preflight.status, 200)
    ensureSuccessEnvelope(preflight.body)
    assert.equal(typeof preflight.body.data.impactHash, 'string')

    const create = await client.request({
      method: 'POST',
      url: '/api/agent/v1/actions',
      headers: authHeaders,
      payload: {
        action: 'transaction.create',
        payload: {
          ledgerId,
          kind: 'expense',
          title: 'Conformance Test',
          amount_home: 10,
          currency_home: 'USD',
          date: '2026-02-13T00:00:00.000Z'
        }
      }
    })
    assert.equal(create.status, 200)
    ensureSuccessEnvelope(create.body)
    assert.equal(typeof create.body.data.draft?.id, 'string')

    const draftId = create.body.data.draft.id
    const draft = await client.request({
      method: 'GET',
      url: `/api/agent/v1/drafts/${encodeURIComponent(draftId)}`,
      headers: authHeaders
    })
    assert.equal(draft.status, 200)
    ensureSuccessEnvelope(draft.body)
    assert.equal(draft.body.data.draft.id, draftId)

    // eslint-disable-next-line no-console
    console.log(`Conformance passed (${profile.id}) in ${mode} mode`)
  } finally {
    await client.close()
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Conformance failed:', error.message)
  process.exit(1)
})
