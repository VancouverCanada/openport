'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createWorkspaceModel,
  deleteWorkspaceModel,
  fetchProjectKnowledge,
  fetchWorkspaceModels,
  loadSession,
  updateWorkspaceModel,
  type OpenPortProjectKnowledgeItem,
  type OpenPortWorkspaceModel
} from '../lib/openport-api'
import { downloadJsonFile, normalizeImportedItems, readJsonFile } from '../lib/workspace-resource-io'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { WorkspaceResourceAccessModal } from './workspace-resource-access-modal'
import { WorkspaceModelMenu } from './workspace-model-menu'
import { Tag } from './ui/tag'

export function WorkspaceModels() {
  const [items, setItems] = useState<OpenPortWorkspaceModel[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [defaultFilter, setDefaultFilter] = useState('all')
  const [capabilityFilter, setCapabilityFilter] = useState('all')
  const [collectionFilter, setCollectionFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'provider' | 'knowledge' | 'tools'>('updated')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [accessModelId, setAccessModelId] = useState<string | null>(null)
  const [knowledgeItems, setKnowledgeItems] = useState<OpenPortProjectKnowledgeItem[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canManage = canManageModule('models')
  const canImport = canModuleAction('models', 'import')
  const canExport = canModuleAction('models', 'export')
  const canShare = canModuleAction('models', 'share')

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const [response, knowledgeResponse] = await Promise.all([
        fetchWorkspaceModels(loadSession()),
        fetchProjectKnowledge(loadSession()).catch(() => ({ items: [] }))
      ])
      setItems(response.items)
      setKnowledgeItems(knowledgeResponse.items)
    } catch {
      setItems([])
      setKnowledgeItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [
    query,
    providerFilter,
    statusFilter,
    defaultFilter,
    capabilityFilter,
    collectionFilter,
    sortBy,
    sortDirection,
    pageSize
  ])

  const providers = Array.from(new Set(items.map((item) => item.provider))).sort()
  const collections = Array.from(
    new Set(
      knowledgeItems
        .map((item) => item.collectionName?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort()
  const knowledgeById = new Map(knowledgeItems.map((item) => [item.id, item] as const))
  const filteredItems = items.filter((item) => {
    if (query.trim()) {
      const normalizedQuery = query.trim().toLowerCase()
      const haystack = [
        item.name,
        item.route,
        item.provider,
        item.description,
        ...item.tags,
        ...item.filterIds,
        ...item.defaultFilterIds,
        ...item.actionIds,
        ...item.defaultFeatureIds,
        ...item.promptSuggestions.map((entry) => entry.title)
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(normalizedQuery)) return false
    }
    if (providerFilter !== 'all' && item.provider !== providerFilter) return false
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (defaultFilter === 'default' && !item.isDefault) return false
    if (defaultFilter === 'non-default' && item.isDefault) return false
    if (capabilityFilter !== 'all' && !item.capabilities[capabilityFilter as keyof typeof item.capabilities]) return false
    if (collectionFilter !== 'all') {
      const matchesCollection = item.knowledgeItemIds.some((knowledgeItemId) => {
        const knowledgeItem = knowledgeById.get(knowledgeItemId)
        return knowledgeItem?.collectionName === collectionFilter
      })
      if (!matchesCollection) return false
    }
    return true
  })
  const sortedItems = [...filteredItems].sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    if (sortBy === 'name') return left.name.localeCompare(right.name) * direction
    if (sortBy === 'provider') return left.provider.localeCompare(right.provider) * direction
    if (sortBy === 'knowledge') return (left.knowledgeItemIds.length - right.knowledgeItemIds.length) * direction
    if (sortBy === 'tools') return ((left.toolIds.length + left.builtinToolIds.length) - (right.toolIds.length + right.builtinToolIds.length)) * direction
    return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction
  })
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedItems = sortedItems.slice((safePage - 1) * pageSize, safePage * pageSize)

  async function handleDelete(id: string): Promise<void> {
    try {
      await deleteWorkspaceModel(id, loadSession())
      notify('success', 'Model deleted.')
      await load()
    } catch {
      notify('error', 'Unable to delete model.')
    }
  }

  async function handleMakeDefault(id: string): Promise<void> {
    try {
      await updateWorkspaceModel(id, { isDefault: true }, loadSession())
      notify('success', 'Default model updated.')
      await load()
    } catch {
      notify('error', 'Unable to update default model.')
    }
  }

  async function handleImport(file: File): Promise<void> {
    try {
      const imported = normalizeImportedItems<OpenPortWorkspaceModel>(await readJsonFile(file))
      for (const item of imported) {
        await createWorkspaceModel(
          {
            id: item.id,
            name: item.name,
            route: item.route,
            provider: item.provider,
            description: item.description,
            tags: item.tags,
            status: item.status,
            isDefault: item.isDefault,
            filterIds: item.filterIds,
            defaultFilterIds: item.defaultFilterIds,
            actionIds: item.actionIds,
            defaultFeatureIds: item.defaultFeatureIds,
            capabilities: item.capabilities,
            knowledgeItemIds: item.knowledgeItemIds,
            toolIds: item.toolIds,
            builtinToolIds: item.builtinToolIds,
            skillIds: item.skillIds ?? [],
            promptSuggestions: item.promptSuggestions
          },
          loadSession()
        )
      }
      notify('success', `Imported ${imported.length} models.`)
      await load()
    } catch {
      notify('error', 'Unable to import models.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleExportItem(item: OpenPortWorkspaceModel): void {
    downloadJsonFile(`openport-model-${item.route.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || item.id}.json`, { items: [item] })
  }

  return (
    <div className="workspace-resource-page">
      <WorkspaceResourceAccessModal
        module="models"
        onClose={() => setAccessModelId(null)}
        open={Boolean(accessModelId)}
        resourceId={accessModelId || ''}
        resourceLabel="Model"
      />
      <PageHeader
        actions={
          <>
          {canExport ? <CapsuleButton onClick={() => downloadJsonFile('openport-workspace-models.json', { items })} type="button" variant="secondary">Export</CapsuleButton> : null}
          {canImport ? <CapsuleButton onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">Import</CapsuleButton> : null}
          {canManage ? <CapsuleButton href="/workspace/models/create" variant="primary">New model</CapsuleButton> : null}
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
        description="Manage model routes, default availability, and workspace-level attachments."
        label="Workspace"
        title="Models"
      />

      <section className="workspace-resource-section">
        <div className="workspace-resource-filters">
          <Field label="Search">
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Route, provider, tag, filter" value={query} />
          </Field>
          <Field label="Provider">
            <select onChange={(event) => setProviderFilter(event.target.value)} value={providerFilter}>
              <option value="all">All providers</option>
              {providers.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </Field>
          <Field label="Default strategy">
            <select onChange={(event) => setDefaultFilter(event.target.value)} value={defaultFilter}>
              <option value="all">All models</option>
              <option value="default">Default only</option>
              <option value="non-default">Non-default only</option>
            </select>
          </Field>
          <Field label="Capability">
            <select onChange={(event) => setCapabilityFilter(event.target.value)} value={capabilityFilter}>
              <option value="all">All capabilities</option>
              <option value="vision">Vision</option>
              <option value="webSearch">Web search</option>
              <option value="imageGeneration">Image generation</option>
              <option value="codeInterpreter">Code interpreter</option>
            </select>
          </Field>
          <Field label="Knowledge collection">
            <select onChange={(event) => setCollectionFilter(event.target.value)} value={collectionFilter}>
              <option value="all">All collections</option>
              {collections.map((collection) => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort by">
            <select onChange={(event) => setSortBy(event.target.value as typeof sortBy)} value={sortBy}>
              <option value="updated">Updated</option>
              <option value="name">Name</option>
              <option value="provider">Provider</option>
              <option value="knowledge">Knowledge links</option>
              <option value="tools">Tool links</option>
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
        {loading ? <p className="workspace-module-empty">Loading models…</p> : null}
        {!loading && sortedItems.length === 0 ? <p className="workspace-module-empty">No models match this filter.</p> : null}
        {!loading ? (
          <div className="workspace-resource-list">
            {pagedItems.map((item) => (
              <ResourceCard
                key={item.id}
                actions={
                  <ResourceCardActions>
                    <WorkspaceModelMenu
                      canExport={canExport}
                      canShare={canShare}
                      canManage={canManage}
                      item={item}
                      onAccess={canShare ? () => setAccessModelId(item.id) : undefined}
                      onDelete={() => void handleDelete(item.id)}
                      onExport={() => handleExportItem(item)}
                      onMakeDefault={() => void handleMakeDefault(item.id)}
                    />
                  </ResourceCardActions>
                }
              >
                <ResourceCardCopy>
                  <ResourceCardHeading>
                    <strong>{item.name}</strong>
                    <span className={`status-pill${item.status === 'disabled' ? ' is-disabled' : ''}`}>{item.status}</span>
                    {item.isDefault ? <span className="status-pill">default</span> : null}
                  </ResourceCardHeading>
                  <p>{item.description || item.route}</p>
                  <div className="workspace-module-chip-row">
                    <Tag>{item.route}</Tag>
                    <Tag>{item.provider}</Tag>
                    {item.knowledgeItemIds.length > 0 ? <Tag>{item.knowledgeItemIds.length} knowledge</Tag> : null}
                    {item.toolIds.length > 0 ? <Tag>{item.toolIds.length} tools</Tag> : null}
                    {item.builtinToolIds.length > 0 ? <Tag>{item.builtinToolIds.length} builtin tools</Tag> : null}
                    {item.skillIds.length > 0 ? <Tag>{item.skillIds.length} skills</Tag> : null}
                    {item.actionIds.length > 0 ? <Tag>{item.actionIds.length} actions</Tag> : null}
                    {item.defaultFilterIds.length > 0 ? <Tag>{item.defaultFilterIds.length} default filters</Tag> : null}
                    {item.defaultFeatureIds.length > 0 ? <Tag>{item.defaultFeatureIds.length} default features</Tag> : null}
                    {item.promptSuggestions.length > 0 ? <Tag>{item.promptSuggestions.length} suggestions</Tag> : null}
                    {item.filterIds.map((filterId) => (
                      <Tag key={filterId}>{filterId}</Tag>
                    ))}
                    {Object.entries(item.capabilities)
                      .filter(([, enabled]) => enabled)
                      .map(([capability]) => (
                        <Tag key={capability}>{capability}</Tag>
                      ))}
                    {item.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </ResourceCardCopy>
              </ResourceCard>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
