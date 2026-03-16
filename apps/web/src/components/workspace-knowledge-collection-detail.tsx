'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  deleteKnowledgeCollection,
  fetchKnowledgeCollections,
  fetchProjectKnowledge,
  fetchProjects,
  loadSession,
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

type WorkspaceKnowledgeCollectionDetailProps = {
  collectionId: string
  initialView?: 'documents' | 'sources' | 'chunks'
}

function formatBytes(size: number): string {
  if (size <= 0) return '0 KB'
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

export function WorkspaceKnowledgeCollectionDetail({
  collectionId,
  initialView = 'documents'
}: WorkspaceKnowledgeCollectionDetailProps) {
  const router = useRouter()
  const [collection, setCollection] = useState<OpenPortKnowledgeCollection | null>(null)
  const [collections, setCollections] = useState<OpenPortKnowledgeCollection[]>([])
  const [items, setItems] = useState<OpenPortProjectKnowledgeItem[]>([])
  const [projects, setProjects] = useState<OpenPortProject[]>([])
  const [loading, setLoading] = useState(true)
  const [collectionView, setCollectionView] = useState<'documents' | 'sources' | 'chunks'>(initialView)
  const [moveTargetId, setMoveTargetId] = useState('collection_general')
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
  const [retrievalFilter, setRetrievalFilter] = useState<'all' | 'indexed' | 'binary'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'upload' | 'text' | 'append'>('all')
  const [accessModalOpen, setAccessModalOpen] = useState(false)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canShare = canModuleAction('knowledge', 'share') || canManageModule('knowledge')

  useEffect(() => {
    let isActive = true

    void Promise.all([
      fetchKnowledgeCollections(loadSession()).catch(() => ({ items: [] })),
      fetchProjectKnowledge(loadSession()).catch(() => ({ items: [] })),
      fetchProjects(loadSession()).catch(() => ({ items: [] }))
    ]).then(([collectionsResponse, knowledgeResponse, projectsResponse]) => {
      if (!isActive) return
      setCollections(collectionsResponse.items)
      setCollection(collectionsResponse.items.find((item) => item.id === collectionId) || null)
      setItems(knowledgeResponse.items.filter((item) => (item.collectionId || 'collection_general') === collectionId))
      setProjects(projectsResponse.items)
      setLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [collectionId])

  useEffect(() => {
    setCollectionView(initialView)
  }, [initialView])

  const attachedProjects = projects.filter((project) =>
    project.data.files.some((file) => file.selected && items.some((item) => item.id === file.knowledgeItemId))
  )
  const indexedCount = items.filter((item) => item.chunkCount > 0).length
  const totalChunks = items.reduce((sum, item) => sum + item.chunkCount, 0)
  const totalSources = items.reduce((sum, item) => sum + (item.sources?.length || 0), 0)
  const sourceLedger = Object.values(
    items
      .flatMap((item) => item.sources || [])
      .reduce<Record<string, { id: string; label: string; kind: string; source: string; size: number; documents: number }>>(
        (result, source) => {
          if (result[source.id]) {
            result[source.id].documents += 1
            return result
          }
          result[source.id] = {
            id: source.id,
            label: source.label,
            kind: source.kind,
            source: source.source,
            size: source.size,
            documents: 1
          }
          return result
        },
        {}
      )
  )
  const chunkCoverage = items
    .flatMap((item) =>
      (item.chunkPreview || []).map((chunk) => ({
        ...chunk,
        itemId: item.id,
        itemName: item.name,
        retrievalState: item.retrievalState,
        source: item.source,
        sourceCount: item.sources?.length || 0
      }))
    )
  const typeSummary = Array.from(new Set(items.map((item) => item.type))).slice(0, 3)
  const filteredItems = items.filter((item) => {
    if (retrievalFilter !== 'all' && item.retrievalState !== retrievalFilter) {
      return false
    }
    if (sourceFilter !== 'all' && item.source !== sourceFilter) {
      return false
    }
    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [item.name, item.previewText, item.contentText, item.type, item.source]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  })
  const filteredSourceLedger = sourceLedger.filter((source) => {
    if (sourceFilter !== 'all' && source.source !== sourceFilter) {
      return false
    }
    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [source.label, source.kind, source.source].join(' ').toLowerCase().includes(normalizedQuery)
  })
  const filteredChunkCoverage = chunkCoverage.filter((chunk) => {
    if (retrievalFilter !== 'all' && chunk.retrievalState !== retrievalFilter) {
      return false
    }
    if (sourceFilter !== 'all' && chunk.source !== sourceFilter) {
      return false
    }
    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [chunk.itemName, chunk.text, chunk.source].join(' ').toLowerCase().includes(normalizedQuery)
  })

  async function handleDeleteCollection(): Promise<void> {
    setDeleting(true)
    try {
      await deleteKnowledgeCollection(collectionId, { moveToCollectionId: moveTargetId }, loadSession())
      notify('success', 'Collection deleted.')
      router.push('/workspace/knowledge')
      router.refresh()
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to delete collection.')
    } finally {
      setDeleting(false)
    }
  }

  function handleExportCollection(): void {
    if (!collection) return
    downloadJsonFile(
      `openport-knowledge-collection-${collection.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || collection.id}.json`,
      {
        collection,
        items
      }
    )
  }

  function handleExportVisibleView(): void {
    if (!collection) return
    if (collectionView === 'documents') {
      downloadJsonFile(
        `openport-knowledge-documents-${collection.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || collection.id}.json`,
        {
          collection,
          items: filteredItems
        }
      )
      return
    }

    if (collectionView === 'sources') {
      downloadJsonFile(
        `openport-knowledge-sources-${collection.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || collection.id}.json`,
        {
          collection,
          sources: filteredSourceLedger
        }
      )
      return
    }

    downloadJsonFile(
      `openport-knowledge-chunks-${collection.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || collection.id}.json`,
      {
        collection,
        chunks: filteredChunkCoverage
      }
    )
  }

  return (
    <div className="workspace-resource-page">
      <WorkspaceKnowledgeAccessModal
        mode="collection"
        onClose={() => setAccessModalOpen(false)}
        open={accessModalOpen}
        resourceId={collectionId}
        resourceLabel="Knowledge collection"
      />
      {loading ? <p className="workspace-module-empty">Loading collection…</p> : null}
      {!loading && !collection ? <p className="workspace-module-empty">Collection not found.</p> : null}
      {collection ? (
        <>
          <PageHeader
            actions={
              <>
              <Tag>{collection.itemCount} items</Tag>
              <Tag>{attachedProjects.length} projects</Tag>
              <Tag>{indexedCount} indexed</Tag>
              {typeSummary.map((type) => (
                <Tag key={type}>{type}</Tag>
              ))}
              <CapsuleButton active={collectionView === 'documents'} href={`/workspace/knowledge/collections/${collection.id}`} variant="secondary">Documents</CapsuleButton>
              <CapsuleButton active={collectionView === 'sources'} href={`/workspace/knowledge/collections/${collection.id}/sources`} variant="secondary">Sources</CapsuleButton>
              <CapsuleButton active={collectionView === 'chunks'} href={`/workspace/knowledge/collections/${collection.id}/chunks`} variant="secondary">Chunks</CapsuleButton>
              <CapsuleButton onClick={handleExportVisibleView} type="button" variant="secondary">Export visible</CapsuleButton>
              <CapsuleButton onClick={handleExportCollection} type="button" variant="secondary">Export</CapsuleButton>
              {canShare ? (
                <CapsuleButton onClick={() => setAccessModalOpen(true)} type="button" variant="secondary">Access</CapsuleButton>
              ) : null}
              <CapsuleButton href={`/workspace/knowledge/collections/${collection.id}/edit`} variant="secondary">Edit</CapsuleButton>
              </>
            }
            description={collection.description || 'Shared retrieval sources grouped under one collection.'}
            label="Workspace"
            title={collection.name}
          />

          <section className="workspace-resource-section">
            <div className="workspace-resource-detail-grid">
              <article className="workspace-resource-detail-card">
                <strong>Documents</strong>
                <p>{items.length}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Indexed</strong>
                <p>{indexedCount}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Chunks</strong>
                <p>{totalChunks}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Source links</strong>
                <p>{totalSources}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Projects</strong>
                <p>{attachedProjects.length}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Types</strong>
                <p>{typeSummary.join(', ') || 'None'}</p>
              </article>
            </div>
            {collectionView === 'sources' && sourceLedger.length > 0 ? (
              <>
                <ResourceCardCopy className="workspace-editor-section-heading">
                  <ResourceCardHeading><strong>Source records</strong></ResourceCardHeading>
                  <span>Shared upstream sources referenced by documents in this collection.</span>
                </ResourceCardCopy>
                <div className="workspace-resource-list">
                  {filteredSourceLedger.length > 0 ? (
                    filteredSourceLedger.map((source) => (
                      <ResourceCard
                        key={source.id}
                        actions={
                          <ResourceCardActions>
                            <TextButton href={`/workspace/knowledge/sources/${source.id}`} variant="link">View source</TextButton>
                          </ResourceCardActions>
                        }
                      >
                        <ResourceCardCopy>
                          <strong>{source.label}</strong>
                          <p>{source.documents} documents · {formatBytes(source.size)}</p>
                          <div className="workspace-module-chip-row">
                            <Tag>{source.kind}</Tag>
                            <Tag>{source.source}</Tag>
                          </div>
                        </ResourceCardCopy>
                      </ResourceCard>
                    ))
                  ) : (
                    <p className="workspace-module-empty">No source records match this filter.</p>
                  )}
                </div>
              </>
            ) : null}
            {collectionView === 'chunks' && chunkCoverage.length > 0 ? (
              <>
                <ResourceCardCopy className="workspace-editor-section-heading">
                  <ResourceCardHeading><strong>Chunk coverage</strong></ResourceCardHeading>
                  <span>Documents in this collection that currently contribute the most indexed chunks.</span>
                </ResourceCardCopy>
                <div className="workspace-resource-list">
                  {filteredChunkCoverage.length > 0 ? (
                    filteredChunkCoverage.map((chunk) => (
                      <ResourceCard
                        key={chunk.id}
                        actions={
                          <ResourceCardActions>
                            <TextButton href={`/workspace/knowledge/chunks/${chunk.id}`} variant="link">Open chunk</TextButton>
                            <TextButton href={`/workspace/knowledge/${chunk.itemId}`} variant="link">Document</TextButton>
                          </ResourceCardActions>
                        }
                      >
                        <ResourceCardCopy>
                          <strong>Chunk {chunk.index + 1}</strong>
                          <p>{chunk.itemName} · {chunk.sourceCount} sources</p>
                          <div className="workspace-module-chip-row">
                            <Tag>{chunk.retrievalState}</Tag>
                            <Tag>{chunk.source}</Tag>
                            <Tag>{chunk.text.length} chars</Tag>
                          </div>
                          <p>{chunk.text}</p>
                        </ResourceCardCopy>
                      </ResourceCard>
                    ))
                  ) : (
                    <p className="workspace-module-empty">No chunk-heavy documents match this filter.</p>
                  )}
                </div>
              </>
            ) : null}
            <div className="workspace-resource-filters">
              <Field label={collectionView === 'documents' ? 'Search documents' : collectionView === 'sources' ? 'Search sources' : 'Search chunks'}>
                <input
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={collectionView === 'documents' ? 'Name, preview, source' : collectionView === 'sources' ? 'Label, kind, source' : 'Name, preview, source'}
                  value={query}
                />
              </Field>
              <Field label="Retrieval">
                <select onChange={(event) => setRetrievalFilter(event.target.value as typeof retrievalFilter)} value={retrievalFilter}>
                  <option value="all">All states</option>
                  <option value="indexed">Indexed</option>
                  <option value="binary">Binary</option>
                </select>
              </Field>
              <Field label="Source">
                <select onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)} value={sourceFilter}>
                  <option value="all">All sources</option>
                  <option value="upload">Upload</option>
                  <option value="text">Text</option>
                  <option value="append">Append</option>
                </select>
              </Field>
            </div>
            {collectionView === 'documents' ? (
            <div className="workspace-resource-list">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <ResourceCard
                    key={item.id}
                    actions={
                      <ResourceCardActions>
                        <TextButton href={`/workspace/knowledge/${item.id}`} variant="link">View item</TextButton>
                        <TextButton href={`/workspace/knowledge/chunks/${item.chunkPreview?.[0]?.id || item.id}`} variant="link">View chunks</TextButton>
                      </ResourceCardActions>
                    }
                  >
                    <ResourceCardCopy>
                      <ResourceCardHeading>
                        <strong>{item.name}</strong>
                        <span className="status-pill">{item.retrievalState}</span>
                      </ResourceCardHeading>
                      <p>
                        {item.type} · {formatBytes(item.size)} · {item.chunkCount > 0 ? `${item.chunkCount} chunks` : 'Not indexed'}
                      </p>
                      <div className="workspace-module-chip-row">
                        <Tag>{item.source}</Tag>
                        <Tag>{item.sources?.length || 0} sources</Tag>
                      </div>
                      <p>{item.previewText || 'No preview text available.'}</p>
                    </ResourceCardCopy>
                  </ResourceCard>
                ))
              ) : (
                <p className="workspace-module-empty">No knowledge items match this search.</p>
              )}
            </div>
            ) : null}
          </section>

          <section className="workspace-resource-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Projects using this collection</strong></ResourceCardHeading>
              <span>Projects with one or more selected knowledge items from this collection.</span>
            </ResourceCardCopy>
            <div className="workspace-resource-list">
              {attachedProjects.length > 0 ? (
                attachedProjects.map((project) => (
                  <ResourceCard key={project.id}>
                    <ResourceCardCopy>
                      <strong>{project.name}</strong>
                      <p>
                        {
                          project.data.files.filter(
                            (file) => file.selected && items.some((item) => item.id === file.knowledgeItemId)
                          ).length
                        }{' '}
                        collection items attached
                      </p>
                    </ResourceCardCopy>
                  </ResourceCard>
                ))
              ) : (
                <p className="workspace-module-empty">No projects are using this collection yet.</p>
              )}
            </div>
          </section>

          {collection.id !== 'collection_general' ? (
            <section className="workspace-resource-section">
              <ResourceCardCopy className="workspace-editor-section-heading">
                <ResourceCardHeading><strong>Delete collection</strong></ResourceCardHeading>
                <span>Move current items into another collection before deleting this one.</span>
              </ResourceCardCopy>
              <ResourceCard stacked>
                <Field label="Move items to">
                  <select onChange={(event) => setMoveTargetId(event.target.value)} value={moveTargetId}>
                    {collections
                      .filter((item) => item.id !== collection.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <div className="workspace-editor-actions">
                  <TextButton
                    className="workspace-resource-link is-danger"
                    disabled={deleting}
                    onClick={() => void handleDeleteCollection()}
                    size="md"
                    type="button"
                    variant="inline"
                  >
                    {deleting ? 'Deleting…' : 'Delete collection'}
                  </TextButton>
                </div>
              </ResourceCard>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
