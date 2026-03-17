'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createWorkspaceConnector,
  createWorkspaceConnectorCredential,
  deleteWorkspaceConnector,
  deleteWorkspaceConnectorCredential,
  fetchWorkspaceConnectorAudit,
  fetchWorkspaceConnectorCredentials,
  fetchWorkspaceConnectors,
  fetchWorkspaceConnectorTasks,
  loadSession,
  retryWorkspaceConnectorTask,
  triggerWorkspaceConnectorSync,
  updateWorkspaceConnector,
  updateWorkspaceConnectorCredential,
  type OpenPortWorkspaceConnector,
  type OpenPortWorkspaceConnectorAuditEvent,
  type OpenPortWorkspaceConnectorCredential,
  type OpenPortWorkspaceConnectorTask
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { ModalShell } from './ui/modal-shell'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'

type OpenPortWorkspaceConnectorAdapter = OpenPortWorkspaceConnector['adapter']

const connectorAdapterOptions: Array<{ value: OpenPortWorkspaceConnectorAdapter; label: string }> = [
  { value: 'directory', label: 'Directory' },
  { value: 'web', label: 'Web' },
  { value: 's3', label: 'S3' },
  { value: 'github', label: 'GitHub' },
  { value: 'notion', label: 'Notion' },
  { value: 'rss', label: 'RSS' }
]

function credentialTemplate(provider: OpenPortWorkspaceConnectorAdapter): Array<{ key: string; label: string; secret: boolean }> {
  if (provider === 's3') {
    return [
      { key: 'accessKeyId', label: 'Access key id', secret: false },
      { key: 'secretAccessKey', label: 'Secret access key', secret: true },
      { key: 'region', label: 'Region', secret: false }
    ]
  }
  if (provider === 'github') {
    return [{ key: 'token', label: 'GitHub token', secret: true }]
  }
  if (provider === 'notion') {
    return [{ key: 'token', label: 'Notion token', secret: true }]
  }
  if (provider === 'rss') {
    return [{ key: 'apiKey', label: 'Feed auth token', secret: true }]
  }
  if (provider === 'web') {
    return [{ key: 'bearerToken', label: 'Bearer token', secret: true }]
  }
  return [{ key: 'localAccess', label: 'Local access confirmation', secret: false }]
}

function adapterSourceHint(adapter: OpenPortWorkspaceConnectorAdapter): string {
  if (adapter === 'directory') return 'Use directory path for local recursive sync.'
  if (adapter === 'web') return 'Provide one or more URLs for web ingestion.'
  if (adapter === 's3') return 'Set bucket and prefix.'
  if (adapter === 'github') return 'Set repository and branch.'
  if (adapter === 'notion') return 'Set Notion database id.'
  return 'Provide RSS feed URLs.'
}

function fieldValuePreview(field: OpenPortWorkspaceConnectorCredential['fields'][number]): string {
  if (!field.configured) return 'not configured'
  return field.valuePreview || 'configured'
}

export function WorkspaceKnowledgeConnectors() {
  const { canManageModule } = useWorkspaceAuthority()
  const canManage = canManageModule('knowledge')
  const [connectors, setConnectors] = useState<OpenPortWorkspaceConnector[]>([])
  const [credentials, setCredentials] = useState<OpenPortWorkspaceConnectorCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [connectorModalOpen, setConnectorModalOpen] = useState(false)
  const [credentialModalOpen, setCredentialModalOpen] = useState(false)
  const [credentialEditId, setCredentialEditId] = useState<string | null>(null)
  const [connectorName, setConnectorName] = useState('')
  const [connectorDescription, setConnectorDescription] = useState('')
  const [connectorAdapter, setConnectorAdapter] = useState<OpenPortWorkspaceConnectorAdapter>('directory')
  const [connectorCredentialId, setConnectorCredentialId] = useState('')
  const [connectorTags, setConnectorTags] = useState('')
  const [connectorEnabled, setConnectorEnabled] = useState(true)
  const [connectorIntervalMinutes, setConnectorIntervalMinutes] = useState(60)
  const [connectorIncremental, setConnectorIncremental] = useState(true)
  const [connectorAutoRetry, setConnectorAutoRetry] = useState(true)
  const [connectorMaxRetries, setConnectorMaxRetries] = useState(3)
  const [connectorRetryBackoff, setConnectorRetryBackoff] = useState(30)
  const [connectorDirectoryPath, setConnectorDirectoryPath] = useState('')
  const [connectorUrls, setConnectorUrls] = useState('')
  const [connectorBucket, setConnectorBucket] = useState('')
  const [connectorPrefix, setConnectorPrefix] = useState('')
  const [connectorRepository, setConnectorRepository] = useState('')
  const [connectorBranch, setConnectorBranch] = useState('main')
  const [connectorNotionDatabaseId, setConnectorNotionDatabaseId] = useState('')
  const [connectorRssFeeds, setConnectorRssFeeds] = useState('')
  const [credentialName, setCredentialName] = useState('')
  const [credentialDescription, setCredentialDescription] = useState('')
  const [credentialProvider, setCredentialProvider] = useState<OpenPortWorkspaceConnectorAdapter>('directory')
  const [credentialFields, setCredentialFields] = useState<Array<{ key: string; label: string; secret: boolean; value: string }>>(
    credentialTemplate('directory').map((field) => ({ ...field, value: '' }))
  )
  const [activeConnectorId, setActiveConnectorId] = useState<string | null>(null)
  const [tasksByConnector, setTasksByConnector] = useState<Record<string, OpenPortWorkspaceConnectorTask[]>>({})
  const [auditByConnector, setAuditByConnector] = useState<Record<string, OpenPortWorkspaceConnectorAuditEvent[]>>({})

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const [connectorResponse, credentialResponse] = await Promise.all([
        fetchWorkspaceConnectors(loadSession()),
        fetchWorkspaceConnectorCredentials(loadSession())
      ])
      setConnectors(connectorResponse.items)
      setCredentials(credentialResponse.items)
    } catch {
      setConnectors([])
      setCredentials([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function loadConnectorActivity(connectorId: string): Promise<void> {
    try {
      const [tasksResponse, auditResponse] = await Promise.all([
        fetchWorkspaceConnectorTasks(connectorId, loadSession()),
        fetchWorkspaceConnectorAudit(connectorId, loadSession())
      ])
      setTasksByConnector((current) => ({ ...current, [connectorId]: tasksResponse.items }))
      setAuditByConnector((current) => ({ ...current, [connectorId]: auditResponse.items }))
    } catch {
      setTasksByConnector((current) => ({ ...current, [connectorId]: [] }))
      setAuditByConnector((current) => ({ ...current, [connectorId]: [] }))
    }
  }

  useEffect(() => {
    if (!activeConnectorId) return
    void loadConnectorActivity(activeConnectorId)
  }, [activeConnectorId])

  useEffect(() => {
    setCredentialFields(credentialTemplate(credentialProvider).map((field) => ({ ...field, value: '' })))
  }, [credentialProvider])

  const activeConnector = useMemo(
    () => (activeConnectorId ? connectors.find((item) => item.id === activeConnectorId) || null : null),
    [activeConnectorId, connectors]
  )

  async function handleCreateConnector(): Promise<void> {
    if (!connectorName.trim()) {
      notify('error', 'Connector name is required.')
      return
    }
    setWorkingId('connector:create')
    try {
      await createWorkspaceConnector(
        {
          name: connectorName.trim(),
          adapter: connectorAdapter,
          description: connectorDescription.trim(),
          enabled: connectorEnabled,
          credentialId: connectorCredentialId || null,
          tags: connectorTags.split(',').map((entry) => entry.trim()).filter(Boolean),
          schedule: {
            enabled: true,
            intervalMinutes: connectorIntervalMinutes,
            timezone: 'UTC',
            incremental: connectorIncremental,
            nextRunAt: null
          },
          syncPolicy: {
            autoRetry: connectorAutoRetry,
            maxRetries: connectorMaxRetries,
            retryBackoffSeconds: connectorRetryBackoff,
            maxDocumentsPerRun: 500
          },
          sourceConfig: {
            directoryPath: connectorDirectoryPath.trim(),
            urls: connectorUrls
              .split('\n')
              .map((entry) => entry.trim())
              .filter(Boolean),
            bucket: connectorBucket.trim(),
            prefix: connectorPrefix.trim(),
            repository: connectorRepository.trim(),
            branch: connectorBranch.trim() || 'main',
            notionDatabaseId: connectorNotionDatabaseId.trim(),
            rssFeedUrls: connectorRssFeeds
              .split('\n')
              .map((entry) => entry.trim())
              .filter(Boolean),
            includePatterns: [],
            excludePatterns: []
          }
        },
        loadSession()
      )
      notify('success', 'Connector created.')
      setConnectorModalOpen(false)
      void load()
    } catch {
      notify('error', 'Unable to create connector.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleCreateOrRotateCredential(): Promise<void> {
    if (!credentialName.trim()) {
      notify('error', 'Credential name is required.')
      return
    }
    setWorkingId(credentialEditId || 'credential:create')
    try {
      if (credentialEditId) {
        await updateWorkspaceConnectorCredential(
          credentialEditId,
          {
            name: credentialName.trim(),
            provider: credentialProvider,
            description: credentialDescription.trim(),
            fields: credentialFields
          },
          loadSession()
        )
        notify('success', 'Credential rotated.')
      } else {
        await createWorkspaceConnectorCredential(
          {
            name: credentialName.trim(),
            provider: credentialProvider,
            description: credentialDescription.trim(),
            fields: credentialFields
          },
          loadSession()
        )
        notify('success', 'Credential created.')
      }
      setCredentialModalOpen(false)
      setCredentialEditId(null)
      void load()
    } catch {
      notify('error', 'Unable to save credential.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleToggleConnector(connector: OpenPortWorkspaceConnector, enabled: boolean): Promise<void> {
    setWorkingId(connector.id)
    try {
      await updateWorkspaceConnector(
        connector.id,
        { enabled },
        loadSession()
      )
      notify('success', enabled ? 'Connector enabled.' : 'Connector disabled.')
      void load()
    } catch {
      notify('error', 'Unable to update connector status.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleRunSync(connector: OpenPortWorkspaceConnector, mode: 'full' | 'incremental'): Promise<void> {
    setWorkingId(`run:${connector.id}`)
    try {
      await triggerWorkspaceConnectorSync(connector.id, { mode }, loadSession())
      notify('success', `${mode === 'incremental' ? 'Incremental' : 'Full'} sync queued.`)
      if (activeConnectorId === connector.id) {
        void loadConnectorActivity(connector.id)
      }
      void load()
    } catch {
      notify('error', 'Unable to queue connector sync.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleRetryTask(connectorId: string, taskId: string): Promise<void> {
    setWorkingId(taskId)
    try {
      await retryWorkspaceConnectorTask(taskId, loadSession())
      notify('success', 'Retry queued.')
      void loadConnectorActivity(connectorId)
    } catch {
      notify('error', 'Unable to retry task.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleDeleteConnector(connectorId: string): Promise<void> {
    if (!window.confirm('Delete this connector and its task/audit history?')) return
    setWorkingId(connectorId)
    try {
      await deleteWorkspaceConnector(connectorId, loadSession())
      notify('success', 'Connector deleted.')
      if (activeConnectorId === connectorId) {
        setActiveConnectorId(null)
      }
      void load()
    } catch {
      notify('error', 'Unable to delete connector.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleDeleteCredential(credentialId: string): Promise<void> {
    if (!window.confirm('Delete this credential?')) return
    setWorkingId(credentialId)
    try {
      await deleteWorkspaceConnectorCredential(credentialId, loadSession())
      notify('success', 'Credential deleted.')
      void load()
    } catch {
      notify('error', 'Unable to delete credential.')
    } finally {
      setWorkingId(null)
    }
  }

  function openRotateCredential(credential: OpenPortWorkspaceConnectorCredential): void {
    setCredentialEditId(credential.id)
    setCredentialName(credential.name)
    setCredentialProvider(credential.provider)
    setCredentialDescription(credential.description)
    setCredentialFields(
      credential.fields.map((field) => ({
        key: field.key,
        label: field.label,
        secret: field.secret,
        value: ''
      }))
    )
    setCredentialModalOpen(true)
  }

  function resetCredentialModal(): void {
    setCredentialEditId(null)
    setCredentialName('')
    setCredentialProvider('directory')
    setCredentialDescription('')
    setCredentialFields(credentialTemplate('directory').map((field) => ({ ...field, value: '' })))
  }

  return (
    <div className="workspace-module-shell">
      <ModalShell
        bodyClassName="workspace-tool-modal-body"
        dialogClassName="project-dialog workspace-tool-modal workspace-tool-modal--wide"
        onClose={() => {
          setConnectorModalOpen(false)
        }}
        open={connectorModalOpen}
        title="Create connector"
      >
        <div className="workspace-tool-modal-section">
          <Field label="Name">
            <input onChange={(event) => setConnectorName(event.target.value)} value={connectorName} />
          </Field>
          <Field label="Adapter">
            <select onChange={(event) => setConnectorAdapter(event.target.value as OpenPortWorkspaceConnectorAdapter)} value={connectorAdapter}>
              {connectorAdapterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input onChange={(event) => setConnectorDescription(event.target.value)} value={connectorDescription} />
          </Field>
          <Field label="Credential">
            <select onChange={(event) => setConnectorCredentialId(event.target.value)} value={connectorCredentialId}>
              <option value="">No credential</option>
              {credentials.map((credential) => (
                <option key={credential.id} value={credential.id}>
                  {credential.name} ({credential.provider})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tags">
            <input onChange={(event) => setConnectorTags(event.target.value)} placeholder="prod, ingest" value={connectorTags} />
          </Field>
          <Field label="Sync every (minutes)">
            <input
              min={5}
              onChange={(event) => setConnectorIntervalMinutes(Number(event.target.value) || 60)}
              type="number"
              value={connectorIntervalMinutes}
            />
          </Field>
          <Field label="Retry backoff (seconds)">
            <input
              min={5}
              onChange={(event) => setConnectorRetryBackoff(Number(event.target.value) || 30)}
              type="number"
              value={connectorRetryBackoff}
            />
          </Field>
          <Field label="Max retries">
            <input
              min={0}
              onChange={(event) => setConnectorMaxRetries(Number(event.target.value) || 0)}
              type="number"
              value={connectorMaxRetries}
            />
          </Field>
          <label className="workspace-editor-checkbox">
            <input checked={connectorEnabled} onChange={(event) => setConnectorEnabled(event.target.checked)} type="checkbox" />
            <span>Enabled</span>
          </label>
          <label className="workspace-editor-checkbox">
            <input checked={connectorIncremental} onChange={(event) => setConnectorIncremental(event.target.checked)} type="checkbox" />
            <span>Prefer incremental sync</span>
          </label>
          <label className="workspace-editor-checkbox">
            <input checked={connectorAutoRetry} onChange={(event) => setConnectorAutoRetry(event.target.checked)} type="checkbox" />
            <span>Auto retry on failures</span>
          </label>
          <p className="workspace-module-empty">{adapterSourceHint(connectorAdapter)}</p>
          <Field label="Directory path">
            <input onChange={(event) => setConnectorDirectoryPath(event.target.value)} value={connectorDirectoryPath} />
          </Field>
          <Field label="URLs (one per line)">
            <textarea onChange={(event) => setConnectorUrls(event.target.value)} rows={3} value={connectorUrls} />
          </Field>
          <Field label="S3 bucket">
            <input onChange={(event) => setConnectorBucket(event.target.value)} value={connectorBucket} />
          </Field>
          <Field label="S3 prefix">
            <input onChange={(event) => setConnectorPrefix(event.target.value)} value={connectorPrefix} />
          </Field>
          <Field label="Repository">
            <input onChange={(event) => setConnectorRepository(event.target.value)} value={connectorRepository} />
          </Field>
          <Field label="Branch">
            <input onChange={(event) => setConnectorBranch(event.target.value)} value={connectorBranch} />
          </Field>
          <Field label="Notion database id">
            <input onChange={(event) => setConnectorNotionDatabaseId(event.target.value)} value={connectorNotionDatabaseId} />
          </Field>
          <Field label="RSS feeds (one per line)">
            <textarea onChange={(event) => setConnectorRssFeeds(event.target.value)} rows={3} value={connectorRssFeeds} />
          </Field>
          <div className="workspace-editor-actions">
            <CapsuleButton disabled={workingId === 'connector:create'} onClick={() => void handleCreateConnector()} type="button" variant="primary">
              Create connector
            </CapsuleButton>
            <CapsuleButton onClick={() => setConnectorModalOpen(false)} type="button" variant="secondary">
              Close
            </CapsuleButton>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        bodyClassName="workspace-tool-modal-body"
        dialogClassName="project-dialog workspace-tool-modal"
        onClose={() => {
          setCredentialModalOpen(false)
          resetCredentialModal()
        }}
        open={credentialModalOpen}
        title={credentialEditId ? 'Rotate credential' : 'Create credential'}
      >
        <div className="workspace-tool-modal-section">
          <Field label="Name">
            <input onChange={(event) => setCredentialName(event.target.value)} value={credentialName} />
          </Field>
          <Field label="Provider">
            <select onChange={(event) => setCredentialProvider(event.target.value as OpenPortWorkspaceConnectorAdapter)} value={credentialProvider}>
              {connectorAdapterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input onChange={(event) => setCredentialDescription(event.target.value)} value={credentialDescription} />
          </Field>
          {credentialFields.map((field, index) => (
            <Field key={`${field.key}-${index}`} label={field.label}>
              <input
                onChange={(event) =>
                  setCredentialFields((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, value: event.target.value } : entry
                    )
                  )
                }
                placeholder={field.secret ? 'Enter secret value' : 'Enter value'}
                type={field.secret ? 'password' : 'text'}
                value={field.value}
              />
            </Field>
          ))}
          <div className="workspace-editor-actions">
            <CapsuleButton
              disabled={workingId === 'credential:create' || workingId === credentialEditId}
              onClick={() => void handleCreateOrRotateCredential()}
              type="button"
              variant="primary"
            >
              {credentialEditId ? 'Rotate credential' : 'Create credential'}
            </CapsuleButton>
            <CapsuleButton
              onClick={() => {
                setCredentialModalOpen(false)
                resetCredentialModal()
              }}
              type="button"
              variant="secondary"
            >
              Close
            </CapsuleButton>
          </div>
        </div>
      </ModalShell>

      <PageHeader
        actions={
          <div className="workspace-resource-header-actions">
            <CapsuleButton href="/workspace/knowledge" variant="secondary">Back to knowledge</CapsuleButton>
            {canManage ? (
              <CapsuleButton
                onClick={() => {
                  resetCredentialModal()
                  setCredentialModalOpen(true)
                }}
                variant="secondary"
              >
                New credential
              </CapsuleButton>
            ) : null}
            {canManage ? <CapsuleButton onClick={() => setConnectorModalOpen(true)} variant="primary">New connector</CapsuleButton> : null}
          </div>
        }
        description="Connector credentials, schedule/incremental sync, retry pipeline, and audit/task visibility."
        label="Workspace"
        title="Knowledge connectors"
      />

      <div className="workspace-module-chip-row">
        <Tag>{connectors.length} connectors</Tag>
        <Tag>{credentials.length} credentials</Tag>
      </div>

      <section className="workspace-editor-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Connector credentials</strong></ResourceCardHeading>
          <span>Credential profiles are masked and reusable across adapters.</span>
        </ResourceCardCopy>
        {loading ? <p className="workspace-module-empty">Loading credentials…</p> : null}
        {!loading && credentials.length === 0 ? <p className="workspace-module-empty">No connector credentials yet.</p> : null}
        {credentials.map((credential) => (
          <ResourceCard key={credential.id}>
            <ResourceCardCopy>
              <ResourceCardHeading><strong>{credential.name}</strong></ResourceCardHeading>
              <span>{credential.provider} · {credential.description || 'Credential profile'}</span>
              <div className="workspace-module-chip-row">
                {credential.fields.map((field) => (
                  <Tag key={`${credential.id}-${field.key}`}>
                    {field.key}: {fieldValuePreview(field)}
                  </Tag>
                ))}
              </div>
            </ResourceCardCopy>
            <ResourceCardActions>
              {canManage ? <CapsuleButton onClick={() => openRotateCredential(credential)} size="sm" variant="secondary">Rotate</CapsuleButton> : null}
              {canManage ? (
                <CapsuleButton
                  disabled={workingId === credential.id}
                  onClick={() => void handleDeleteCredential(credential.id)}
                  size="sm"
                  variant="secondary"
                >
                  Delete
                </CapsuleButton>
              ) : null}
            </ResourceCardActions>
          </ResourceCard>
        ))}
      </section>

      <section className="workspace-editor-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Connectors</strong></ResourceCardHeading>
          <span>Adapters with scheduler, incremental sync, retry policy, and runtime task ledger.</span>
        </ResourceCardCopy>
        {loading ? <p className="workspace-module-empty">Loading connectors…</p> : null}
        {!loading && connectors.length === 0 ? <p className="workspace-module-empty">No connectors configured yet.</p> : null}
        {connectors.map((connector) => (
          <ResourceCard key={connector.id}>
            <ResourceCardCopy>
              <ResourceCardHeading><strong>{connector.name}</strong></ResourceCardHeading>
              <span>{connector.adapter} · {connector.description || 'No description'}</span>
              <div className="workspace-module-chip-row">
                <Tag>{connector.enabled ? 'enabled' : 'disabled'}</Tag>
                <Tag>{connector.status.health}</Tag>
                <Tag>{connector.schedule.incremental ? 'incremental' : 'full'} schedule</Tag>
                <Tag>{connector.schedule.intervalMinutes} min</Tag>
                <Tag>{connector.syncPolicy.maxRetries} retries</Tag>
                <Tag>{connector.syncPolicy.retryBackoffSeconds}s backoff</Tag>
              </div>
            </ResourceCardCopy>
            <ResourceCardActions>
              {canManage ? (
                <CapsuleButton
                  disabled={workingId === connector.id}
                  onClick={() => void handleToggleConnector(connector, !connector.enabled)}
                  size="sm"
                  variant="secondary"
                >
                  {connector.enabled ? 'Disable' : 'Enable'}
                </CapsuleButton>
              ) : null}
              {canManage ? (
                <CapsuleButton
                  disabled={workingId === `run:${connector.id}`}
                  onClick={() => void handleRunSync(connector, 'incremental')}
                  size="sm"
                  variant="secondary"
                >
                  Run incremental
                </CapsuleButton>
              ) : null}
              {canManage ? (
                <CapsuleButton
                  disabled={workingId === `run:${connector.id}`}
                  onClick={() => void handleRunSync(connector, 'full')}
                  size="sm"
                  variant="secondary"
                >
                  Run full
                </CapsuleButton>
              ) : null}
              <CapsuleButton
                onClick={() => {
                  setActiveConnectorId(connector.id)
                  void loadConnectorActivity(connector.id)
                }}
                size="sm"
                variant="secondary"
              >
                Activity
              </CapsuleButton>
              {canManage ? (
                <CapsuleButton
                  disabled={workingId === connector.id}
                  onClick={() => void handleDeleteConnector(connector.id)}
                  size="sm"
                  variant="secondary"
                >
                  Delete
                </CapsuleButton>
              ) : null}
            </ResourceCardActions>
          </ResourceCard>
        ))}
      </section>

      {activeConnector ? (
        <section className="workspace-editor-section">
          <ResourceCardCopy className="workspace-editor-section-heading">
            <ResourceCardHeading><strong>Activity: {activeConnector.name}</strong></ResourceCardHeading>
            <span>Task queue, retry flow, and audit ledger.</span>
          </ResourceCardCopy>
          <div className="workspace-resource-detail-grid">
            <article className="workspace-resource-detail-card">
              <strong>Tasks</strong>
              <p>{(tasksByConnector[activeConnector.id] || []).length}</p>
            </article>
            <article className="workspace-resource-detail-card">
              <strong>Audit events</strong>
              <p>{(auditByConnector[activeConnector.id] || []).length}</p>
            </article>
          </div>
          <div className="workspace-valve-list">
            {(tasksByConnector[activeConnector.id] || []).slice(0, 8).map((task) => (
              <div key={task.id} className="workspace-valve-schema-row">
                <strong>{task.trigger}/{task.mode}</strong>
                <Tag>{task.status}</Tag>
                <span>attempt {task.attempt}/{task.maxAttempts}</span>
                <span>{task.summary.scanned} scanned</span>
                <span>{task.errorMessage || 'no error'}</span>
                {task.status === 'failed' && canManage ? (
                  <CapsuleButton
                    disabled={workingId === task.id}
                    onClick={() => void handleRetryTask(activeConnector.id, task.id)}
                    size="sm"
                    variant="secondary"
                  >
                    Retry
                  </CapsuleButton>
                ) : null}
              </div>
            ))}
            {(tasksByConnector[activeConnector.id] || []).length === 0 ? <p className="workspace-module-empty">No tasks yet.</p> : null}
          </div>
          <div className="workspace-valve-list">
            {(auditByConnector[activeConnector.id] || []).slice(0, 12).map((event) => (
              <div key={event.id} className="workspace-valve-schema-row">
                <Tag>{event.level}</Tag>
                <strong>{event.action}</strong>
                <span>{event.message}</span>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {(auditByConnector[activeConnector.id] || []).length === 0 ? <p className="workspace-module-empty">No audit events yet.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
