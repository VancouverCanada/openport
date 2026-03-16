'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createWorkspaceTool,
  deleteWorkspaceTool,
  fetchWorkspaceToolPackage,
  fetchWorkspaceTools,
  importWorkspaceToolPackage,
  loadSession,
  type OpenPortWorkspaceTool
} from '../lib/openport-api'
import { downloadJsonFile, normalizeImportedItems, readJsonFile } from '../lib/workspace-resource-io'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { WorkspaceResourceAccessModal } from './workspace-resource-access-modal'
import { WorkspaceToolPackageModal } from './workspace-tool-package-modal'
import { WorkspaceToolMenu } from './workspace-tool-menu'
import { Tag } from './ui/tag'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function resolveToolPackagePayload(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value)
  if (!record) return null
  const wrapped = asRecord(record.package)
  if (wrapped) return wrapped
  if (asRecord(record.tool)) return record
  return null
}

export function WorkspaceTools() {
  const [items, setItems] = useState<OpenPortWorkspaceTool[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [integrationFilter, setIntegrationFilter] = useState('all')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'integration' | 'examples' | 'chain'>('updated')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [accessToolId, setAccessToolId] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [packageModalOpen, setPackageModalOpen] = useState(false)
  const [packageModalTargetToolId, setPackageModalTargetToolId] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canManage = canManageModule('tools')
  const canImport = canModuleAction('tools', 'import')
  const canExport = canModuleAction('tools', 'export')
  const canShare = canModuleAction('tools', 'share')

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const response = await fetchWorkspaceTools(loadSession())
      setItems(response.items)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [query, enabledFilter, integrationFilter, scopeFilter, tagFilter, sortBy, sortDirection, pageSize])

  async function handleDelete(id: string): Promise<void> {
    try {
      await deleteWorkspaceTool(id, loadSession())
      notify('success', 'Tool deleted.')
      await load()
    } catch {
      notify('error', 'Unable to delete tool.')
    }
  }

  async function handleDuplicate(item: OpenPortWorkspaceTool): Promise<void> {
    setWorkingId(item.id)
    try {
      await createWorkspaceTool(
        {
          name: `${item.name} Copy`,
          description: item.description,
          integrationId: item.integrationId,
          enabled: item.enabled,
          scopes: item.scopes,
          tags: item.tags,
          manifest: item.manifest,
          valves: item.valves,
          valveSchema: item.valveSchema,
          examples: item.examples,
          executionChain: item.executionChain
        },
        loadSession()
      )
      notify('success', 'Tool duplicated.')
      await load()
    } catch {
      notify('error', 'Unable to duplicate tool.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleCopyManifest(item: OpenPortWorkspaceTool): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.manifest)
      notify('success', 'Manifest copied.')
    } catch {
      notify('error', 'Unable to copy manifest.')
    }
  }

  async function handleCopyJson(item: OpenPortWorkspaceTool): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(item, null, 2))
      notify('success', 'Tool JSON copied.')
    } catch {
      notify('error', 'Unable to copy tool JSON.')
    }
  }

  async function handleCopyVisibleJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(filteredItems, null, 2))
      notify('success', 'Visible tools copied as JSON.')
    } catch {
      notify('error', 'Unable to copy visible tools.')
    }
  }

  async function handleCopyVisibleManifests(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        filteredItems
          .map((item) => `# ${item.name}\n${item.manifest}`.trim())
          .join('\n\n')
      )
      notify('success', 'Visible manifests copied.')
    } catch {
      notify('error', 'Unable to copy visible manifests.')
    }
  }

  function buildRuntimePayload(item: OpenPortWorkspaceTool) {
    return {
      name: item.name,
      integrationId: item.integrationId,
      enabled: item.enabled,
      scopes: item.scopes,
      tags: item.tags,
      manifest: item.manifest,
      valves: item.valves,
      schema: item.valveSchema,
      examples: item.examples,
      executionChain: item.executionChain
    }
  }

  async function handleCopyRuntimePayload(item: OpenPortWorkspaceTool): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildRuntimePayload(item), null, 2))
      notify('success', 'Runtime payload copied.')
    } catch {
      notify('error', 'Unable to copy runtime payload.')
    }
  }

  function handleDownloadVisibleRuntimeBundle(): void {
    downloadJsonFile(
      'openport-tool-runtime-bundle.json',
      {
        items: filteredItems.map((item) => buildRuntimePayload(item))
      }
    )
  }

  function handleExportItem(item: OpenPortWorkspaceTool): void {
    downloadJsonFile(`openport-tool-${item.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || item.id}.json`, { items: [item] })
  }

  async function handleExportPackage(item: OpenPortWorkspaceTool): Promise<void> {
    try {
      const response = await fetchWorkspaceToolPackage(item.id, loadSession())
      downloadJsonFile(
        `openport-tool-package-${item.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || item.id}.json`,
        { package: response.package }
      )
      notify('success', 'Tool package exported.')
    } catch {
      notify('error', 'Unable to export tool package.')
    }
  }

  async function handleCopyPackagePayload(item: OpenPortWorkspaceTool): Promise<void> {
    try {
      const response = await fetchWorkspaceToolPackage(item.id, loadSession())
      await navigator.clipboard.writeText(JSON.stringify(response.package, null, 2))
      notify('success', 'Tool package copied.')
    } catch {
      notify('error', 'Unable to copy tool package.')
    }
  }

  async function handleImportPackagePayload(
    rawPayload: Record<string, unknown>,
    options: {
      targetToolId?: string
      forceEnable?: boolean
    } = {}
  ): Promise<boolean> {
    const payload = resolveToolPackagePayload(rawPayload)
    if (!payload) {
      notify('error', 'Payload is not a valid tool package.')
      return false
    }

    try {
      const response = await importWorkspaceToolPackage(
        {
          package: payload,
          targetToolId: options.targetToolId,
          forceEnable: options.forceEnable
        },
        loadSession()
      )
      notify(
        'success',
        `Tool package imported (${response.validation.errors.length} errors, ${response.validation.warnings.length} warnings).`
      )
      await load()
      return true
    } catch {
      notify('error', 'Unable to import tool package.')
      return false
    }
  }

  async function handleImport(file: File): Promise<void> {
    try {
      const parsed = await readJsonFile(file)
      const packagePayload = resolveToolPackagePayload(parsed)
      if (packagePayload) {
        await handleImportPackagePayload(packagePayload)
        return
      }

      const imported = normalizeImportedItems<OpenPortWorkspaceTool>(parsed)
      if (imported.length === 0) {
        notify('error', 'No tools found in import payload.')
        return
      }
      for (const item of imported) {
        await createWorkspaceTool(
          {
            id: item.id,
            name: item.name,
            description: item.description,
            integrationId: item.integrationId,
            enabled: item.enabled,
            scopes: item.scopes,
            tags: item.tags,
            manifest: item.manifest,
            valves: item.valves,
            valveSchema: item.valveSchema,
            examples: item.examples,
            executionChain: item.executionChain
          },
          loadSession()
        )
      }
      notify('success', `Imported ${imported.length} tools.`)
      await load()
    } catch {
      notify('error', 'Unable to import tools.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const filteredItems = items.filter((item) => {
    if (enabledFilter === 'enabled' && !item.enabled) return false
    if (enabledFilter === 'disabled' && item.enabled) return false
    if (integrationFilter !== 'all' && (item.integrationId || 'none') !== integrationFilter) return false
    if (scopeFilter !== 'all' && !item.scopes.includes(scopeFilter)) return false
    if (tagFilter !== 'all' && !item.tags.includes(tagFilter)) return false
    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [
      item.name,
      item.description,
      item.integrationId || '',
      ...item.scopes,
      ...item.tags,
      item.manifest,
      ...Object.keys(item.valves),
      ...item.examples.map((example) => `${example.name} ${example.input} ${example.output}`)
    ].join(' ').toLowerCase().includes(normalizedQuery)
  })
  const sortedItems = [...filteredItems].sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    if (sortBy === 'name') return left.name.localeCompare(right.name) * direction
    if (sortBy === 'integration') return (left.integrationId || '').localeCompare(right.integrationId || '') * direction
    if (sortBy === 'examples') return (left.examples.length - right.examples.length) * direction
    if (sortBy === 'chain') return (left.executionChain.steps.length - right.executionChain.steps.length) * direction
    return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction
  })
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedItems = sortedItems.slice((safePage - 1) * pageSize, safePage * pageSize)
  const integrations = Array.from(new Set(items.map((item) => item.integrationId || 'none'))).sort((left, right) => left.localeCompare(right))
  const scopes = Array.from(new Set(items.flatMap((item) => item.scopes))).sort((left, right) => left.localeCompare(right))
  const tags = Array.from(new Set(items.flatMap((item) => item.tags))).sort((left, right) => left.localeCompare(right))
  const summary = {
    total: items.length,
    enabled: items.filter((item) => item.enabled).length,
    manifests: items.filter((item) => item.manifest.trim()).length,
    examples: items.filter((item) => item.examples.length > 0).length
  }

  return (
    <div className="workspace-resource-page">
      <WorkspaceResourceAccessModal
        module="tools"
        onClose={() => setAccessToolId(null)}
        open={Boolean(accessToolId)}
        resourceId={accessToolId || ''}
        resourceLabel="Tool"
      />
      <PageHeader
        actions={
          <>
          {canExport ? <CapsuleButton onClick={() => downloadJsonFile('openport-workspace-tools.json', { items })} type="button" variant="secondary">Export</CapsuleButton> : null}
          {canExport ? <CapsuleButton onClick={() => void handleCopyVisibleJson()} type="button" variant="secondary">Copy visible JSON</CapsuleButton> : null}
          {canExport ? <CapsuleButton onClick={() => void handleCopyVisibleManifests()} type="button" variant="secondary">Copy visible manifests</CapsuleButton> : null}
          {canExport ? <CapsuleButton onClick={handleDownloadVisibleRuntimeBundle} type="button" variant="secondary">Runtime bundle</CapsuleButton> : null}
          {canImport ? <CapsuleButton onClick={() => { setPackageModalTargetToolId(undefined); setPackageModalOpen(true) }} type="button" variant="secondary">Import package</CapsuleButton> : null}
          {canImport ? <CapsuleButton onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">Import</CapsuleButton> : null}
          {canManage ? <CapsuleButton href="/workspace/tools/create" variant="primary">New tool</CapsuleButton> : null}
          <input
            accept="application/json"
            className="workspace-hidden-input"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
            }}
            ref={fileInputRef}
            type="file"
          />
          </>
        }
        description="Maintain tool manifests and integration bindings exposed to chat and model flows."
        label="Workspace"
        title="Tools"
      />
      <WorkspaceToolPackageModal
        defaultTargetToolId={packageModalTargetToolId}
        onClose={() => setPackageModalOpen(false)}
        onSubmit={async (input) => {
          const ok = await handleImportPackagePayload(input.packagePayload, {
            targetToolId: input.targetToolId,
            forceEnable: input.forceEnable
          })
          if (!ok) {
            throw new Error('Import failed')
          }
        }}
        open={packageModalOpen}
        tools={items.map((item) => ({ id: item.id, name: item.name }))}
      />

      <section className="workspace-resource-section">
        <div className="workspace-resource-detail-grid">
          <article className="workspace-resource-detail-card">
            <strong>Total</strong>
            <p>{summary.total}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Enabled</strong>
            <p>{summary.enabled}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Manifested</strong>
            <p>{summary.manifests}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Examples</strong>
            <p>{summary.examples}</p>
          </article>
        </div>
        <div className="workspace-resource-filters">
          <Field label="Search">
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Name, integration, scope" value={query} />
          </Field>
          <Field label="State">
            <select onChange={(event) => setEnabledFilter(event.target.value as typeof enabledFilter)} value={enabledFilter}>
              <option value="all">All tools</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </Field>
          <Field label="Integration">
            <select onChange={(event) => setIntegrationFilter(event.target.value)} value={integrationFilter}>
              <option value="all">All integrations</option>
              {integrations.map((integration) => (
                <option key={integration} value={integration}>
                  {integration}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scope">
            <select onChange={(event) => setScopeFilter(event.target.value)} value={scopeFilter}>
              <option value="all">All scopes</option>
              {scopes.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tag">
            <select onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
              <option value="all">All tags</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort by">
            <select onChange={(event) => setSortBy(event.target.value as typeof sortBy)} value={sortBy}>
              <option value="updated">Updated</option>
              <option value="name">Name</option>
              <option value="integration">Integration</option>
              <option value="examples">Examples</option>
              <option value="chain">Chain steps</option>
            </select>
          </Field>
          <Field label="Direction">
            <select onChange={(event) => setSortDirection(event.target.value as typeof sortDirection)} value={sortDirection}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </Field>
          <Field label="Page size">
            <select onChange={(event) => setPageSize(Number(event.target.value) || 20)} value={String(pageSize)}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="40">40</option>
            </select>
          </Field>
        </div>
        {!loading ? (
          <div className="workspace-module-chip-row">
            <Tag>{sortedItems.length} total</Tag>
            <Tag>Page {safePage} / {totalPages}</Tag>
            <CapsuleButton disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button" variant="secondary">Previous</CapsuleButton>
            <CapsuleButton disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} type="button" variant="secondary">Next</CapsuleButton>
          </div>
        ) : null}
        {loading ? <p className="workspace-module-empty">Loading tools…</p> : null}
        {!loading && sortedItems.length === 0 ? <p className="workspace-module-empty">No tools match this filter.</p> : null}
        {!loading ? (
          <div className="workspace-resource-list">
            {pagedItems.map((item) => (
              <ResourceCard
                key={item.id}
                actions={
                  <ResourceCardActions>
                    <WorkspaceToolMenu
                      canExport={canExport}
                      canImport={canImport}
                      canShare={canShare}
                      canManage={canManage}
                      item={item}
                      onAccess={canShare ? () => setAccessToolId(item.id) : undefined}
                      onCopyJson={() => void handleCopyJson(item)}
                      onCopyManifest={() => void handleCopyManifest(item)}
                      onCopyPackagePayload={() => void handleCopyPackagePayload(item)}
                      onCopyRuntimePayload={() => void handleCopyRuntimePayload(item)}
                      onDelete={() => void handleDelete(item.id)}
                      onDuplicate={() => void handleDuplicate(item)}
                      onExport={() => handleExportItem(item)}
                      onExportPackage={() => void handleExportPackage(item)}
                      onImportPackage={() => {
                        setPackageModalTargetToolId(item.id)
                        setPackageModalOpen(true)
                      }}
                      working={workingId === item.id}
                    />
                  </ResourceCardActions>
                }
              >
                <ResourceCardCopy>
                  <ResourceCardHeading>
                    <strong>{item.name}</strong>
                    <span className={`status-pill${item.enabled ? '' : ' is-disabled'}`}>{item.enabled ? 'enabled' : 'disabled'}</span>
                  </ResourceCardHeading>
                  <p>{item.description || 'No description provided.'}</p>
                  <div className="workspace-module-chip-row">
                    {item.integrationId ? <Tag>{item.integrationId}</Tag> : null}
                    {item.scopes.map((scope) => (
                      <Tag key={scope}>{scope}</Tag>
                    ))}
                    {item.tags.slice(0, 2).map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                    {item.manifest.trim() ? <Tag>manifest</Tag> : null}
                    {Object.keys(item.valves).length > 0 ? (
                      <Tag>{Object.keys(item.valves).length} valves</Tag>
                    ) : null}
                    {item.valveSchema.length > 0 ? <Tag>{item.valveSchema.length} schema</Tag> : null}
                    {item.examples.length > 0 ? <Tag>{item.examples.length} examples</Tag> : null}
                    {item.executionChain.enabled ? <Tag>{item.executionChain.steps.length} chain steps</Tag> : null}
                    {Object.keys(item.valves)
                      .slice(0, 2)
                      .map((key) => (
                        <Tag key={key}>{key}</Tag>
                      ))}
                    {item.valveSchema.slice(0, 2).map((field) => (
                      <Tag key={field.id}>{field.key}:{field.type}</Tag>
                    ))}
                  </div>
                  {item.examples.length > 0 ? (
                    <p>
                      Example: <strong>{item.examples[0].name}</strong>
                    </p>
                  ) : null}
                </ResourceCardCopy>
              </ResourceCard>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
