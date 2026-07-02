'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createWorkspaceTool,
  deleteWorkspaceTool,
  fetchWorkspaceTools,
  loadSession,
  type OpenPortWorkspaceTool
} from '../lib/openport-api'
import { downloadJsonFile, normalizeImportedItems, readJsonFile } from '../lib/workspace-resource-io'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { FieldInput } from './ui/field-input'
import { FieldSelect } from './ui/field-select'
import { PageHeader } from './ui/page-header'
import { WorkspacePagination } from './ui/workspace-pagination'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { WorkspaceEmptyState } from './ui/workspace-empty-state'
import { WorkspaceToolAddMenu } from './workspace-tool-add-menu'
import { WorkspaceToolMenu } from './workspace-tool-menu'
import { Tag } from './ui/tag'

export function WorkspaceTools() {
  const [items, setItems] = useState<OpenPortWorkspaceTool[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewFilter, setViewFilter] = useState<'all' | 'shared'>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'integration' | 'examples'>('updated')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canManage = canManageModule('tools')
  const canImport = canModuleAction('tools', 'import')
  const canExport = canModuleAction('tools', 'export')
  const canShare = canModuleAction('tools', 'share')
  const activeSession = loadSession()

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
  }, [query, viewFilter, sortBy, sortDirection, pageSize])

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
          examples: item.examples
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

  function handleExportItem(item: OpenPortWorkspaceTool): void {
    downloadJsonFile(`openport-tool-${item.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || item.id}.json`, { items: [item] })
  }

  async function handleShareToCommunity(item: OpenPortWorkspaceTool): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(item, null, 2))
      notify('success', 'Tool JSON copied.')
    } catch {
      notify('error', 'Unable to prepare tool for community sharing.')
    }
  }

  async function handleImport(file: File): Promise<void> {
    try {
      const parsed = await readJsonFile(file)
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
            examples: item.examples
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
    if (viewFilter === 'shared') {
      const workspaceGrantOnly = item.accessGrants.every(
        (grant) => grant.principalType === 'workspace' && grant.principalId === activeSession?.workspaceId
      )
      if (workspaceGrantOnly) return false
    }
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
    return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction
  })
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedItems = sortedItems.slice((safePage - 1) * pageSize, safePage * pageSize)
  return (
    <div className="workspace-resource-page">
      <PageHeader
        actions={
          <>
          {canExport ? <CapsuleButton onClick={() => downloadJsonFile('openport-workspace-tools.json', { items })} type="button" variant="secondary">Export</CapsuleButton> : null}
          {canImport ? <CapsuleButton onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">Import</CapsuleButton> : null}
          {canManage ? <WorkspaceToolAddMenu /> : null}
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
        description="Manage workspace tools."
        label="Workspace"
        title="Tools"
      />
      <section className="workspace-resource-section">
        <div className="workspace-resource-filters">
          <Field label="Search">
            <FieldInput onChange={(event) => setQuery(event.target.value)} placeholder="Name, integration, scope" value={query} />
          </Field>
          <Field label="View">
            <FieldSelect onChange={(event) => setViewFilter(event.target.value as 'all' | 'shared')} value={viewFilter}>
              <option value="all">All</option>
              <option value="shared">Shared</option>
            </FieldSelect>
          </Field>
        </div>
        {!loading ? (
          <WorkspacePagination
            onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            page={safePage}
            total={sortedItems.length}
            totalPages={totalPages}
          />
        ) : null}
        {loading ? <p className="workspace-module-empty">Loading tools…</p> : null}
        {!loading && sortedItems.length === 0 ? (
          <WorkspaceEmptyState title="No tools match this filter." />
        ) : null}
        {!loading ? (
          <div className="workspace-resource-list">
            {pagedItems.map((item) => (
              <ResourceCard
                key={item.id}
                actions={
                  <ResourceCardActions>
                    <WorkspaceToolMenu
                      canExport={canExport}
                      canShare={canShare}
                      canManage={canManage}
                      item={item}
                      onCopyJson={() => void handleCopyJson(item)}
                      onCopyManifest={() => void handleCopyManifest(item)}
                      onDelete={() => void handleDelete(item.id)}
                      onDuplicate={() => void handleDuplicate(item)}
                      onExport={() => handleExportItem(item)}
                      onShare={canShare ? () => void handleShareToCommunity(item) : undefined}
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
