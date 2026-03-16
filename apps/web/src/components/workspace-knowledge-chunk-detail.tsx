'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  fetchKnowledgeCollections,
  fetchProjectKnowledge,
  loadSession,
  rebuildProjectKnowledge,
  searchProjectKnowledgeChunks,
  type OpenPortKnowledgeChunkingOptions,
  type OpenPortKnowledgeCollection,
  type OpenPortProjectKnowledgeChunkMatch,
  type OpenPortProjectKnowledgeItem
} from '../lib/openport-api'
import { downloadJsonFile } from '../lib/workspace-resource-io'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { CapsuleButton } from './ui/capsule-button'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'
import { TextButton } from './ui/text-button'
import { WorkspaceKnowledgeAccessModal } from './workspace-knowledge-access-modal'
import { WorkspaceKnowledgeRebuildModal } from './workspace-knowledge-rebuild-modal'
import { WorkspaceKnowledgeDetail } from './workspace-knowledge-detail'

type WorkspaceKnowledgeChunkDetailProps = {
  chunkId: string
}

export function WorkspaceKnowledgeChunkDetail({ chunkId }: WorkspaceKnowledgeChunkDetailProps) {
  const [items, setItems] = useState<OpenPortProjectKnowledgeItem[]>([])
  const [collections, setCollections] = useState<OpenPortKnowledgeCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [probeQuery, setProbeQuery] = useState('')
  const [probeLoading, setProbeLoading] = useState(false)
  const [probeMatches, setProbeMatches] = useState<OpenPortProjectKnowledgeChunkMatch[]>([])
  const [probeSummary, setProbeSummary] = useState<{ totalMatches: number; maxScore: number; averageScore: number } | null>(null)
  const [rebuildModalOpen, setRebuildModalOpen] = useState(false)
  const [accessModalOpen, setAccessModalOpen] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canManage = canManageModule('knowledge')
  const canShare = canModuleAction('knowledge', 'share') || canManage

  useEffect(() => {
    let isActive = true

    void Promise.all([
      fetchProjectKnowledge(loadSession()).catch(() => ({ items: [] })),
      fetchKnowledgeCollections(loadSession()).catch(() => ({ items: [] }))
    ]).then(([knowledgeResponse, collectionResponse]) => {
      if (!isActive) return
      setItems(knowledgeResponse.items)
      setCollections(collectionResponse.items)
      setLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [chunkId])

  const resolved = useMemo(() => {
    for (const item of items) {
      const chunk = item.chunkPreview?.find((entry) => entry.id === chunkId)
      if (chunk) {
        const collection =
          collections.find((entry) => entry.id === (item.collectionId || 'collection_general')) || null
        return { item, chunk, collection }
      }
    }
    return null
  }, [chunkId, collections, items])

  const fallbackItem = useMemo(() => items.find((item) => item.id === chunkId) || null, [chunkId, items])

  async function handleCopy(): Promise<void> {
    if (!resolved) return
    try {
      await navigator.clipboard.writeText(resolved.chunk.text)
      notify('success', 'Chunk copied.')
    } catch {
      notify('error', 'Unable to copy chunk.')
    }
  }

  function handleExport(): void {
    if (!resolved) return
    downloadJsonFile(`openport-knowledge-chunk-${resolved.chunk.id}.json`, {
      chunk: resolved.chunk,
      item: resolved.item,
      collection: resolved.collection
    })
  }

  async function handleRunProbe(): Promise<void> {
    if (!resolved || !probeQuery.trim()) return
    setProbeLoading(true)
    try {
      const response = await searchProjectKnowledgeChunks(resolved.item.id, probeQuery, 12, loadSession())
      setProbeMatches(response.items)
      setProbeSummary(response.summary || null)
      notify('success', `Probe matched ${response.items.length} chunk(s).`)
    } catch {
      notify('error', 'Unable to run chunk probe.')
    } finally {
      setProbeLoading(false)
    }
  }

  async function handleRebuildDocument(options: OpenPortKnowledgeChunkingOptions): Promise<void> {
    if (!resolved) return
    setRebuilding(true)
    try {
      const response = await rebuildProjectKnowledge(resolved.item.id, options, loadSession())
      setItems((current) => current.map((item) => (item.id === response.item.id ? response.item : item)))
      notify('success', 'Document chunking rebuilt.')
      setRebuildModalOpen(false)
    } catch {
      notify('error', 'Unable to rebuild document chunking.')
    } finally {
      setRebuilding(false)
    }
  }

  if (loading) {
    return <p className="workspace-module-empty">Loading chunk…</p>
  }

  if (!resolved && fallbackItem) {
    return <WorkspaceKnowledgeDetail initialView="chunks" itemId={fallbackItem.id} />
  }

  if (!resolved) {
    return <p className="workspace-module-empty">Chunk not found.</p>
  }

  const siblingChunks = (resolved.item.chunkPreview || []).filter((entry) => entry.id !== resolved.chunk.id)
  const linkedSources = resolved.item.sources || []
  const words = resolved.chunk.text
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
  const sentences = resolved.chunk.text
    .split(/[.!?]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
  const uniqueWordRatio = words.length > 0 ? new Set(words.map((entry) => entry.toLowerCase())).size / words.length : 0
  const averageWordLength = words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0
  const qualityFlags = [
    resolved.chunk.text.length < 180 ? 'Thin chunk' : null,
    resolved.chunk.text.length > 900 ? 'Oversized chunk' : null,
    sentences.length <= 1 ? 'Low sentence structure' : null,
    uniqueWordRatio < 0.38 ? 'Low lexical diversity' : null,
    linkedSources.length === 0 ? 'No linked sources' : null
  ].filter((flag): flag is string => Boolean(flag))
  const retrievalFit =
    qualityFlags.length === 0
      ? 'Healthy'
      : qualityFlags.length <= 2
        ? 'Needs review'
        : 'High risk'

  return (
    <div className="workspace-resource-page">
      {canManage ? (
        <WorkspaceKnowledgeRebuildModal
          description="Rebuild chunk strategy for the current document."
          onClose={() => setRebuildModalOpen(false)}
          onSubmit={handleRebuildDocument}
          open={rebuildModalOpen}
          submitting={rebuilding}
          title="Rebuild document chunking"
        />
      ) : null}
      <WorkspaceKnowledgeAccessModal
        mode="chunk"
        onClose={() => setAccessModalOpen(false)}
        open={accessModalOpen}
        resourceId={chunkId}
        resourceLabel={`Chunk ${resolved.chunk.index + 1}`}
      />
      <PageHeader
        actions={
          <>
            <Tag>{resolved.item.name}</Tag>
            <Tag>{resolved.collection?.name || resolved.item.collectionName}</Tag>
            <Tag>{resolved.chunk.text.length} chars</Tag>
            {canManage ? <CapsuleButton onClick={() => setRebuildModalOpen(true)} type="button" variant="secondary">Rebuild document</CapsuleButton> : null}
            {canShare ? <CapsuleButton onClick={() => setAccessModalOpen(true)} type="button" variant="secondary">Access</CapsuleButton> : null}
            <CapsuleButton onClick={() => void handleCopy()} type="button" variant="secondary">Copy chunk</CapsuleButton>
            <CapsuleButton onClick={handleExport} type="button" variant="secondary">Export</CapsuleButton>
          </>
        }
        description="Inspect one retrievable chunk with its owning document, collection, and linked sources."
        label="Workspace"
        title={`Chunk ${resolved.chunk.index + 1}`}
      />

      <section className="workspace-resource-section">
        <div className="workspace-resource-detail-grid">
          <article className="workspace-resource-detail-card">
            <strong>Document</strong>
            <p>{resolved.item.name}</p>
            <TextButton href={`/workspace/knowledge/${resolved.item.id}`} variant="link">Open document</TextButton>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Collection</strong>
            <p>{resolved.collection?.name || resolved.item.collectionName}</p>
            {resolved.item.collectionId ? (
              <TextButton href={`/workspace/knowledge/collections/${resolved.item.collectionId}`} variant="link">Open collection</TextButton>
            ) : null}
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Chunk index</strong>
            <p>{resolved.chunk.index + 1}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Retrieval state</strong>
            <p>{resolved.item.retrievalState}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Source kind</strong>
            <p>{resolved.item.source}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Linked sources</strong>
            <p>{linkedSources.length}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Words</strong>
            <p>{words.length}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Sentences</strong>
            <p>{sentences.length}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Retrieval fit</strong>
            <p>{retrievalFit}</p>
          </article>
        </div>
      </section>

      <section className="workspace-resource-section">
        <ResourceCard stacked>
          <ResourceCardCopy className="workspace-editor-section-heading">
            <ResourceCardHeading><strong>Chunk quality analysis</strong></ResourceCardHeading>
            <span>Heuristic inspection for retrieval quality, similar to the kind of chunk review you end up doing in Open WebUI knowledge ops.</span>
          </ResourceCardCopy>
          <div className="workspace-resource-detail-grid">
            <article className="workspace-resource-detail-card">
              <strong>Lexical diversity</strong>
              <p>{uniqueWordRatio.toFixed(2)}</p>
            </article>
            <article className="workspace-resource-detail-card">
              <strong>Avg. word length</strong>
              <p>{averageWordLength.toFixed(1)}</p>
            </article>
            <article className="workspace-resource-detail-card">
              <strong>Flags</strong>
              <p>{qualityFlags.length}</p>
            </article>
          </div>
          <div className="workspace-module-chip-row">
            {qualityFlags.length > 0 ? qualityFlags.map((flag) => <Tag key={flag}>{flag}</Tag>) : <Tag>Healthy</Tag>}
          </div>
        </ResourceCard>
      </section>

      <section className="workspace-resource-section">
        <ResourceCard stacked>
          <ResourceCardCopy className="workspace-editor-section-heading">
            <ResourceCardHeading><strong>Retrieval probe</strong></ResourceCardHeading>
            <span>Run a query against sibling chunks to inspect likely retrieval hits and ranking order.</span>
          </ResourceCardCopy>
          <div className="workspace-resource-filters">
            <input
              onChange={(event) => setProbeQuery(event.target.value)}
              placeholder="Probe query"
              value={probeQuery}
            />
            <CapsuleButton disabled={probeLoading || !probeQuery.trim()} onClick={() => void handleRunProbe()} type="button" variant="secondary">
              {probeLoading ? 'Running…' : 'Run probe'}
            </CapsuleButton>
          </div>
          {probeMatches.length > 0 ? (
            <div className="workspace-resource-list">
              <div className="workspace-module-chip-row">
                <Tag>{probeSummary?.totalMatches ?? probeMatches.length} matches</Tag>
                <Tag>max {probeSummary?.maxScore ?? 0}</Tag>
                <Tag>avg {probeSummary?.averageScore ?? 0}</Tag>
              </div>
              {probeMatches.map((match) => (
                <ResourceCard
                  key={match.chunkId}
                  actions={
                    <ResourceCardActions>
                      <Tag>score {match.score.toFixed(3)}</Tag>
                      <TextButton href={`/workspace/knowledge/chunks/${match.chunkId}`} variant="link">Open chunk</TextButton>
                    </ResourceCardActions>
                  }
                >
                  <ResourceCardCopy>
                    <ResourceCardHeading>
                      <strong>Chunk {match.chunkIndex}</strong>
                      {match.chunkId === resolved.chunk.id ? <Tag>Current</Tag> : null}
                    </ResourceCardHeading>
                    <p>{match.snippet}</p>
                  </ResourceCardCopy>
                </ResourceCard>
              ))}
            </div>
          ) : (
            <p className="workspace-module-empty">Run a probe query to inspect retrieval hit ranking.</p>
          )}
        </ResourceCard>
      </section>

      <section className="workspace-resource-section">
        <ResourceCard stacked>
          <ResourceCardCopy className="workspace-editor-section-heading">
            <ResourceCardHeading><strong>Chunk text</strong></ResourceCardHeading>
            <span>This is the indexed text slice that will actually participate in retrieval.</span>
          </ResourceCardCopy>
          <pre className="workspace-module-prompt-preview workspace-module-prompt-preview--large">{resolved.chunk.text}</pre>
        </ResourceCard>
      </section>

      <section className="workspace-resource-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Linked sources</strong></ResourceCardHeading>
          <span>Upstream sources currently contributing to the parent document.</span>
        </ResourceCardCopy>
        <div className="workspace-resource-list">
          {linkedSources.length > 0 ? (
            linkedSources.map((source) => (
              <ResourceCard
                key={source.id}
                actions={
                  <ResourceCardActions>
                    <TextButton href={`/workspace/knowledge/sources/${source.id}`} variant="link">Open source</TextButton>
                  </ResourceCardActions>
                }
              >
                <ResourceCardCopy>
                  <strong>{source.label}</strong>
                  <p>{source.kind} · {source.source}</p>
                </ResourceCardCopy>
              </ResourceCard>
            ))
          ) : (
            <p className="workspace-module-empty">No sources linked to this chunk.</p>
          )}
        </div>
      </section>

      <section className="workspace-resource-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Sibling chunks</strong></ResourceCardHeading>
          <span>Other retrievable slices generated from the same document.</span>
        </ResourceCardCopy>
        <div className="workspace-resource-list">
          {siblingChunks.length > 0 ? (
            siblingChunks.map((chunk) => (
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
                </ResourceCardCopy>
              </ResourceCard>
            ))
          ) : (
            <p className="workspace-module-empty">No sibling chunks in this document.</p>
          )}
        </div>
      </section>
    </div>
  )
}
