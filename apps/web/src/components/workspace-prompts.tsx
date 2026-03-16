'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  createWorkspacePrompt,
  deleteWorkspacePrompt,
  fetchWorkspacePrompts,
  loadSession,
  publishWorkspacePrompt,
  retractWorkspacePromptCommunity,
  submitWorkspacePromptCommunity,
  unpublishWorkspacePrompt,
  type OpenPortWorkspacePrompt
} from '../lib/openport-api'
import { downloadJsonFile, normalizeImportedItems, readJsonFile } from '../lib/workspace-resource-io'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { WorkspacePromptMenu } from './workspace-prompt-menu'
import { WorkspaceResourceAccessModal } from './workspace-resource-access-modal'
import { Tag } from './ui/tag'

export function WorkspacePrompts() {
  const [items, setItems] = useState<OpenPortWorkspacePrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'workspace'>('all')
  const [publicationFilter, setPublicationFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [communityFilter, setCommunityFilter] = useState<'all' | 'submitted' | 'not_submitted'>('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'published' | 'community'>('updated')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [accessPromptId, setAccessPromptId] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canManage = canManageModule('prompts')
  const canImport = canModuleAction('prompts', 'import')
  const canExport = canModuleAction('prompts', 'export')
  const canPublish = canModuleAction('prompts', 'publish')
  const canShare = canModuleAction('prompts', 'share')

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
  }, [query, visibilityFilter, publicationFilter, communityFilter, tagFilter, sortBy, sortDirection, pageSize])

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

  async function handlePublish(item: OpenPortWorkspacePrompt): Promise<void> {
    setWorkingId(item.id)
    try {
      await publishWorkspacePrompt(item.id, {}, loadSession())
      notify('success', 'Prompt published.')
      await load()
    } catch {
      notify('error', 'Unable to publish prompt.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleUnpublish(item: OpenPortWorkspacePrompt): Promise<void> {
    setWorkingId(item.id)
    try {
      await unpublishWorkspacePrompt(item.id, loadSession())
      notify('success', 'Prompt unpublished.')
      await load()
    } catch {
      notify('error', 'Unable to unpublish prompt.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleSubmitCommunity(item: OpenPortWorkspacePrompt): Promise<void> {
    setWorkingId(item.id)
    try {
      await submitWorkspacePromptCommunity(item.id, {}, loadSession())
      notify('success', 'Prompt submitted to community flow.')
      await load()
    } catch {
      notify('error', 'Unable to submit prompt to community flow.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleRetractCommunity(item: OpenPortWorkspacePrompt): Promise<void> {
    setWorkingId(item.id)
    try {
      await retractWorkspacePromptCommunity(item.id, loadSession())
      notify('success', 'Prompt removed from community flow.')
      await load()
    } catch {
      notify('error', 'Unable to retract prompt from community flow.')
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
      window.open('https://openwebui.com/prompts/create', '_blank', 'noopener,noreferrer')
      notify('success', 'Prompt JSON copied. Community page opened in a new tab.')
    } catch {
      notify('error', 'Unable to prepare prompt for community sharing.')
    }
  }

  async function handleCopyVisibleJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(filteredItems, null, 2))
      notify('success', 'Visible prompts copied as JSON.')
    } catch {
      notify('error', 'Unable to copy visible prompts.')
    }
  }

  async function handleShareVisible(): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(filteredItems, null, 2))
      window.open('https://openwebui.com/prompts/create', '_blank', 'noopener,noreferrer')
      notify('success', 'Visible prompts copied. Community page opened in a new tab.')
    } catch {
      notify('error', 'Unable to prepare visible prompts for sharing.')
    }
  }

  function handleDownloadCommunityBundle(): void {
    downloadJsonFile(
      'openport-prompt-community-bundle.json',
      {
        items: filteredItems.map((item) => ({
          title: item.title,
          command: item.command,
          description: item.description,
          content: item.content,
          tags: item.tags,
          visibility: item.visibility
        }))
      }
    )
  }

  async function handleCopyVisibleCommands(): Promise<void> {
    try {
      await navigator.clipboard.writeText(filteredItems.map((item) => item.command).join('\n'))
      notify('success', 'Visible prompt commands copied.')
    } catch {
      notify('error', 'Unable to copy visible prompt commands.')
    }
  }

  async function handleCopyCommunityPayload(item: OpenPortWorkspacePrompt): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            title: item.title,
            command: item.command,
            description: item.description,
            content: item.content,
            tags: item.tags,
            visibility: item.visibility
          },
          null,
          2
        )
      )
      notify('success', 'Community payload copied.')
    } catch {
      notify('error', 'Unable to copy community payload.')
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

  async function handleImportFromClipboard(): Promise<void> {
    try {
      const raw = await navigator.clipboard.readText()
      const imported = normalizeImportedItems<OpenPortWorkspacePrompt>(JSON.parse(raw))
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
      notify('success', `Imported ${imported.length} prompts from clipboard.`)
      await load()
    } catch {
      notify('error', 'Unable to import prompts from clipboard.')
    }
  }

  const filteredItems = items.filter((item) => {
    if (visibilityFilter !== 'all' && item.visibility !== visibilityFilter) return false
    if (publicationFilter === 'published' && !item.publishedVersionId) return false
    if (publicationFilter === 'draft' && item.publishedVersionId) return false
    if (communityFilter === 'submitted' && item.communityStatus !== 'submitted') return false
    if (communityFilter === 'not_submitted' && item.communityStatus === 'submitted') return false
    if (tagFilter !== 'all' && !item.tags.includes(tagFilter)) return false
    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [item.title, item.command, item.description, item.content, ...item.tags].join(' ').toLowerCase().includes(normalizedQuery)
  })
  const sortedItems = [...filteredItems].sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    if (sortBy === 'title') return left.title.localeCompare(right.title) * direction
    if (sortBy === 'published') return (Number(Boolean(left.publishedVersionId)) - Number(Boolean(right.publishedVersionId))) * direction
    if (sortBy === 'community') return (Number(left.communityStatus === 'submitted') - Number(right.communityStatus === 'submitted')) * direction
    return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction
  })
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedItems = sortedItems.slice((safePage - 1) * pageSize, safePage * pageSize)
  const availableTags = Array.from(new Set(items.flatMap((item) => item.tags))).sort((left, right) => left.localeCompare(right))
  const summary = {
    total: items.length,
    workspace: items.filter((item) => item.visibility === 'workspace').length,
    private: items.filter((item) => item.visibility === 'private').length,
    production: items.filter((item) => item.productionVersionId).length,
    published: items.filter((item) => item.publishedVersionId).length,
    communitySubmitted: items.filter((item) => item.communityStatus === 'submitted').length
  }

  return (
    <div className="workspace-resource-page">
      <WorkspaceResourceAccessModal
        module="prompts"
        onClose={() => setAccessPromptId(null)}
        open={Boolean(accessPromptId)}
        resourceId={accessPromptId || ''}
        resourceLabel="Prompt"
      />
      <PageHeader
        actions={
          <>
          {canExport ? <CapsuleButton onClick={() => downloadJsonFile('openport-workspace-prompts.json', { items })} type="button" variant="secondary">Export</CapsuleButton> : null}
          {canExport ? <CapsuleButton onClick={() => void handleCopyVisibleJson()} type="button" variant="secondary">Copy visible JSON</CapsuleButton> : null}
          {canExport ? <CapsuleButton onClick={() => void handleCopyVisibleCommands()} type="button" variant="secondary">Copy visible commands</CapsuleButton> : null}
          {canExport ? <CapsuleButton onClick={handleDownloadCommunityBundle} type="button" variant="secondary">Community bundle</CapsuleButton> : null}
          {canShare ? <CapsuleButton onClick={() => void handleShareVisible()} type="button" variant="secondary">Share visible</CapsuleButton> : null}
          {canImport ? <CapsuleButton onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">Import</CapsuleButton> : null}
          {canImport ? <CapsuleButton onClick={() => void handleImportFromClipboard()} type="button" variant="secondary">Paste import</CapsuleButton> : null}
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
        description="Create reusable slash-style prompts and system snippets for operators and chat flows."
        label="Workspace"
        title="Prompts"
      />

      <section className="workspace-resource-section">
        <div className="workspace-resource-detail-grid">
          <article className="workspace-resource-detail-card">
            <strong>Total</strong>
            <p>{summary.total}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Workspace</strong>
            <p>{summary.workspace}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Private</strong>
            <p>{summary.private}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Production</strong>
            <p>{summary.production}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Published</strong>
            <p>{summary.published}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Community submitted</strong>
            <p>{summary.communitySubmitted}</p>
          </article>
        </div>
        <div className="workspace-resource-filters">
          <Field label="Search">
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Title, command, tag" value={query} />
          </Field>
          <Field label="Visibility">
            <select onChange={(event) => setVisibilityFilter(event.target.value as typeof visibilityFilter)} value={visibilityFilter}>
              <option value="all">All prompts</option>
              <option value="workspace">Workspace</option>
              <option value="private">Private</option>
            </select>
          </Field>
          <Field label="Tag">
            <select onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
              <option value="all">All tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Publication">
            <select onChange={(event) => setPublicationFilter(event.target.value as typeof publicationFilter)} value={publicationFilter}>
              <option value="all">All prompts</option>
              <option value="published">Published</option>
              <option value="draft">Draft only</option>
            </select>
          </Field>
          <Field label="Community">
            <select onChange={(event) => setCommunityFilter(event.target.value as typeof communityFilter)} value={communityFilter}>
              <option value="all">All prompts</option>
              <option value="submitted">Submitted</option>
              <option value="not_submitted">Not submitted</option>
            </select>
          </Field>
          <Field label="Sort by">
            <select onChange={(event) => setSortBy(event.target.value as typeof sortBy)} value={sortBy}>
              <option value="updated">Updated</option>
              <option value="title">Title</option>
              <option value="published">Published</option>
              <option value="community">Community</option>
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
        {loading ? <p className="workspace-module-empty">Loading prompts…</p> : null}
        {!loading && sortedItems.length === 0 ? <p className="workspace-module-empty">No prompts match this filter.</p> : null}
        {!loading ? (
          <div className="workspace-resource-list">
            {pagedItems.map((item) => (
              <ResourceCard
                key={item.id}
                actions={
                  <ResourceCardActions>
                    <WorkspacePromptMenu
                      canAccess={canShare}
                      canExport={canExport}
                      canPublish={canPublish}
                      canManage={canManage}
                      item={item}
                      onAccess={canShare ? () => setAccessPromptId(item.id) : undefined}
                      onCopyCommand={() => void handleCopyCommand(item)}
                      onCopyContent={() => void handleCopyContent(item)}
                      onCopyPayload={() => void handleCopyCommunityPayload(item)}
                      onDelete={() => void handleDelete(item.id)}
                      onDuplicate={() => void handleDuplicate(item)}
                      onExport={() => handleExportItem(item)}
                      onPublish={() => void handlePublish(item)}
                      onRetractCommunity={() => void handleRetractCommunity(item)}
                      onShare={canPublish ? () => void handleShareToCommunity(item) : undefined}
                      onSubmitCommunity={() => void handleSubmitCommunity(item)}
                      onUnpublish={() => void handleUnpublish(item)}
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
