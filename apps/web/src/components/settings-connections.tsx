'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchOllamaConfig, syncOllamaModels, updateOllamaConfig, verifyOllamaConnection, type OllamaConfigResponse } from '../lib/openport-api'
import { notify } from '../lib/toast'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'

type VerifyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; version: string }
  | { status: 'error'; message: string }

function normalizeUrls(urls: string[]): string[] {
  const next = urls
    .map((url) => String(url || '').trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return Array.from(new Set(next)).slice(0, 8)
}

export function SettingsConnections() {
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [config, setConfig] = useState<OllamaConfigResponse | null>(null)
  const [urlsDraft, setUrlsDraft] = useState<string[]>(['http://host.docker.internal:11434'])
  const [verifyStates, setVerifyStates] = useState<Record<number, VerifyState>>({})

  const enabled = Boolean(config?.ENABLE_OLLAMA_API)
  const urls = useMemo(() => normalizeUrls(urlsDraft), [urlsDraft])

  useEffect(() => {
    let isActive = true
    setLoading(true)
    fetchOllamaConfig()
      .then((next) => {
        if (!isActive) return
        setConfig(next)
        setUrlsDraft(next.OLLAMA_BASE_URLS.length ? next.OLLAMA_BASE_URLS : ['http://host.docker.internal:11434'])
      })
      .catch(() => {
        if (!isActive) return
        setConfig({
          ENABLE_OLLAMA_API: false,
          OLLAMA_BASE_URLS: []
        })
      })
      .finally(() => {
        if (!isActive) return
        setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  async function save(next: OllamaConfigResponse): Promise<void> {
    setWorking(true)
    try {
      const updated = await updateOllamaConfig({
        ENABLE_OLLAMA_API: Boolean(next.ENABLE_OLLAMA_API),
        OLLAMA_BASE_URLS: normalizeUrls(next.OLLAMA_BASE_URLS)
      })
      setConfig(updated)
      setUrlsDraft(updated.OLLAMA_BASE_URLS)
      notify('success', 'Connections updated.')
      await syncOllamaModels().catch(() => undefined)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Unable to update connections.')
    } finally {
      setWorking(false)
    }
  }

  async function handleVerify(index: number): Promise<void> {
    setVerifyStates((current) => ({ ...current, [index]: { status: 'loading' } }))
    try {
      const result = await verifyOllamaConnection(index)
      setVerifyStates((current) => ({ ...current, [index]: { status: 'ok', version: result.version || 'unknown' } }))
      notify('success', `Ollama reachable (${result.version || 'unknown'}).`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify Ollama.'
      setVerifyStates((current) => ({ ...current, [index]: { status: 'error', message } }))
      notify('error', message)
    }
  }

  return (
    <div className="workspace-resource-page">
      <PageHeader
        description="Manage local and remote model connections for your workspace."
        label="Settings"
        title="Connections"
      />

      <section className="workspace-resource-section">
        <ResourceCard>
          <ResourceCardCopy>
            <ResourceCardHeading>
              <strong>Ollama API</strong>
            </ResourceCardHeading>
            <p>Connect to a local Ollama instance and automatically import its installed models.</p>
          </ResourceCardCopy>

          <div className="workspace-resource-controls">
            <Field label="Enabled">
              <label className="chat-settings-field-toggle">
                <span>Enable Ollama</span>
                <input
                  checked={enabled}
                  disabled={loading || working}
                  onChange={(event) => {
                    const next = { ENABLE_OLLAMA_API: event.target.checked, OLLAMA_BASE_URLS: urlsDraft }
                    void save(next)
                  }}
                  type="checkbox"
                />
              </label>
            </Field>

            <Field label="Base URLs">
              <div className="workspace-resource-list">
                {urlsDraft.map((url, index) => {
                  const state = verifyStates[index] || { status: 'idle' }
                  return (
                    <div className="workspace-resource-row" key={`ollama-url-${index}`}>
                      <input
                        disabled={loading || working}
                        onChange={(event) =>
                          setUrlsDraft((current) => current.map((entry, idx) => (idx === index ? event.target.value : entry)))
                        }
                        placeholder="http://host.docker.internal:11434"
                        value={url}
                      />
                      <CapsuleButton
                        disabled={loading || working || !enabled}
                        onClick={() => void handleVerify(index)}
                        type="button"
                        variant="secondary"
                      >
                        {state.status === 'loading' ? 'Verifying…' : 'Verify'}
                      </CapsuleButton>
                      <CapsuleButton
                        disabled={loading || working || urlsDraft.length <= 1}
                        onClick={() => setUrlsDraft((current) => current.filter((_, idx) => idx !== index))}
                        type="button"
                        variant="secondary"
                      >
                        Remove
                      </CapsuleButton>
                    </div>
                  )
                })}

                <div className="workspace-resource-row">
                  <CapsuleButton
                    disabled={loading || working}
                    onClick={() => setUrlsDraft((current) => [...current, 'http://host.docker.internal:11434'])}
                    type="button"
                    variant="secondary"
                  >
                    Add URL
                  </CapsuleButton>
                  <CapsuleButton
                    disabled={loading || working}
                    onClick={() => void save({ ENABLE_OLLAMA_API: enabled, OLLAMA_BASE_URLS: urlsDraft })}
                    type="button"
                    variant="primary"
                  >
                    Save
                  </CapsuleButton>
                  <CapsuleButton
                    disabled={loading || working || !enabled}
                    onClick={() => {
                      setWorking(true)
                      void syncOllamaModels()
                        .then(() => notify('success', 'Models synced.'))
                        .catch(() => notify('error', 'Unable to sync models.'))
                        .finally(() => setWorking(false))
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Sync models
                  </CapsuleButton>
                </div>
              </div>

              <p className="workspace-resource-hint">
                If OpenPort runs in Docker, `host.docker.internal:11434` is the usual way to reach Ollama on your host machine.
              </p>
            </Field>
          </div>
        </ResourceCard>
      </section>
    </div>
  )
}

