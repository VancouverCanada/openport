'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  deleteProjectKnowledgeSource,
  fetchKnowledgeCollections,
  fetchProjectKnowledge,
  loadSession,
  maintainProjectKnowledgeSourceBatch,
  rebuildProjectKnowledge,
  resetProjectKnowledge,
  reindexProjectKnowledge,
  type OpenPortKnowledgeChunkingOptions,
  type OpenPortKnowledgeCollection,
  type OpenPortProjectKnowledgeItem
} from '../lib/openport-api'
import { downloadJsonFile } from '../lib/workspace-resource-io'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { CapsuleButton } from './ui/capsule-button'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'
import { WorkspaceKnowledgeAccessModal } from './workspace-knowledge-access-modal'
import { WorkspaceKnowledgeRebuildModal } from './workspace-knowledge-rebuild-modal'
import { WorkspaceKnowledgeSourceBatchReplaceModal } from './workspace-knowledge-source-batch-replace-modal'
import { WorkspaceKnowledgeSourceReplaceModal } from './workspace-knowledge-source-replace-modal'
import { WorkspaceResourceMenu } from './workspace-resource-menu'

type WorkspaceKnowledgeSourceDetailProps = {
  sourceId: string
}

function formatBytes(size: number): string {
  if (size <= 0) return '0 KB'
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

export function WorkspaceKnowledgeSourceDetail({ sourceId }: WorkspaceKnowledgeSourceDetailProps) {
  const [items, setItems] = useState<OpenPortProjectKnowledgeItem[]>([])
  const [collections, setCollections] = useState<OpenPortKnowledgeCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [reindexing, setReindexing] = useState<string | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)
  const [rebuilding, setRebuilding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null)
  const [batchReplaceModalOpen, setBatchReplaceModalOpen] = useState(false)
  const [batchRebuildModalOpen, setBatchRebuildModalOpen] = useState(false)
  const [accessModalOpen, setAccessModalOpen] = useState(false)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canManage = canManageModule('knowledge')
  const canShare = canModuleAction('knowledge', 'share') || canManage

  async function loadData(isActive = true): Promise<void> {
    const [knowledgeResponse, collectionResponse] = await Promise.all([
      fetchProjectKnowledge(loadSession()).catch(() => ({ items: [] })),
      fetchKnowledgeCollections(loadSession()).catch(() => ({ items: [] }))
    ])
    if (!isActive) return
    setItems(knowledgeResponse.items)
    setCollections(collectionResponse.items)
    setLoading(false)
  }

  useEffect(() => {
    let isActive = true
    void loadData(isActive)
    return () => {
      isActive = false
    }
  }, [sourceId])

  const linkedDocuments = items.filter((item) => item.sources?.some((source) => source.id === sourceId))
  const sourceRecord = linkedDocuments.flatMap((item) => item.sources || []).find((source) => source.id === sourceId) || null
  const collectionIds = Array.from(new Set(linkedDocuments.map((item) => item.collectionId || 'collection_general')))
  const linkedCollections = collections.filter((collection) => collectionIds.includes(collection.id))
  const totalChunks = linkedDocuments.reduce((sum, item) => sum + item.chunkCount, 0)
  const indexedCount = linkedDocuments.filter((item) => item.retrievalState === 'indexed').length
  const replacingItem = linkedDocuments.find((item) => item.id === replacingItemId) || null

  function handleExport(): void {
    downloadJsonFile(
      `openport-knowledge-source-${(sourceRecord?.label || sourceId).toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.json`,
      {
        source: sourceRecord,
        documents: linkedDocuments
      }
    )
  }

  async function handleReindex(itemId: string): Promise<void> {
    setReindexing(itemId)
    try {
      const response = await reindexProjectKnowledge(itemId, loadSession())
      setItems((current) => current.map((item) => (item.id === itemId ? response.item : item)))
      notify('success', 'Linked document re-indexed.')
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to re-index document.')
    } finally {
      setReindexing(null)
    }
  }

  async function handleReindexAll(): Promise<void> {
    setReindexing('batch')
    try {
      const response = await maintainProjectKnowledgeSourceBatch(
        sourceId,
        { action: 'reindex' },
        loadSession()
      )
      setItems((current) =>
        current.map((item) => response.items.find((next) => next.id === item.id) || item)
      )
      notify('success', `Re-indexed ${response.affectedCount} linked documents.`)
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to re-index linked documents.')
    } finally {
      setReindexing(null)
    }
  }

  async function handleReset(itemId: string): Promise<void> {
    setResetting(itemId)
    try {
      const response = await resetProjectKnowledge(itemId, loadSession())
      setItems((current) => current.map((item) => (item.id === itemId ? response.item : item)))
      notify('success', 'Linked document index reset.')
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to reset document index.')
    } finally {
      setResetting(null)
    }
  }

  async function handleResetAll(): Promise<void> {
    setResetting('batch')
    try {
      const response = await maintainProjectKnowledgeSourceBatch(
        sourceId,
        { action: 'reset' },
        loadSession()
      )
      setItems((current) =>
        current.map((item) => response.items.find((next) => next.id === item.id) || item)
      )
      notify('success', `Reset index for ${response.affectedCount} linked documents.`)
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to reset linked documents.')
    } finally {
      setResetting(null)
    }
  }

  async function handleRemove(itemId: string): Promise<void> {
    setRemoving(itemId)
    try {
      const response = await deleteProjectKnowledgeSource(itemId, sourceId, loadSession())
      setItems((current) => current.map((item) => (item.id === itemId ? response.item : item)))
      notify('success', 'Source removed from linked document.')
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to remove source.')
    } finally {
      setRemoving(null)
    }
  }

  async function handleRemoveAll(): Promise<void> {
    setRemoving('batch')
    try {
      const response = await maintainProjectKnowledgeSourceBatch(
        sourceId,
        { action: 'remove' },
        loadSession()
      )
      setItems((current) =>
        current.map((item) => response.items.find((next) => next.id === item.id) || item)
      )
      notify('success', `Removed source from ${response.affectedCount} linked documents.`)
      await loadData(true)
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to remove source from linked documents.')
    } finally {
      setRemoving(null)
    }
  }

  async function handleRebuild(itemId: string, options: OpenPortKnowledgeChunkingOptions): Promise<void> {
    setRebuilding(itemId)
    try {
      const response = await rebuildProjectKnowledge(itemId, options, loadSession())
      setItems((current) => current.map((item) => (item.id === itemId ? response.item : item)))
      notify('success', 'Linked document rebuilt.')
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to rebuild linked document.')
    } finally {
      setRebuilding(null)
    }
  }

  async function handleRebuildAll(options: OpenPortKnowledgeChunkingOptions): Promise<void> {
    setRebuilding('batch')
    try {
      const response = await maintainProjectKnowledgeSourceBatch(
        sourceId,
        { action: 'rebuild', ...options },
        loadSession()
      )
      setItems((current) =>
        current.map((item) => response.items.find((next) => next.id === item.id) || item)
      )
      notify('success', `Rebuilt ${response.affectedCount} linked documents.`)
      setBatchRebuildModalOpen(false)
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to rebuild linked documents.')
    } finally {
      setRebuilding(null)
    }
  }

  return (
    <div className="workspace-resource-page">
      {loading ? <p className="workspace-module-empty">Loading source…</p> : null}
      {!loading && !sourceRecord ? <p className="workspace-module-empty">Source not found.</p> : null}
      {!loading && sourceRecord ? (
        <>
          <WorkspaceKnowledgeSourceBatchReplaceModal
            affectedDocumentCount={linkedDocuments.length}
            onClose={() => setBatchReplaceModalOpen(false)}
            onReplaced={() => {
              void loadData(true)
            }}
            open={batchReplaceModalOpen}
            source={sourceRecord}
          />
          <WorkspaceKnowledgeRebuildModal
            description="Rebuild chunking for all linked documents from this source."
            onClose={() => setBatchRebuildModalOpen(false)}
            onSubmit={handleRebuildAll}
            open={batchRebuildModalOpen}
            submitting={rebuilding === 'batch'}
            title="Rebuild linked documents"
          />
          <WorkspaceKnowledgeSourceReplaceModal
            item={replacingItem}
            onClose={() => setReplacingItemId(null)}
            onReplaced={(nextItem) => {
              setItems((current) => current.map((item) => (item.id === nextItem.id ? nextItem : item)))
            }}
            open={Boolean(replacingItem && sourceRecord)}
            source={sourceRecord}
          />
          <WorkspaceKnowledgeAccessModal
            mode="source"
            onClose={() => setAccessModalOpen(false)}
            open={accessModalOpen}
            resourceId={sourceId}
            resourceLabel={sourceRecord.label}
          />
          <PageHeader
            actions={
              <>
                <Tag>{linkedDocuments.length} documents</Tag>
                <Tag>{indexedCount} indexed</Tag>
                <Tag>{totalChunks} chunks</Tag>
                {canManage ? (
                  <CapsuleButton disabled={linkedDocuments.length === 0 || Boolean(rebuilding)} onClick={() => setBatchRebuildModalOpen(true)} type="button" variant="secondary">
                    {rebuilding ? 'Rebuilding…' : 'Rebuild linked'}
                  </CapsuleButton>
                ) : null}
                {canManage ? (
                  <CapsuleButton disabled={linkedDocuments.length === 0 || Boolean(reindexing)} onClick={() => void handleReindexAll()} type="button" variant="secondary">
                    {reindexing ? 'Re-indexing…' : 'Re-index linked'}
                  </CapsuleButton>
                ) : null}
                {canManage ? (
                  <CapsuleButton disabled={linkedDocuments.length === 0 || Boolean(resetting)} onClick={() => void handleResetAll()} type="button" variant="secondary">
                    {resetting ? 'Resetting…' : 'Reset linked'}
                  </CapsuleButton>
                ) : null}
                {canManage ? (
                  <CapsuleButton disabled={linkedDocuments.length === 0 || Boolean(removing)} onClick={() => void handleRemoveAll()} type="button" variant="secondary">
                    {removing ? 'Removing…' : 'Remove linked'}
                  </CapsuleButton>
                ) : null}
                {canManage ? (
                  <CapsuleButton disabled={linkedDocuments.length === 0} onClick={() => setBatchReplaceModalOpen(true)} type="button" variant="secondary">Replace linked</CapsuleButton>
                ) : null}
                {canShare ? <CapsuleButton onClick={() => setAccessModalOpen(true)} type="button" variant="secondary">Access</CapsuleButton> : null}
                <CapsuleButton onClick={handleExport} type="button" variant="secondary">Export</CapsuleButton>
              </>
            }
            description="Trace how one upstream source fans out across multiple knowledge documents and collections."
            label="Workspace"
            title={sourceRecord.label}
          />

          <section className="workspace-resource-section">
            <div className="workspace-resource-detail-grid">
              <article className="workspace-resource-detail-card">
                <strong>Source kind</strong>
                <p>{sourceRecord.kind}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Pipeline source</strong>
                <p>{sourceRecord.source}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Documents</strong>
                <p>{linkedDocuments.length}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Collections</strong>
                <p>{linkedCollections.length}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Chunks</strong>
                <p>{totalChunks}</p>
              </article>
              <article className="workspace-resource-detail-card">
                <strong>Size</strong>
                <p>{formatBytes(sourceRecord.size)}</p>
              </article>
            </div>
          </section>

          <section className="workspace-resource-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Linked collections</strong></ResourceCardHeading>
              <span>Collections currently receiving documents from this source.</span>
            </ResourceCardCopy>
            <div className="workspace-resource-list">
              {linkedCollections.length > 0 ? (
                linkedCollections.map((collection) => (
                  <ResourceCard
                    key={collection.id}
                    actions={
                      <ResourceCardActions>
                        <WorkspaceResourceMenu
                          items={[
                            {
                              href: `/workspace/knowledge/collections/${collection.id}`,
                              icon: 'solar:eye-outline',
                              label: 'Open collection'
                            }
                          ]}
                        />
                      </ResourceCardActions>
                    }
                  >
                    <ResourceCardCopy>
                      <strong>{collection.name}</strong>
                      <p>{collection.description || 'Grouped retrieval sources for shared context.'}</p>
                    </ResourceCardCopy>
                  </ResourceCard>
                ))
              ) : (
                <p className="workspace-module-empty">No collections linked to this source.</p>
              )}
            </div>
          </section>

          <section className="workspace-resource-section">
            <ResourceCardCopy className="workspace-editor-section-heading">
              <ResourceCardHeading><strong>Linked documents</strong></ResourceCardHeading>
              <span>Documents currently retaining this source in their retrievable record set.</span>
            </ResourceCardCopy>
            <div className="workspace-resource-list">
              {linkedDocuments.length > 0 ? (
                linkedDocuments.map((item) => (
                  <ResourceCard
                    key={item.id}
                    actions={
                      <ResourceCardActions>
                        <WorkspaceResourceMenu
                          items={[
                            {
                              href: `/workspace/knowledge/${item.id}`,
                              icon: 'solar:file-text-outline',
                              label: 'Open document'
                            },
                            {
                              href: `/workspace/knowledge/chunks/${item.id}`,
                              icon: 'solar:widget-outline',
                              label: 'Open chunks'
                            },
                            ...(canManage
                              ? [
                                  {
                                    disabled: Boolean(rebuilding),
                                    icon: 'solar:refresh-outline',
                                    label: rebuilding === item.id ? 'Rebuilding…' : 'Rebuild',
                                    onClick: () =>
                                      void handleRebuild(item.id, {
                                        strategy: 'balanced',
                                        chunkSize: 600,
                                        overlap: 120,
                                        maxChunks: 50
                                      })
                                  },
                                  {
                                    icon: 'solar:pen-new-square-outline',
                                    label: 'Replace source',
                                    onClick: () => setReplacingItemId(item.id)
                                  },
                                  {
                                    disabled: Boolean(reindexing),
                                    icon: 'solar:restart-bold',
                                    label: reindexing === item.id ? 'Re-indexing…' : 'Re-index',
                                    onClick: () => void handleReindex(item.id)
                                  },
                                  {
                                    disabled: Boolean(resetting),
                                    icon: 'solar:eraser-linear',
                                    label: resetting === item.id ? 'Resetting…' : 'Reset',
                                    onClick: () => void handleReset(item.id)
                                  },
                                  {
                                    danger: true,
                                    disabled: Boolean(removing),
                                    icon: 'solar:trash-bin-trash-outline',
                                    label: removing === item.id ? 'Removing…' : 'Remove',
                                    onClick: () => void handleRemove(item.id)
                                  }
                                ]
                              : [])
                          ]}
                        />
                      </ResourceCardActions>
                    }
                  >
                    <ResourceCardCopy>
                      <ResourceCardHeading>
                        <strong>{item.name}</strong>
                        <Tag>{item.collectionName}</Tag>
                        <Tag>{item.chunkCount} chunks</Tag>
                      </ResourceCardHeading>
                      <p>{item.previewText || 'No preview text available.'}</p>
                      <div className="workspace-module-chip-row">
                        <Tag>{item.retrievalState}</Tag>
                        <Tag>{item.source}</Tag>
                      </div>
                    </ResourceCardCopy>
                  </ResourceCard>
                ))
              ) : (
                <p className="workspace-module-empty">No documents linked to this source.</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
