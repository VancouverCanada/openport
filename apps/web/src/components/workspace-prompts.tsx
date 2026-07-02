'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createWorkspacePrompt,
  deleteWorkspacePrompt,
  fetchWorkspacePrompts,
  loadSession,
  type OpenPortWorkspacePrompt
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
import { WorkspacePromptMenu } from './workspace-prompt-menu'
import { Tag } from './ui/tag'

export function WorkspacePrompts() {
  const [items, setItems] = useState<OpenPortWorkspacePrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewFilter, setViewFilter] = useState<'all' | 'shared'>('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canManage = canManageModule('prompts')
  const canImport = canModuleAction('prompts', 'import')
  const canExport = canModuleAction('prompts', 'export')
  const canShare = canModuleAction('prompts', 'share')
  const activeSession = loadSession()

  function buildDuplicateCommand(command: string): string {
    const normalized = command.trim().startsWith('/') ? command.trim().slice(1) : command.trim()
    return `/${normalized.replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}-copy-${Date.now().toString().slice(-4)}`
  }

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const response = await fetchWorkspacePrompts(loadSession())
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
  }, [query, viewFilter, tagFilter, sortBy, sortDirection, pageSize])

  async function handleDelete(id: string): Promise<void> {
    try {
      await deleteWorkspacePrompt(id, loadSession())
      notify('success', 'Prompt deleted.')
      await load()
    } catch {
      notify('error', 'Unable to delete prompt.')
    }
  }

  async function handleDuplicate(item: OpenPortWorkspacePrompt): Promise<void> {
    setWorkingId(item.id)
    try {
      await createWorkspacePrompt(
        {
          title: `${item.title} Copy`,
          command: buildDuplicateCommand(item.command),
          description: item.description,
          content: item.content,
          tags: item.tags,
          visibility: item.visibility,
          setAsProduction: false
        },
        loadSession()
      )
      notify('success', 'Prompt duplicated.')
      await load()
    } catch {
      notify('error', 'Unable to duplicate prompt.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleCopyContent(item: OpenPortWorkspacePrompt): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.content)
      notify('success', 'Prompt content copied.')
    } catch {
      notify('error', 'Unable to copy prompt content.')
    }
  }

  async function handleCopyCommand(item: OpenPortWorkspacePrompt): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.command)
      notify('success', 'Prompt command copied.')
    } catch {
      notify('error', 'Unable to copy prompt command.')
    }
  }

  function handleExportItem(item: OpenPortWorkspacePrompt): void {
    downloadJsonFile(`openport-prompt-${item.command.replace(/^\//, '') || item.id}.json`, { items: [item] })
  }

  async function handleShareToCommunity(item: OpenPortWorkspacePrompt): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(item, null, 2))
      notify('success', 'Prompt JSON copied.')
    } catch {
      notify('error', 'Unable to prepare prompt for community sharing.')
    }
  }

  async function handleImport(file: File): Promise<void> {
    try {
      const imported = normalizeImportedItems<OpenPortWorkspacePrompt>(await readJsonFile(file))
      for (const item of imported) {
        await createWorkspacePrompt(
          {
            id: item.id,
            title: item.title,
            command: item.command,
            description: item.description,
            content: item.content,
            tags: item.tags,
            visibility: item.visibility,
            setAsProduction: Boolean(item.productionVersionId)
          },
          loadSession()
        )
      }
      notify('success', `Imported ${imported.length} prompts.`)
      await load()
    } catch {
      notify('error', 'Unable to import prompts.')
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
    if (tagFilter !== 'all' && !item.tags.includes(tagFilter)) return false
    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [item.title, item.command, item.description, item.content, ...item.tags].join(' ').toLowerCase().includes(normalizedQuery)
  })
  const sortedItems = [...filteredItems].sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    if (sortBy === 'title') return left.title.localeCompare(right.title) * direction
    return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction
  })
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedItems = sortedItems.slice((safePage - 1) * pageSize, safePage * pageSize)
  const availableTags = Array.from(new Set(items.flatMap((item) => item.tags))).sort((left, right) => left.localeCompare(right))
  return (
    <div className="workspace-resource-page">
      <PageHeader
        actions={
          <>
          {canExport ? <CapsuleButton onClick={() => downloadJsonFile('openport-workspace-prompts.json', { items })} type="button" variant="secondary">Export</CapsuleButton> : null}
          {canImport ? <CapsuleButton onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">Import</CapsuleButton> : null}
          {canManage ? <CapsuleButton href="/workspace/prompts/create" variant="primary">New prompt</CapsuleButton> : null}
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
        description="Create reusable slash-style prompts."
        label="Workspace"
        title="Prompts"
      />

      <section className="workspace-resource-section">
        <div className="workspace-resource-filters">
          <Field label="Search">
            <FieldInput onChange={(event) => setQuery(event.target.value)} placeholder="Title, command, tag" value={query} />
          </Field>
          <Field label="View">
            <FieldSelect onChange={(event) => setViewFilter(event.target.value as 'all' | 'shared')} value={viewFilter}>
              <option value="all">All</option>
              <option value="shared">Shared</option>
            </FieldSelect>
          </Field>
          <Field label="Tag">
            <FieldSelect onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
              <option value="all">All tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
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
        {loading ? <p className="workspace-module-empty">Loading prompts…</p> : null}
        {!loading && sortedItems.length === 0 ? (
          <WorkspaceEmptyState title="No prompts match this filter." />
        ) : null}
        {!loading ? (
          <div className="workspace-resource-list">
            {pagedItems.map((item) => (
              <ResourceCard
                key={item.id}
                actions={
                  <ResourceCardActions>
                    <WorkspacePromptMenu
                      canShare={canShare}
                      canExport={canExport}
                      canManage={canManage}
                      item={item}
                      onCopyCommand={() => void handleCopyCommand(item)}
                      onCopyContent={() => void handleCopyContent(item)}
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
                    <strong>{item.title}</strong>
                    <Tag>{item.command}</Tag>
                    <Tag>{item.visibility}</Tag>
                    {item.productionVersionId ? <span className="status-pill">production set</span> : null}
                    {item.publishedVersionId ? <span className="status-pill">published</span> : null}
                    {item.communityStatus === 'submitted' ? <span className="status-pill">community submitted</span> : null}
                  </ResourceCardHeading>
                  <p>{item.description || 'No description provided.'}</p>
                  {item.tags.length > 0 ? (
                    <div className="workspace-module-chip-row">
                      {item.tags.slice(0, 4).map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  ) : null}
                  <pre className="workspace-module-prompt-preview">{item.content}</pre>
                </ResourceCardCopy>
              </ResourceCard>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
