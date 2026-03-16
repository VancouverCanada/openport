'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  appendProjectKnowledgeContent,
  fetchKnowledgeCollections,
  fetchProjectKnowledgeItem,
  fetchProjects,
  loadSession,
  resetProjectKnowledge,
  reindexProjectKnowledge,
  updateProjectKnowledgeContent,
  updateProjectKnowledgeCollection,
  updateProject,
  type OpenPortKnowledgeCollection,
  type OpenPortProject,
  type OpenPortProjectKnowledgeItem
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { downloadJsonFile } from '../lib/workspace-resource-io'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'
import { TextButton } from './ui/text-button'
import { WorkspaceKnowledgeAccessModal } from './workspace-knowledge-access-modal'
import { WorkspaceKnowledgeSourceReplaceModal } from './workspace-knowledge-source-replace-modal'

type WorkspaceKnowledgeDetailProps = {
  itemId: string
  initialView?: 'document' | 'sources' | 'chunks'
}

export function WorkspaceKnowledgeDetail({
  itemId,
  initialView = 'document'
}: WorkspaceKnowledgeDetailProps) {
  const [item, setItem] = useState<OpenPortProjectKnowledgeItem | null>(null)
  const [collections, setCollections] = useState<OpenPortKnowledgeCollection[]>([])
  const [projects, setProjects] = useState<OpenPortProject[]>([])
  const [loading, setLoading] = useState(true)
  const [detailView, setDetailView] = useState<'document' | 'sources' | 'chunks'>(initialView)
  const [appendText, setAppendText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [contentQuery, setContentQuery] = useState('')
  const [sourceKindFilter, setSourceKindFilter] = useState<'all' | 'asset' | 'text'>('all')
  const [saving, setSaving] = useState(false)
  const [bindingProjectId, setBindingProjectId] = useState<string | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState('collection_general')
  const [reindexing, setReindexing] = useState(false)
  const [replacingSourceId, setReplacingSourceId] = useState<string | null>(null)
  const [accessModalOpen, setAccessModalOpen] = useState(false)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canShare = canModuleAction('knowledge', 'share') || canManageModule('knowledge')

  useEffect(() => {
    let isActive = true

    void Promise.all([
      fetchProjectKnowledgeItem(itemId, loadSession()).catch(() => null),
      fetchKnowledgeCollections(loadSession()).catch(() => ({ items: [] })),
      fetchProjects(loadSession()).catch(() => ({ items: [] }))
    ]).then(([itemResponse, collectionResponse, projectResponse]) => {
      if (!isActive) return
      setItem(itemResponse?.item || null)
      setReplaceText(itemResponse?.item?.contentText || itemResponse?.item?.previewText || '')
      setCollections(collectionResponse.items)
      setSelectedCollectionId(itemResponse?.item?.collectionId || 'collection_general')
      setProjects(projectResponse.items)
      setLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [itemId])

  useEffect(() => {
    setDetailView(initialView)
  }, [initialView])

  const attachedProjects = item
    ? projects.filter((project) => project.data.files.some((file) => file.knowledgeItemId === item.id && file.selected))
    : []
  const normalizedContentQuery = contentQuery.trim().toLowerCase()
  const contentLines = (item?.contentText || item?.previewText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const contentMatches = normalizedContentQuery
    ? contentLines
        .filter((line) => line.toLowerCase().includes(normalizedContentQuery))
        .slice(0, 8)
    : []
  const contentStats = item
    ? {
        characters: (item.contentText || item.previewText || '').length,
        words: (item.contentText || item.previewText || '')
          .split(/\s+/)
          .map((entry) => entry.trim())
          .filter(Boolean).length,
        lines: contentLines.length,
        matches: contentMatches.length
      }
    : null
  const filteredChunkPreview = item?.chunkPreview
    ? item.chunkPreview.filter((chunk) =>
        normalizedContentQuery ? chunk.text.toLowerCase().includes(normalizedContentQuery) : true
      )
    : []
  const filteredSources = item?.sources
    ? item.sources.filter((source) => (sourceKindFilter === 'all' ? true : source.kind === sourceKindFilter))
    : []
  const replacingSource = filteredSources.find((source) => source.id === replacingSourceId)
    || item?.sources?.find((source) => source.id === replacingSourceId)
    || null

  async function handleAppend(): Promise<void> {
    if (!item || !appendText.trim()) return
    setSaving(true)
    try {
      const response = await appendProjectKnowledgeContent(item.id, appendText, loadSession())
      setItem(response.item)
      setReplaceText(response.item.contentText || response.item.previewText || '')
      setAppendText('')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyContent(): Promise<void> {
    if (!item) return
    try {
      await navigator.clipboard.writeText(item.contentText || item.previewText || '')
      notify('success', 'Knowledge content copied.')
    } catch {
      notify('error', 'Unable to copy knowledge content.')
    }
  }

  function handleExportItem(): void {
    if (!item) return
    downloadJsonFile(`openport-knowledge-${item.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || item.id}.json`, {
      item
    })
  }

  function handleDownloadText(): void {
    if (!item) return
    const blob = new Blob([item.contentText || item.previewText || ''], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${item.name.replace(/[^a-z0-9-]+/gi, '_') || item.id}.txt`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  function handleExportVisibleView(): void {
    if (!item) return
    if (detailView === 'document') {
      downloadJsonFile(
        `openport-knowledge-document-${item.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || item.id}.json`,
        {
          item,
          contentStats,
          contentMatches: normalizedContentQuery ? contentMatches : undefined
        }
      )
      return
    }

    if (detailView === 'sources') {
      downloadJsonFile(
        `openport-knowledge-sources-${item.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || item.id}.json`,
        {
          itemId: item.id,
          itemName: item.name,
          sources: filteredSources
        }
      )
      return
    }

    downloadJsonFile(
      `openport-knowledge-chunks-${item.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || item.id}.json`,
      {
        itemId: item.id,
        itemName: item.name,
        chunks: filteredChunkPreview
      }
    )
  }

  async function handleMoveCollection(): Promise<void> {
    if (!item) return
    setSaving(true)
    try {
      const response = await updateProjectKnowledgeCollection(
        item.id,
        { collectionId: selectedCollectionId },
        loadSession()
      )
      setItem(response.item)
      setSelectedCollectionId(response.item.collectionId || 'collection_general')
      notify('success', 'Knowledge moved to collection.')
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to move knowledge item.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReindex(): Promise<void> {
    if (!item) return
    setReindexing(true)
    try {
      const response = await reindexProjectKnowledge(item.id, loadSession())
      setItem(response.item)
      setReplaceText(response.item.contentText || response.item.previewText || '')
      notify('success', 'Knowledge re-indexed.')
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to re-index knowledge item.')
    } finally {
      setReindexing(false)
    }
  }

  async function handleResetIndex(): Promise<void> {
    if (!item) return
    setReindexing(true)
    try {
      const response = await resetProjectKnowledge(item.id, loadSession())
      setItem(response.item)
      setReplaceText(response.item.contentText || response.item.previewText || '')
      notify('success', 'Knowledge index reset.')
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to reset knowledge index.')
    } finally {
      setReindexing(false)
    }
  }

  async function handleReplaceContent(): Promise<void> {
    if (!item || !replaceText.trim()) return
    setSaving(true)
    try {
      const response = await updateProjectKnowledgeContent(item.id, replaceText, loadSession())
      setItem(response.item)
      setReplaceText(response.item.contentText || response.item.previewText || '')
      notify('success', 'Knowledge content replaced.')
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to replace knowledge content.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleProject(project: OpenPortProject, selected: boolean): Promise<void> {
    if (!item) return
    setBindingProjectId(project.id)
    try {
      const existingFile = project.data.files.find((file) => file.knowledgeItemId === item.id)
      const nextFiles = existingFile
        ? project.data.files.map((file) =>
            file.knowledgeItemId === item.id ? { ...file, selected } : file
          )
        : [
            ...project.data.files,
            {
              id: `knowledge_${item.id}`,
              name: item.name,
              type: item.type,
              size: item.size,
              addedAt: Date.now(),
              selected,
              knowledgeItemId: item.id,
              assetId: item.assetId
            }
          ]

      await updateProject(
        project.id,
        {
          data: {
            systemPrompt: project.data.systemPrompt,
            files: nextFiles
          }
        },
        loadSession()
      )
      const projectsResponse = await fetchProjects(loadSession()).catch(() => ({ items: [] }))
      setProjects(projectsResponse.items)
      notify('success', selected ? 'Knowledge attached to project.' : 'Knowledge detached from project.')
    } catch {
      notify('error', 'Unable to update project binding.')
    } finally {
      setBindingProjectId(null)
    }
  }

  return (
    <div className="workspace-resource-page">
      {loading ? <p className="workspace-module-empty">Loading knowledge item…</p> : null}
      {!loading && !item ? <p className="workspace-module-empty">Knowledge item not found.</p> : null}
      {item ? (
        <>
          <WorkspaceKnowledgeAccessModal
            mode="item"
            onClose={() => setAccessModalOpen(false)}
            open={accessModalOpen}
            resourceId={item.id}
            resourceLabel="Knowledge document"
          />
          <WorkspaceKnowledgeSourceReplaceModal
            item={item}
            onClose={() => setReplacingSourceId(null)}
            onReplaced={(nextItem) => {
              setItem(nextItem)
              setReplaceText(nextItem.contentText || nextItem.previewText || '')
            }}
            open={Boolean(replacingSource)}
            source={replacingSource}
          />
          <PageHeader
            actions={
              <>
              <Tag>{item.type}</Tag>
              <Tag>{item.retrievalState}</Tag>
              <Tag>{item.chunkCount} chunks</Tag>
              <Tag>{item.sources?.length || 0} sources</Tag>
              <CapsuleButton active={detailView === 'document'} onClick={() => setDetailView('document')} type="button" variant="secondary">Document</CapsuleButton>
              <CapsuleButton active={detailView === 'sources'} onClick={() => setDetailView('sources')} type="button" variant="secondary">Sources</CapsuleButton>
              <CapsuleButton active={detailView === 'chunks'} onClick={() => setDetailView('chunks')} type="button" variant="secondary">Chunks</CapsuleButton>
              <CapsuleButton onClick={handleExportVisibleView} type="button" variant="secondary">Export visible</CapsuleButton>
              <CapsuleButton onClick={handleExportItem} type="button" variant="secondary">Export</CapsuleButton>
              {canShare ? (
                <CapsuleButton onClick={() => setAccessModalOpen(true)} type="button" variant="secondary">Access</CapsuleButton>
              ) : null}
              <CapsuleButton disabled={reindexing} onClick={() => void handleReindex()} type="button" variant="secondary">{reindexing ? 'Re-indexing…' : 'Re-index'}</CapsuleButton>
              <CapsuleButton disabled={reindexing} onClick={() => void handleResetIndex()} type="button" variant="secondary">{reindexing ? 'Resetting…' : 'Reset index'}</CapsuleButton>
              <CapsuleButton onClick={handleDownloadText} type="button" variant="secondary">Download text</CapsuleButton>
              <CapsuleButton onClick={() => void handleCopyContent()} type="button" variant="secondary">Copy content</CapsuleButton>
              </>
            }
            description={item.previewText || 'No preview text available for this knowledge item.'}
            label="Workspace"
            title={item.name}
          />

          <section className="workspace-resource-section">
            <div className="workspace-resource-detail-grid">
              <article className="workspace-resource-detail-card">
                <strong>Source</strong>
                <p>{item.source}</p>
                {item.contentUrl ? (
                  <TextButton href={item.contentUrl} target="_blank" variant="link">Open asset</TextButton>
                ) : null}
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Uploaded</strong>
                <p>{new Date(item.uploadedAt).toLocaleString()}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Collection</strong>
                <p>{item.collectionName}</p>
                {item.collectionId ? (
                  <TextButton href={`/workspace/knowledge/collections/${item.collectionId}`} variant="link">View collection</TextButton>
                ) : null}
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Attached projects</strong>
                <p>{attachedProjects.length}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Document stats</strong>
                <p>
                  {contentStats?.words || 0} words · {contentStats?.lines || 0} lines
                </p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Sources</strong>
                <p>{item.sources?.length || 0} linked source{(item.sources?.length || 0) === 1 ? '' : 's'}</p>
              </article>
            </div>
            <ResourceCard stacked>
              <Field label="Move to collection">
                <select onChange={(event) => setSelectedCollectionId(event.target.value)} value={selectedCollectionId}>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="workspace-editor-actions">
                <CapsuleButton
                  disabled={saving || selectedCollectionId === (item.collectionId || 'collection_general')}
                  onClick={() => void handleMoveCollection()}
                  type="button"
                  variant="secondary"
                >
                  Move item
                </CapsuleButton>
              </div>
            </ResourceCard>
          </section>

          {detailView === 'sources' && item.sources && item.sources.length > 0 ? (
            <section className="workspace-resource-section">
              <ResourceCardCopy className="workspace-editor-section-heading">
                <ResourceCardHeading><strong>Source records</strong></ResourceCardHeading>
                <span>Trace the upstream assets and runtime sources currently attached to this document.</span>
              </ResourceCardCopy>
              <div className="workspace-resource-filters">
                <Field label="Source kind">
                  <select
                    onChange={(event) => setSourceKindFilter(event.target.value as typeof sourceKindFilter)}
                    value={sourceKindFilter}
                  >
                    <option value="all">All kinds</option>
                    <option value="asset">Assets</option>
                    <option value="text">Text</option>
                  </select>
                </Field>
              </div>
              <div className="workspace-resource-list">
                {filteredSources.length > 0 ? (
                  filteredSources.map((source) => (
                    <ResourceCard
                      key={source.id}
                      actions={
                        <ResourceCardActions>
                          <TextButton href={`/workspace/knowledge/sources/${source.id}`} variant="link">Open source</TextButton>
                          <TextButton onClick={() => setReplacingSourceId(source.id)} type="button" variant="inline">Replace</TextButton>
                        </ResourceCardActions>
                      }
                    >
                      <ResourceCardCopy>
                        <strong>{source.label}</strong>
                        <p>{source.kind === 'asset' ? 'Uploaded asset retained as a retrievable source.' : 'Inline text source retained for retrieval.'}</p>
                        <div className="workspace-module-chip-row">
                          <Tag>{source.kind}</Tag>
                          <Tag>{source.source}</Tag>
                          <Tag>{source.size} bytes</Tag>
                        </div>
                      </ResourceCardCopy>
                    </ResourceCard>
                  ))
                ) : (
                  <p className="workspace-module-empty">No source records match this filter.</p>
                )}
              </div>
            </section>
          ) : null}

          {detailView === 'chunks' && filteredChunkPreview.length > 0 ? (
            <section className="workspace-resource-section">
              <ResourceCardCopy className="workspace-editor-section-heading">
                <ResourceCardHeading><strong>Chunk preview</strong></ResourceCardHeading>
                <span>Inspect the indexed slices that will actually flow into retrieval, similar to Open WebUI knowledge chunks.</span>
              </ResourceCardCopy>
              <div className="workspace-resource-list">
                {filteredChunkPreview.slice(0, 8).length > 0 ? (
                  filteredChunkPreview.slice(0, 8).map((chunk) => (
                    <ResourceCard
                      key={chunk.id}
                      actions={
                        <ResourceCardActions>
                          <TextButton href={`/workspace/knowledge/chunks/${chunk.id}`} variant="link">Open chunk</TextButton>
                        </ResourceCardActions>
                      }
                    >
                      <ResourceCardCopy>
                        <strong>Chunk {chunk.index + 1}</strong>
                        <p>{chunk.text}</p>
                        <div className="workspace-module-chip-row">
                          <Tag>{chunk.text.length} chars</Tag>
                        </div>
                      </ResourceCardCopy>
                    </ResourceCard>
                  ))
                ) : (
                  <p className="workspace-module-empty">No chunks match this search.</p>
                )}
              </div>
            </section>
          ) : null}

          {detailView === 'document' ? (
          <section className="workspace-resource-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Content</strong></ResourceCardHeading>
              <span>Search and extend indexed document content without re-uploading the item.</span>
            </ResourceCardCopy>
            <ResourceCard stacked>
              <div className="workspace-resource-filters">
                <Field label="Search this document">
                  <input
                    onChange={(event) => setContentQuery(event.target.value)}
                    placeholder="Find matching phrases inside this item"
                    value={contentQuery}
                  />
                </Field>
              </div>
              {normalizedContentQuery ? (
                <div className="workspace-resource-list">
                  {contentMatches.length > 0 ? (
                    contentMatches.map((line, index) => (
                      <ResourceCard key={`${index}-${line.slice(0, 16)}`}>
                        <ResourceCardCopy>
                          <strong>Match {index + 1}</strong>
                          <p>{line}</p>
                        </ResourceCardCopy>
                      </ResourceCard>
                    ))
                  ) : (
                    <p className="workspace-module-empty">No matches found in this document.</p>
                  )}
                </div>
              ) : null}
              <div className="workspace-module-chip-row">
                <Tag>{contentStats?.characters || 0} chars</Tag>
                <Tag>{contentStats?.words || 0} words</Tag>
                <Tag>{contentStats?.lines || 0} lines</Tag>
                {normalizedContentQuery ? <Tag>{contentStats?.matches || 0} matches</Tag> : null}
              </div>
              <pre className="workspace-module-prompt-preview workspace-module-prompt-preview--large">
                {item.contentText || item.previewText || 'No text content available.'}
              </pre>
              <Field as="div" label="Replace content">
                <textarea onChange={(event) => setReplaceText(event.target.value)} rows={10} value={replaceText} />
              </Field>
              <div className="workspace-editor-actions">
                <CapsuleButton disabled={saving || !replaceText.trim()} onClick={() => void handleReplaceContent()} type="button" variant="secondary">{saving ? 'Saving…' : 'Replace content'}</CapsuleButton>
              </div>
              <Field as="div" label="Append text">
                <textarea onChange={(event) => setAppendText(event.target.value)} rows={8} value={appendText} />
              </Field>
              <div className="workspace-editor-actions">
                <CapsuleButton disabled={saving || !appendText.trim()} onClick={() => void handleAppend()} type="button" variant="primary">{saving ? 'Updating…' : 'Append content'}</CapsuleButton>
              </div>
            </ResourceCard>
          </section>
          ) : null}

          <section className="workspace-resource-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Projects using this knowledge</strong></ResourceCardHeading>
              <span>Attach or detach this knowledge item from project context.</span>
            </ResourceCardCopy>
            <div className="workspace-resource-list">
              {projects.length > 0 ? (
                projects.map((project) => {
                  const attached = project.data.files.some((file) => file.knowledgeItemId === item.id && file.selected)
                  return (
                  <ResourceCard
                    key={project.id}
                    actions={
                      <ResourceCardActions>
                        <label className="workspace-editor-check">
                          <input
                            checked={attached}
                            disabled={bindingProjectId === project.id}
                            onChange={(event) => void handleToggleProject(project, event.target.checked)}
                            type="checkbox"
                          />
                          <span>{attached ? 'Attached' : 'Attach'}</span>
                        </label>
                      </ResourceCardActions>
                    }
                  >
                    <ResourceCardCopy>
                      <strong>{project.name}</strong>
                      <p>{project.chatIds.length} chats linked</p>
                    </ResourceCardCopy>
                  </ResourceCard>
                  )
                })
              ) : (
                <p className="workspace-module-empty">No projects are using this knowledge item yet.</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
