'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createWorkspaceSkill,
  deleteWorkspaceSkill,
  fetchWorkspaceSkills,
  loadSession,
  type OpenPortWorkspaceSkill
} from '../lib/openport-api'
import { downloadJsonFile, normalizeImportedItems, readJsonFile } from '../lib/workspace-resource-io'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { WorkspaceResourceAccessModal } from './workspace-resource-access-modal'
import { WorkspaceSkillMenu } from './workspace-skill-menu'
import { Tag } from './ui/tag'

export function WorkspaceSkills() {
  const [items, setItems] = useState<OpenPortWorkspaceSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'models' | 'tools'>('updated')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [accessSkillId, setAccessSkillId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canManage = canManageModule('skills')
  const canImport = canModuleAction('skills', 'import')
  const canExport = canModuleAction('skills', 'export')
  const canShare = canModuleAction('skills', 'share')

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const response = await fetchWorkspaceSkills(loadSession())
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
  }, [query, enabledFilter, sortBy, sortDirection, pageSize])

  const filteredItems = items.filter((item) => {
    if (enabledFilter === 'enabled' && !item.enabled) return false
    if (enabledFilter === 'disabled' && item.enabled) return false
    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [
      item.name,
      item.description,
      item.content,
      ...item.tags,
      ...item.linkedModelIds,
      ...item.linkedToolIds
    ].join(' ').toLowerCase().includes(normalizedQuery)
  })
  const sortedItems = [...filteredItems].sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    if (sortBy === 'name') return left.name.localeCompare(right.name) * direction
    if (sortBy === 'models') return (left.linkedModelIds.length - right.linkedModelIds.length) * direction
    if (sortBy === 'tools') return (left.linkedToolIds.length - right.linkedToolIds.length) * direction
    return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction
  })
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedItems = sortedItems.slice((safePage - 1) * pageSize, safePage * pageSize)

  async function handleDelete(id: string): Promise<void> {
    try {
      await deleteWorkspaceSkill(id, loadSession())
      notify('success', 'Skill deleted.')
      await load()
    } catch {
      notify('error', 'Unable to delete skill.')
    }
  }

  async function handleDuplicate(item: OpenPortWorkspaceSkill): Promise<void> {
    try {
      await createWorkspaceSkill(
          {
            name: `${item.name} Copy`,
            description: item.description,
            content: item.content,
            tags: item.tags,
            enabled: item.enabled,
            linkedModelIds: item.linkedModelIds,
            linkedToolIds: item.linkedToolIds
          },
          loadSession()
        )
      notify('success', 'Skill duplicated.')
      await load()
    } catch {
      notify('error', 'Unable to duplicate skill.')
    }
  }

  function handleExportItem(item: OpenPortWorkspaceSkill): void {
    downloadJsonFile(`openport-skill-${item.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || item.id}.json`, { items: [item] })
  }

  async function handleImport(file: File): Promise<void> {
    try {
      const imported = normalizeImportedItems<OpenPortWorkspaceSkill>(await readJsonFile(file))
      for (const item of imported) {
        await createWorkspaceSkill(
          {
            id: item.id,
            name: item.name,
            description: item.description,
            content: item.content,
            tags: item.tags,
            enabled: item.enabled,
            linkedModelIds: item.linkedModelIds,
            linkedToolIds: item.linkedToolIds
          },
          loadSession()
        )
      }
      notify('success', `Imported ${imported.length} skills.`)
      await load()
    } catch {
      notify('error', 'Unable to import skills.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="workspace-resource-page">
      <WorkspaceResourceAccessModal
        module="skills"
        onClose={() => setAccessSkillId(null)}
        open={Boolean(accessSkillId)}
        resourceId={accessSkillId || ''}
        resourceLabel="Skill"
      />
      <PageHeader
        actions={
          <>
          {canExport ? <CapsuleButton onClick={() => downloadJsonFile('openport-workspace-skills.json', { items })} type="button" variant="secondary">Export</CapsuleButton> : null}
          {canImport ? <CapsuleButton onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">Import</CapsuleButton> : null}
          {canManage ? <CapsuleButton href="/workspace/skills/create" variant="primary">New skill</CapsuleButton> : null}
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
        description="Package reusable skill instructions and capability modules for operators, tools, and model workflows."
        label="Workspace"
        title="Skills"
      />

      <section className="workspace-resource-section">
        <div className="workspace-resource-filters">
          <Field label="Search">
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Name, description, tag" value={query} />
          </Field>
          <Field label="State">
            <select onChange={(event) => setEnabledFilter(event.target.value as typeof enabledFilter)} value={enabledFilter}>
              <option value="all">All</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </Field>
          <Field label="Sort by">
            <select onChange={(event) => setSortBy(event.target.value as typeof sortBy)} value={sortBy}>
              <option value="updated">Updated</option>
              <option value="name">Name</option>
              <option value="models">Linked models</option>
              <option value="tools">Linked tools</option>
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
        {loading ? <p className="workspace-module-empty">Loading skills…</p> : null}
        {!loading && sortedItems.length === 0 ? <p className="workspace-module-empty">No skills match this filter.</p> : null}
        {!loading ? (
          <div className="workspace-resource-list">
            {pagedItems.map((item) => (
              <ResourceCard
                key={item.id}
                actions={
                  <ResourceCardActions>
                    <WorkspaceSkillMenu
                      canExport={canExport}
                      canShare={canShare}
                      canManage={canManage}
                      item={item}
                      onAccess={canShare ? () => setAccessSkillId(item.id) : undefined}
                      onDelete={() => void handleDelete(item.id)}
                      onDuplicate={() => void handleDuplicate(item)}
                      onExport={() => handleExportItem(item)}
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
                  <pre className="workspace-module-prompt-preview">{item.content}</pre>
                  <div className="workspace-module-chip-row">
                    {item.linkedModelIds.length > 0 ? <Tag>{item.linkedModelIds.length} models</Tag> : null}
                    {item.linkedToolIds.length > 0 ? <Tag>{item.linkedToolIds.length} tools</Tag> : null}
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
