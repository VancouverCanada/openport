'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createWorkspaceModel,
  deleteWorkspaceModel,
  fetchWorkspaceModels,
  loadSession,
  updateWorkspaceModel,
  type OpenPortWorkspaceModel
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
import { WorkspaceModelMenu } from './workspace-model-menu'
import { Tag } from './ui/tag'

export function WorkspaceModels() {
  const [items, setItems] = useState<OpenPortWorkspaceModel[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewFilter, setViewFilter] = useState<'all' | 'shared' | 'runtime' | 'managed'>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'provider'>('updated')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canManage = canManageModule('models')
  const canImport = canModuleAction('models', 'import')
  const canExport = canModuleAction('models', 'export')
  const canShare = canModuleAction('models', 'share')
  const activeSession = loadSession()

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const response = await fetchWorkspaceModels(loadSession())
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

  function buildDuplicateRoute(route: string): string {
    const normalized = route
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9/_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    return `${normalized || 'model'}-copy-${Date.now().toString().slice(-4)}`
  }

  function toTitleLabel(value: string): string {
    return value
      .split(/[\s_-]+/g)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join(' ')
  }

  const filteredItems = items.filter((item) => {
    const source = item.source === 'runtime' ? 'runtime' : 'managed'
    if (viewFilter === 'runtime' && source !== 'runtime') return false
    if (viewFilter === 'managed' && source !== 'managed') return false
    if (viewFilter === 'shared') {
      const workspaceGrantOnly = item.accessGrants.every(
        (grant) => grant.principalType === 'workspace' && grant.principalId === activeSession?.workspaceId
      )
      if (workspaceGrantOnly) return false
    }

    if (query.trim()) {
      const normalizedQuery = query.trim().toLowerCase()
      const haystack = [
        item.name,
        item.route,
        item.provider,
        source,
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
    return true
  })
  const sortedItems = [...filteredItems].sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    if (sortBy === 'name') return left.name.localeCompare(right.name) * direction
    if (sortBy === 'provider') return left.provider.localeCompare(right.provider) * direction
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

  async function handleDuplicate(item: OpenPortWorkspaceModel): Promise<void> {
    setWorkingId(item.id)
    try {
      await createWorkspaceModel(
        {
          name: `${item.name} Copy`,
          route: buildDuplicateRoute(item.route),
          provider: item.provider,
          source: 'managed',
          description: item.description,
          tags: item.tags,
          status: item.status,
          isDefault: false,
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
      notify('success', 'Model duplicated.')
      await load()
    } catch {
      notify('error', 'Unable to duplicate model.')
    } finally {
      setWorkingId(null)
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
            source: item.source === 'runtime' ? 'managed' : item.source,
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

  async function handlePromote(item: OpenPortWorkspaceModel): Promise<void> {
    setWorkingId(item.id)
    try {
      await updateWorkspaceModel(item.id, { source: 'managed' }, loadSession())
      notify('success', 'Model saved as managed preset.')
      await load()
    } catch {
      notify('error', 'Unable to save runtime model as managed preset.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleShareToCommunity(item: OpenPortWorkspaceModel): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(item, null, 2))
      notify('success', 'Model JSON copied.')
    } catch {
      notify('error', 'Unable to prepare model for community sharing.')
    }
  }

  return (
    <div className="workspace-resource-page">
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
        description="Configure available models for your workspace."
        label="Workspace"
        title="Models"
      />

      <section className="workspace-resource-section">
        <div className="workspace-resource-filters">
          <Field label="Search">
            <FieldInput onChange={(event) => setQuery(event.target.value)} placeholder="Route, provider, tag, filter" value={query} />
          </Field>
          <Field label="View">
            <FieldSelect onChange={(event) => setViewFilter(event.target.value as 'all' | 'shared' | 'runtime' | 'managed')} value={viewFilter}>
              <option value="all">All</option>
              <option value="shared">Shared</option>
              <option value="runtime">Runtime models</option>
              <option value="managed">Managed presets</option>
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
        {loading ? <p className="workspace-module-empty">Loading models…</p> : null}
        {!loading && sortedItems.length === 0 ? (
          <WorkspaceEmptyState title="No models match this filter." />
        ) : null}
        {!loading ? (
          <div className="workspace-resource-list">
            {pagedItems.map((item) => {
              const source = item.source === 'runtime' ? 'runtime' : 'managed'
              const isRuntime = source === 'runtime'
              const visibleTags = item.tags.filter((tag) => !(item.isDefault && tag.trim().toLowerCase() === 'default'))
              return (
                <ResourceCard
                  key={item.id}
                  actions={
                    <ResourceCardActions>
                      <WorkspaceModelMenu
                        canExport={canExport}
                        canShare={canShare}
                        canManage={canManage && !isRuntime}
                        canPromote={canManage}
                        item={item}
                        onDelete={isRuntime ? () => undefined : () => void handleDelete(item.id)}
                        onDuplicate={isRuntime ? () => undefined : () => void handleDuplicate(item)}
                        onExport={() => handleExportItem(item)}
                        onPromote={isRuntime ? () => void handlePromote(item) : undefined}
                        onShare={canShare ? () => void handleShareToCommunity(item) : undefined}
                        working={workingId === item.id}
                      />
                    </ResourceCardActions>
                  }
                >
                    <ResourceCardCopy>
                      <ResourceCardHeading>
                        <strong>{item.name}</strong>
                        <Tag className="workspace-model-heading-tag" variant="solid">
                          {source === 'runtime' ? 'Runtime model' : 'Managed preset'}
                        </Tag>
                        <Tag className="workspace-model-heading-tag" variant="solid">{toTitleLabel(item.status)}</Tag>
                        {item.isDefault ? <Tag className="workspace-model-heading-tag" variant="solid">Default</Tag> : null}
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
                      {visibleTags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  </ResourceCardCopy>
                </ResourceCard>
              )
            })}
          </div>
        ) : null}
      </section>
    </div>
  )
}
