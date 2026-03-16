'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  createProjectKnowledgeText,
  createProjectKnowledgeWeb,
  deleteProjectKnowledge,
  fetchKnowledgeCollections,
  fetchProjectKnowledgeChunkStats,
  fetchProjectKnowledge,
  fetchProjects,
  loadSession,
  maintainProjectKnowledgeBatch,
  maintainProjectKnowledgeSourceBatch,
  rebuildProjectKnowledgeBatch,
  uploadProjectKnowledge,
  type OpenPortKnowledgeChunkingOptions,
  type OpenPortProjectKnowledgeChunkStatsResponse,
  type OpenPortKnowledgeCollection,
  type OpenPortProject,
  type OpenPortProjectKnowledgeItem
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import { useWorkspaceAuthority } from '../lib/use-workspace-authority'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { PageHeader } from './ui/page-header'
import { ResourceCard, ResourceCardActions, ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { WorkspaceKnowledgeRebuildModal } from './workspace-knowledge-rebuild-modal'
import { WorkspaceKnowledgeAddContentMenu } from './workspace-knowledge-add-content-menu'
import { WorkspaceKnowledgeAccessModal } from './workspace-knowledge-access-modal'
import { WorkspaceKnowledgeSourceLifecycleModal } from './workspace-knowledge-source-lifecycle-modal'
import { WorkspaceResourceMenu } from './workspace-resource-menu'
import { Tag } from './ui/tag'
import { ModalShell } from './ui/modal-shell'

type WorkspaceKnowledgeProps = {
  initialView?: 'documents' | 'collections' | 'sources' | 'chunks'
}

function formatBytes(size: number): string {
  if (size <= 0) return '0 KB'
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

type KnowledgeSortDirection = 'asc' | 'desc'
type KnowledgeDocumentSort = 'uploaded' | 'name' | 'chunks' | 'size'
type KnowledgeSourceSort = 'label' | 'documents' | 'size' | 'kind'
type KnowledgeChunkSort = 'item' | 'length' | 'index'

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Unable to read file'))
        return
      }
      const [, contentBase64 = ''] = result.split(',', 2)
      resolve(contentBase64)
    }
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}

export function WorkspaceKnowledge({ initialView = 'documents' }: WorkspaceKnowledgeProps) {
  const [items, setItems] = useState<OpenPortProjectKnowledgeItem[]>([])
  const [collections, setCollections] = useState<OpenPortKnowledgeCollection[]>([])
  const [projects, setProjects] = useState<OpenPortProject[]>([])
  const [loading, setLoading] = useState(true)
  const [knowledgeView, setKnowledgeView] = useState<'documents' | 'collections' | 'sources' | 'chunks'>(initialView)
  const [collectionFilter, setCollectionFilter] = useState('all')
  const [retrievalFilter, setRetrievalFilter] = useState<'all' | 'indexed' | 'binary'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'upload' | 'text' | 'append'>('all')
  const [query, setQuery] = useState('')
  const [sortDirection, setSortDirection] = useState<KnowledgeSortDirection>('desc')
  const [documentSortBy, setDocumentSortBy] = useState<KnowledgeDocumentSort>('uploaded')
  const [sourceSortBy, setSourceSortBy] = useState<KnowledgeSourceSort>('documents')
  const [chunkSortBy, setChunkSortBy] = useState<KnowledgeChunkSort>('item')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [chunkStats, setChunkStats] = useState<OpenPortProjectKnowledgeChunkStatsResponse | null>(null)
  const [accessKnowledgeItemId, setAccessKnowledgeItemId] = useState<string | null>(null)
  const [batchRebuildModalOpen, setBatchRebuildModalOpen] = useState(false)
  const [batchRebuilding, setBatchRebuilding] = useState(false)
  const [batchMaintaining, setBatchMaintaining] = useState(false)
  const [sourceWorkingId, setSourceWorkingId] = useState<string | null>(null)
  const [lifecycleSourceId, setLifecycleSourceId] = useState<string | null>(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([])
  const [moveCollectionModalOpen, setMoveCollectionModalOpen] = useState(false)
  const [moveCollectionId, setMoveCollectionId] = useState('collection_general')
  const [moveCollectionName, setMoveCollectionName] = useState('')
  const [quickUploadBusy, setQuickUploadBusy] = useState(false)
  const [quickDirectoryBusy, setQuickDirectoryBusy] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [dropBusy, setDropBusy] = useState(false)
  const [quickTextModalOpen, setQuickTextModalOpen] = useState(false)
  const [quickTextSaving, setQuickTextSaving] = useState(false)
  const [quickTextName, setQuickTextName] = useState('')
  const [quickTextContent, setQuickTextContent] = useState('')
  const [quickTextCollectionId, setQuickTextCollectionId] = useState('collection_general')
  const [quickTextCollectionName, setQuickTextCollectionName] = useState('')
  const [quickWebModalOpen, setQuickWebModalOpen] = useState(false)
  const [quickWebSaving, setQuickWebSaving] = useState(false)
  const [quickWebUrl, setQuickWebUrl] = useState('')
  const [quickWebName, setQuickWebName] = useState('')
  const [quickWebCollectionId, setQuickWebCollectionId] = useState('collection_general')
  const [quickWebCollectionName, setQuickWebCollectionName] = useState('')
  const [directoryModalOpen, setDirectoryModalOpen] = useState(false)
  const [directoryMode, setDirectoryMode] = useState<'upload' | 'sync'>('upload')
  const [directoryCollectionId, setDirectoryCollectionId] = useState('collection_general')
  const [directoryCollectionName, setDirectoryCollectionName] = useState('')
  const quickUploadInputRef = useRef<HTMLInputElement | null>(null)
  const quickDirectoryInputRef = useRef<HTMLInputElement | null>(null)
  const { canManageModule, canModuleAction } = useWorkspaceAuthority()
  const canManage = canManageModule('knowledge')
  const canShare = canModuleAction('knowledge', 'share') || canManage

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const [response, collectionResponse, projectsResponse, chunkStatsResponse] = await Promise.all([
        fetchProjectKnowledge(loadSession()),
        fetchKnowledgeCollections(loadSession()),
        fetchProjects(loadSession()).catch(() => ({ items: [] })),
        fetchProjectKnowledgeChunkStats(loadSession()).catch(() => null)
      ])
      setItems(response.items)
      setCollections(collectionResponse.items)
      setProjects(projectsResponse.items)
      setChunkStats(chunkStatsResponse)
    } catch {
      setItems([])
      setCollections([])
      setProjects([])
      setChunkStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setKnowledgeView(initialView)
  }, [initialView])

  useEffect(() => {
    const validIds = new Set(items.map((item) => item.id))
    setSelectedDocumentIds((current) => current.filter((id) => validIds.has(id)))
  }, [items])

  useEffect(() => {
    const validSourceIds = new Set(items.flatMap((item) => (item.sources || []).map((source) => source.id)))
    setSelectedSourceIds((current) => current.filter((id) => validSourceIds.has(id)))
    const validChunkIds = new Set(items.flatMap((item) => (item.chunkPreview || []).map((chunk) => chunk.id)))
    setSelectedChunkIds((current) => current.filter((id) => validChunkIds.has(id)))
  }, [items])

  useEffect(() => {
    setPage(1)
  }, [knowledgeView, collectionFilter, retrievalFilter, sourceFilter, query, pageSize, documentSortBy, sourceSortBy, chunkSortBy, sortDirection])

  const filteredItems = items.filter((item) => {
    if (collectionFilter !== 'all' && (item.collectionId || 'collection_general') !== collectionFilter) {
      return false
    }
    if (retrievalFilter !== 'all' && item.retrievalState !== retrievalFilter) {
      return false
    }
    if (sourceFilter !== 'all' && item.source !== sourceFilter) {
      return false
    }

    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [
      item.name,
      item.previewText,
      item.contentText,
      item.type,
      item.source,
      item.collectionName
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  })
  const totalChunks = items.reduce((sum, item) => sum + item.chunkCount, 0)
  const totalSources = items.reduce((sum, item) => sum + (item.sources?.length || 0), 0)
  const indexedCount = items.filter((item) => item.retrievalState === 'indexed').length
  const collectionProjectCounts = collections.reduce<Record<string, number>>((result, collection) => {
    const collectionItemIds = new Set(
      items.filter((item) => (item.collectionId || 'collection_general') === collection.id).map((item) => item.id)
    )
    result[collection.id] = projects.filter((project) =>
      project.data.files.some((file) => file.selected && file.knowledgeItemId && collectionItemIds.has(file.knowledgeItemId))
    ).length
    return result
  }, {})
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
  const chunkLedger = items.flatMap((item) =>
    (item.chunkPreview || []).map((chunk) => ({
      ...chunk,
      itemId: item.id,
      itemName: item.name,
      collectionId: item.collectionId || 'collection_general',
      collectionName: item.collectionName,
      retrievalState: item.retrievalState,
      source: item.source,
      sourceCount: item.sources?.length || 0
    }))
  )
  const filteredCollections = collections.filter((collection) => {
    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [collection.name, collection.description].join(' ').toLowerCase().includes(normalizedQuery)
  })
  const filteredSources = sourceLedger.filter((source) => {
    if (sourceFilter !== 'all' && source.source !== sourceFilter) return false
    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [source.label, source.kind, source.source].join(' ').toLowerCase().includes(normalizedQuery)
  })
  const filteredChunkCoverage = chunkLedger.filter((chunk) => {
    if (collectionFilter !== 'all' && chunk.collectionId !== collectionFilter) return false
    if (retrievalFilter !== 'all' && chunk.retrievalState !== retrievalFilter) return false
    if (sourceFilter !== 'all' && chunk.source !== sourceFilter) return false
    if (!query.trim()) return true
    const normalizedQuery = query.trim().toLowerCase()
    return [chunk.itemName, chunk.text, chunk.source, chunk.collectionName]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  })
  const sortedDocuments = [...filteredItems].sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    if (documentSortBy === 'name') {
      return left.name.localeCompare(right.name) * direction
    }
    if (documentSortBy === 'chunks') {
      return (left.chunkCount - right.chunkCount) * direction
    }
    if (documentSortBy === 'size') {
      return (left.size - right.size) * direction
    }
    return (new Date(left.uploadedAt).getTime() - new Date(right.uploadedAt).getTime()) * direction
  })
  const sortedSources = [...filteredSources].sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    if (sourceSortBy === 'label') {
      return left.label.localeCompare(right.label) * direction
    }
    if (sourceSortBy === 'size') {
      return (left.size - right.size) * direction
    }
    if (sourceSortBy === 'kind') {
      return left.kind.localeCompare(right.kind) * direction
    }
    return (left.documents - right.documents) * direction
  })
  const sortedChunks = [...filteredChunkCoverage].sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    if (chunkSortBy === 'length') {
      return (left.text.length - right.text.length) * direction
    }
    if (chunkSortBy === 'index') {
      return (left.index - right.index) * direction
    }
    return left.itemName.localeCompare(right.itemName) * direction
  })

  const totalVisibleCount =
    knowledgeView === 'documents'
      ? sortedDocuments.length
      : knowledgeView === 'sources'
        ? sortedSources.length
        : knowledgeView === 'chunks'
          ? sortedChunks.length
          : filteredCollections.length
  const totalPages = Math.max(1, Math.ceil(totalVisibleCount / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageEnd = pageStart + pageSize
  const pagedDocuments = sortedDocuments.slice(pageStart, pageEnd)
  const pagedSources = sortedSources.slice(pageStart, pageEnd)
  const pagedChunks = sortedChunks.slice(pageStart, pageEnd)
  const pagedCollections = filteredCollections.slice(pageStart, pageEnd)

  const rebuildTargetIds =
    knowledgeView === 'chunks'
      ? Array.from(new Set(sortedChunks.map((chunk) => chunk.itemId)))
      : sortedDocuments.map((item) => item.id)
  const visibleDocumentIds = knowledgeView === 'documents' ? pagedDocuments.map((item) => item.id) : []
  const selectedVisibleDocumentIds = visibleDocumentIds.filter((id) => selectedDocumentIds.includes(id))
  const allVisibleDocumentsSelected =
    visibleDocumentIds.length > 0 && selectedVisibleDocumentIds.length === visibleDocumentIds.length
  const visibleSourceIds = knowledgeView === 'sources' ? pagedSources.map((source) => source.id) : []
  const selectedVisibleSourceIds = visibleSourceIds.filter((id) => selectedSourceIds.includes(id))
  const allVisibleSourcesSelected = visibleSourceIds.length > 0 && selectedVisibleSourceIds.length === visibleSourceIds.length
  const visibleChunkIds = knowledgeView === 'chunks' ? pagedChunks.map((chunk) => chunk.id) : []
  const selectedVisibleChunkIds = visibleChunkIds.filter((id) => selectedChunkIds.includes(id))
  const allVisibleChunksSelected = visibleChunkIds.length > 0 && selectedVisibleChunkIds.length === visibleChunkIds.length
  const lifecycleSource = sourceLedger.find((source) => source.id === lifecycleSourceId) || null

  async function handleDelete(id: string): Promise<void> {
    try {
      await deleteProjectKnowledge(id, loadSession())
      notify('success', 'Knowledge item deleted.')
      await load()
    } catch {
      notify('error', 'Unable to delete knowledge item.')
    }
  }

  function handleExportVisible(): void {
    if (knowledgeView === 'collections') {
      const visible = pagedCollections.map((collection) => ({
        ...collection,
        projectCount: collectionProjectCounts[collection.id] ?? 0
      }))
      const blob = JSON.stringify({ collections: visible }, null, 2)
      downloadTextFile('openport-knowledge-collections.json', blob)
      return
    }

    if (knowledgeView === 'sources') {
      const blob = JSON.stringify({ sources: pagedSources }, null, 2)
      downloadTextFile('openport-knowledge-sources.json', blob)
      return
    }

    if (knowledgeView === 'chunks') {
      const blob = JSON.stringify({ chunks: pagedChunks }, null, 2)
      downloadTextFile('openport-knowledge-chunks.json', blob)
      return
    }

    const blob = JSON.stringify({ items: pagedDocuments }, null, 2)
    downloadTextFile('openport-knowledge-documents.json', blob)
  }

  async function handleBatchRebuild(options: OpenPortKnowledgeChunkingOptions): Promise<void> {
    const targetItemIds =
      knowledgeView === 'documents' && selectedDocumentIds.length > 0
        ? selectedDocumentIds
        : rebuildTargetIds
    if (targetItemIds.length === 0) return
    setBatchRebuilding(true)
    try {
      const response = await rebuildProjectKnowledgeBatch({ itemIds: targetItemIds, ...options }, loadSession())
      notify('success', `Rebuilt ${response.affectedCount} document(s).`)
      setBatchRebuildModalOpen(false)
      setSelectedDocumentIds([])
      await load()
    } catch {
      notify('error', 'Unable to run batch rebuild.')
    } finally {
      setBatchRebuilding(false)
    }
  }

  async function handleSourceLifecycle(
    sourceId: string,
    action: 'reindex' | 'reset' | 'remove' | 'rebuild' | 'replace',
    options?: (Partial<OpenPortKnowledgeChunkingOptions> & { contentText?: string; label?: string })
  ): Promise<void> {
    setSourceWorkingId(sourceId)
    try {
      const response = await maintainProjectKnowledgeSourceBatch(
        sourceId,
        {
          action,
          ...(options || {})
        },
        loadSession()
      )
      notify('success', `${action} finished for ${response.affectedCount} linked document(s).`)
      await load()
    } catch {
      notify('error', `Unable to ${action} linked source.`)
    } finally {
      setSourceWorkingId(null)
    }
  }

  function toggleDocumentSelection(id: string): void {
    setSelectedDocumentIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }

  function toggleSelectVisibleDocuments(): void {
    if (allVisibleDocumentsSelected) {
      setSelectedDocumentIds((current) => current.filter((id) => !visibleDocumentIds.includes(id)))
      return
    }
    setSelectedDocumentIds((current) => Array.from(new Set([...current, ...visibleDocumentIds])))
  }

  function toggleSourceSelection(id: string): void {
    setSelectedSourceIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }

  function toggleSelectVisibleSources(): void {
    if (allVisibleSourcesSelected) {
      setSelectedSourceIds((current) => current.filter((id) => !visibleSourceIds.includes(id)))
      return
    }
    setSelectedSourceIds((current) => Array.from(new Set([...current, ...visibleSourceIds])))
  }

  function toggleChunkSelection(id: string): void {
    setSelectedChunkIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }

  function toggleSelectVisibleChunks(): void {
    if (allVisibleChunksSelected) {
      setSelectedChunkIds((current) => current.filter((id) => !visibleChunkIds.includes(id)))
      return
    }
    setSelectedChunkIds((current) => Array.from(new Set([...current, ...visibleChunkIds])))
  }

  async function handleBatchDocumentAction(
    action: 'reindex' | 'reset' | 'delete'
  ): Promise<void> {
    if (selectedDocumentIds.length === 0) return
    setBatchMaintaining(true)
    try {
      const response = await maintainProjectKnowledgeBatch(
        {
          action,
          itemIds: selectedDocumentIds
        },
        loadSession()
      )
      notify('success', `${response.action} finished for ${response.affectedCount} document(s).`)
      setSelectedDocumentIds([])
      await load()
    } catch {
      notify('error', `Unable to run ${action} for selected documents.`)
    } finally {
      setBatchMaintaining(false)
    }
  }

  async function handleBatchSourceAction(action: 'reindex' | 'reset' | 'remove' | 'rebuild'): Promise<void> {
    if (selectedSourceIds.length === 0) return
    setBatchMaintaining(true)
    try {
      if (action === 'rebuild') {
        for (const sourceId of selectedSourceIds) {
          await maintainProjectKnowledgeSourceBatch(
            sourceId,
            {
              action: 'rebuild',
              strategy: 'balanced',
              chunkSize: 600,
              overlap: 120,
              maxChunks: 50
            },
            loadSession()
          )
        }
      } else {
        for (const sourceId of selectedSourceIds) {
          await maintainProjectKnowledgeSourceBatch(
            sourceId,
            { action },
            loadSession()
          )
        }
      }
      notify('success', `${action} finished for ${selectedSourceIds.length} source(s).`)
      setSelectedSourceIds([])
      await load()
    } catch {
      notify('error', `Unable to ${action} selected sources.`)
    } finally {
      setBatchMaintaining(false)
    }
  }

  async function handleBatchChunkAction(action: 'reindex' | 'reset' | 'rebuild'): Promise<void> {
    if (selectedChunkIds.length === 0) return
    const chunkTargets = chunkLedger.filter((chunk) => selectedChunkIds.includes(chunk.id))
    const itemIds = Array.from(new Set(chunkTargets.map((chunk) => chunk.itemId)))
    if (itemIds.length === 0) return

    setBatchMaintaining(true)
    try {
      if (action === 'rebuild') {
        await rebuildProjectKnowledgeBatch(
          {
            itemIds,
            strategy: 'balanced',
            chunkSize: 600,
            overlap: 120,
            maxChunks: 50
          },
          loadSession()
        )
      } else {
        await maintainProjectKnowledgeBatch(
          {
            action,
            itemIds
          },
          loadSession()
        )
      }
      notify('success', `${action} finished for ${itemIds.length} document(s) from selected chunks.`)
      setSelectedChunkIds([])
      await load()
    } catch {
      notify('error', `Unable to ${action} selected chunks.`)
    } finally {
      setBatchMaintaining(false)
    }
  }

  async function handleBatchMoveCollection(): Promise<void> {
    if (selectedDocumentIds.length === 0) return
    setBatchMaintaining(true)
    try {
      const response = await maintainProjectKnowledgeBatch(
        {
          action: 'move_collection',
          itemIds: selectedDocumentIds,
          collectionId: moveCollectionId === 'custom' ? undefined : moveCollectionId,
          collectionName: moveCollectionId === 'custom' ? moveCollectionName : undefined
        },
        loadSession()
      )
      notify('success', `Moved ${response.affectedCount} document(s) to target collection.`)
      setMoveCollectionModalOpen(false)
      setSelectedDocumentIds([])
      setMoveCollectionId('collection_general')
      setMoveCollectionName('')
      await load()
    } catch {
      notify('error', 'Unable to move selected documents.')
    } finally {
      setBatchMaintaining(false)
    }
  }

  async function handleQuickUpload(
    file: File,
    input?: { collectionId?: string; collectionName?: string }
  ): Promise<void> {
    setQuickUploadBusy(true)
    try {
      await uploadProjectKnowledge(
        {
          name: file.name || 'Uploaded knowledge',
          type: file.type || 'text/plain',
          size: file.size,
          collectionId: input?.collectionId,
          collectionName: input?.collectionName,
          contentBase64: await fileToBase64(file)
        },
        loadSession()
      )
      notify('success', 'Knowledge file uploaded.')
      await load()
    } catch {
      notify('error', 'Unable to upload knowledge file.')
    } finally {
      setQuickUploadBusy(false)
    }
  }

  async function handleQuickWebSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!quickWebUrl.trim()) {
      notify('error', 'Enter a webpage URL first.')
      return
    }

    setQuickWebSaving(true)
    try {
      await createProjectKnowledgeWeb(
        {
          url: quickWebUrl.trim(),
          name: quickWebName.trim() || undefined,
          collectionId: quickWebCollectionId === 'custom' ? undefined : quickWebCollectionId,
          collectionName: quickWebCollectionId === 'custom' ? quickWebCollectionName.trim() || undefined : undefined
        },
        loadSession()
      )
      notify('success', 'Webpage content added.')
      setQuickWebModalOpen(false)
      setQuickWebUrl('')
      setQuickWebName('')
      setQuickWebCollectionId('collection_general')
      setQuickWebCollectionName('')
      await load()
    } catch {
      notify('error', 'Unable to ingest webpage content.')
    } finally {
      setQuickWebSaving(false)
    }
  }

  async function handleDirectoryImport(files: FileList): Promise<void> {
    const batch = Array.from(files || []).filter((file) => file.size > 0)
    if (batch.length === 0) {
      notify('error', 'No files selected in directory.')
      return
    }

    const targetCollectionId = directoryCollectionId === 'custom' ? undefined : directoryCollectionId
    const targetCollectionName = directoryCollectionId === 'custom' ? directoryCollectionName.trim() || undefined : undefined
    if (directoryCollectionId === 'custom' && !targetCollectionName) {
      notify('error', 'Enter a collection name for custom target.')
      return
    }

    setQuickDirectoryBusy(true)
    try {
      if (directoryMode === 'sync' && directoryCollectionId !== 'custom') {
        const existingIds = items
          .filter((item) => (item.collectionId || 'collection_general') === directoryCollectionId)
          .map((item) => item.id)
        if (existingIds.length > 0) {
          await maintainProjectKnowledgeBatch(
            {
              action: 'delete',
              itemIds: existingIds
            },
            loadSession()
          )
        }
      }

      for (const file of batch) {
        await uploadProjectKnowledge(
          {
            name: file.name || 'Uploaded knowledge',
            type: file.type || 'text/plain',
            size: file.size,
            collectionId: targetCollectionId,
            collectionName: targetCollectionName,
            contentBase64: await fileToBase64(file)
          },
          loadSession()
        )
      }

      notify('success', `${directoryMode === 'sync' ? 'Synced' : 'Uploaded'} ${batch.length} file(s) from directory.`)
      setDirectoryModalOpen(false)
      setDirectoryMode('upload')
      setDirectoryCollectionId('collection_general')
      setDirectoryCollectionName('')
      await load()
    } catch {
      notify('error', `Unable to ${directoryMode} directory content.`)
    } finally {
      setQuickDirectoryBusy(false)
    }
  }

  async function handleQuickTextSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!quickTextContent.trim()) {
      notify('error', 'Enter text content first.')
      return
    }

    setQuickTextSaving(true)
    try {
      await createProjectKnowledgeText(
        {
          name: quickTextName.trim() || 'Untitled knowledge',
          contentText: quickTextContent,
          collectionId: quickTextCollectionId === 'custom' ? undefined : quickTextCollectionId,
          collectionName: quickTextCollectionId === 'custom' ? quickTextCollectionName.trim() || undefined : undefined
        },
        loadSession()
      )
      notify('success', 'Knowledge text added.')
      setQuickTextModalOpen(false)
      setQuickTextName('')
      setQuickTextContent('')
      setQuickTextCollectionId('collection_general')
      setQuickTextCollectionName('')
      await load()
    } catch {
      notify('error', 'Unable to add knowledge text.')
    } finally {
      setQuickTextSaving(false)
    }
  }

  async function handleDropFiles(files: FileList): Promise<void> {
    const entries = Array.from(files || []).filter((file) => file.size > 0)
    if (entries.length === 0) return
    setDropBusy(true)
    try {
      for (const file of entries) {
        await uploadProjectKnowledge(
          {
            name: file.name || 'Uploaded knowledge',
            type: file.type || 'text/plain',
            size: file.size,
            collectionId: collectionFilter !== 'all' ? collectionFilter : undefined,
            contentBase64: await fileToBase64(file)
          },
          loadSession()
        )
      }
      notify('success', `Imported ${entries.length} file(s) from drag and drop.`)
      await load()
    } catch {
      notify('error', 'Unable to import dropped files.')
    } finally {
      setDropBusy(false)
    }
  }

  return (
    <div
      className={`workspace-resource-page${dropActive ? ' is-drop-active' : ''}`}
      onDragEnter={(event) => {
        if (!canManage) return
        event.preventDefault()
        setDropActive(true)
      }}
      onDragLeave={(event) => {
        if (!canManage) return
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDropActive(false)
      }}
      onDragOver={(event) => {
        if (!canManage) return
        event.preventDefault()
      }}
      onDrop={(event) => {
        if (!canManage) return
        event.preventDefault()
        setDropActive(false)
        if (event.dataTransfer?.files?.length) {
          void handleDropFiles(event.dataTransfer.files)
        }
      }}
    >
      <WorkspaceKnowledgeAccessModal
        mode="item"
        onClose={() => setAccessKnowledgeItemId(null)}
        open={Boolean(accessKnowledgeItemId)}
        resourceId={accessKnowledgeItemId || ''}
        resourceLabel="Knowledge document"
      />
      {dropActive ? (
        <div className="workspace-drop-overlay">
          <div className="workspace-drop-overlay-copy">
            <strong>{dropBusy ? 'Importing files…' : 'Drop files to import knowledge'}</strong>
            <span>Files are uploaded into the current collection scope.</span>
          </div>
        </div>
      ) : null}
      <input
        ref={quickUploadInputRef}
        accept=".txt,.md,.json,.csv,.pdf,.doc,.docx"
        className="workspace-hidden-input"
        disabled={quickUploadBusy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void handleQuickUpload(file, {
              collectionId: collectionFilter !== 'all' ? collectionFilter : undefined
            })
          }
          event.currentTarget.value = ''
        }}
        type="file"
      />
      <input
        {...({ webkitdirectory: '', directory: '' } as unknown as React.InputHTMLAttributes<HTMLInputElement>)}
        ref={quickDirectoryInputRef}
        className="workspace-hidden-input"
        disabled={quickDirectoryBusy}
        multiple
        onChange={(event) => {
          const files = event.target.files
          if (files && files.length > 0) {
            void handleDirectoryImport(files)
          }
          event.currentTarget.value = ''
        }}
        type="file"
      />
      <ModalShell
        onClose={() => setQuickTextModalOpen(false)}
        open={quickTextModalOpen}
        title="Add text content"
        footer={
          <>
            <CapsuleButton disabled={quickTextSaving} form="quick-knowledge-text-form" type="submit" variant="primary">
              {quickTextSaving ? 'Saving…' : 'Save text'}
            </CapsuleButton>
            <CapsuleButton onClick={() => setQuickTextModalOpen(false)} type="button" variant="secondary">
              Cancel
            </CapsuleButton>
          </>
        }
      >
        <form id="quick-knowledge-text-form" className="workspace-editor-form" onSubmit={(event) => void handleQuickTextSubmit(event)}>
          <Field label="Name">
            <input onChange={(event) => setQuickTextName(event.target.value)} placeholder="Runbook" value={quickTextName} />
          </Field>
          <Field label="Collection">
            <select onChange={(event) => setQuickTextCollectionId(event.target.value)} value={quickTextCollectionId}>
              <option value="collection_general">General</option>
              {collections
                .filter((collection) => collection.id !== 'collection_general')
                .map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              <option value="custom">Create from name…</option>
            </select>
          </Field>
          {quickTextCollectionId === 'custom' ? (
            <Field label="New collection name">
              <input
                onChange={(event) => setQuickTextCollectionName(event.target.value)}
                placeholder="Policies"
                value={quickTextCollectionName}
              />
            </Field>
          ) : null}
          <Field label="Content">
            <textarea onChange={(event) => setQuickTextContent(event.target.value)} placeholder="Paste knowledge text…" required rows={10} value={quickTextContent} />
          </Field>
        </form>
      </ModalShell>
      <ModalShell
        onClose={() => setQuickWebModalOpen(false)}
        open={quickWebModalOpen}
        title="Add webpage content"
        footer={
          <>
            <CapsuleButton disabled={quickWebSaving} form="quick-knowledge-web-form" type="submit" variant="primary">
              {quickWebSaving ? 'Saving…' : 'Fetch webpage'}
            </CapsuleButton>
            <CapsuleButton onClick={() => setQuickWebModalOpen(false)} type="button" variant="secondary">
              Cancel
            </CapsuleButton>
          </>
        }
      >
        <form id="quick-knowledge-web-form" className="workspace-editor-form" onSubmit={(event) => void handleQuickWebSubmit(event)}>
          <Field label="Webpage URL">
            <input
              onChange={(event) => setQuickWebUrl(event.target.value)}
              placeholder="https://example.com/docs/page"
              required
              value={quickWebUrl}
            />
          </Field>
          <Field label="Name">
            <input onChange={(event) => setQuickWebName(event.target.value)} placeholder="Product doc page" value={quickWebName} />
          </Field>
          <Field label="Collection">
            <select onChange={(event) => setQuickWebCollectionId(event.target.value)} value={quickWebCollectionId}>
              <option value="collection_general">General</option>
              {collections
                .filter((collection) => collection.id !== 'collection_general')
                .map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              <option value="custom">Create from name…</option>
            </select>
          </Field>
          {quickWebCollectionId === 'custom' ? (
            <Field label="New collection name">
              <input
                onChange={(event) => setQuickWebCollectionName(event.target.value)}
                placeholder="Research"
                value={quickWebCollectionName}
              />
            </Field>
          ) : null}
        </form>
      </ModalShell>
      <ModalShell
        onClose={() => setDirectoryModalOpen(false)}
        open={directoryModalOpen}
        title={directoryMode === 'sync' ? 'Sync directory' : 'Upload directory'}
        footer={
          <>
            <CapsuleButton
              disabled={quickDirectoryBusy}
              onClick={() => quickDirectoryInputRef.current?.click()}
              type="button"
              variant="primary"
            >
              {quickDirectoryBusy ? 'Importing…' : 'Choose directory'}
            </CapsuleButton>
            <CapsuleButton onClick={() => setDirectoryModalOpen(false)} type="button" variant="secondary">
              Cancel
            </CapsuleButton>
          </>
        }
      >
        <div className="workspace-editor-form">
          <Field label="Mode">
            <select onChange={(event) => setDirectoryMode(event.target.value as 'upload' | 'sync')} value={directoryMode}>
              <option value="upload">Upload (append)</option>
              <option value="sync">Sync (replace collection documents)</option>
            </select>
          </Field>
          <Field label="Collection">
            <select onChange={(event) => setDirectoryCollectionId(event.target.value)} value={directoryCollectionId}>
              <option value="collection_general">General</option>
              {collections
                .filter((collection) => collection.id !== 'collection_general')
                .map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              <option value="custom">Create from name…</option>
            </select>
          </Field>
          {directoryCollectionId === 'custom' ? (
            <Field label="New collection name">
              <input
                onChange={(event) => setDirectoryCollectionName(event.target.value)}
                placeholder="Imported docs"
                value={directoryCollectionName}
              />
            </Field>
          ) : null}
          <p className="workspace-module-empty">
            {directoryMode === 'sync'
              ? 'Sync mode will remove existing documents in the selected collection before importing.'
              : 'Upload mode appends imported files to the selected collection.'}
          </p>
        </div>
      </ModalShell>
      <ModalShell
        onClose={() => setMoveCollectionModalOpen(false)}
        open={moveCollectionModalOpen}
        title="Move selected documents"
        footer={
          <>
            <CapsuleButton disabled={batchMaintaining} onClick={() => void handleBatchMoveCollection()} type="button" variant="primary">
              {batchMaintaining ? 'Moving…' : 'Move documents'}
            </CapsuleButton>
            <CapsuleButton onClick={() => setMoveCollectionModalOpen(false)} type="button" variant="secondary">
              Cancel
            </CapsuleButton>
          </>
        }
      >
        <div className="workspace-editor-form">
          <Field label="Collection">
            <select onChange={(event) => setMoveCollectionId(event.target.value)} value={moveCollectionId}>
              <option value="collection_general">General</option>
              {collections
                .filter((collection) => collection.id !== 'collection_general')
                .map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              <option value="custom">Create from name…</option>
            </select>
          </Field>
          {moveCollectionId === 'custom' ? (
            <Field label="New collection name">
              <input
                onChange={(event) => setMoveCollectionName(event.target.value)}
                placeholder="Policies"
                value={moveCollectionName}
              />
            </Field>
          ) : null}
          <p className="workspace-module-empty">
            {selectedDocumentIds.length} document(s) selected.
          </p>
        </div>
      </ModalShell>
      <WorkspaceKnowledgeRebuildModal
        description={`Rebuild chunking for ${rebuildTargetIds.length} visible document(s) in ${knowledgeView} view.`}
        onClose={() => setBatchRebuildModalOpen(false)}
        onSubmit={handleBatchRebuild}
        open={batchRebuildModalOpen}
        submitting={batchRebuilding}
        title="Batch rebuild knowledge"
      />
      <WorkspaceKnowledgeSourceLifecycleModal
        busy={Boolean(lifecycleSourceId && sourceWorkingId === lifecycleSourceId)}
        onClose={() => setLifecycleSourceId(null)}
        onRunAction={(action, input) => {
          if (!lifecycleSource) return
          void handleSourceLifecycle(lifecycleSource.id, action, input).then(() => {
            if (action === 'remove') {
              setLifecycleSourceId(null)
            }
          })
        }}
        open={Boolean(lifecycleSource)}
        source={lifecycleSource}
      />
      <PageHeader
        actions={
          <>
            <CapsuleButton active={knowledgeView === 'documents'} href="/workspace/knowledge" variant="secondary">Documents</CapsuleButton>
            <CapsuleButton active={knowledgeView === 'collections'} href="/workspace/knowledge/collections" variant="secondary">Collections</CapsuleButton>
            <CapsuleButton active={knowledgeView === 'sources'} href="/workspace/knowledge/sources" variant="secondary">Sources</CapsuleButton>
            <CapsuleButton active={knowledgeView === 'chunks'} href="/workspace/knowledge/chunks" variant="secondary">Chunks</CapsuleButton>
            <CapsuleButton onClick={handleExportVisible} type="button" variant="secondary">Export visible</CapsuleButton>
            {canManage ? (
              <WorkspaceKnowledgeAddContentMenu
                disabled={quickUploadBusy || quickDirectoryBusy || quickTextSaving || quickWebSaving}
                onAddText={() => setQuickTextModalOpen(true)}
                onAddWebpage={() => setQuickWebModalOpen(true)}
                onSyncDirectory={() => {
                  setDirectoryMode('sync')
                  setDirectoryModalOpen(true)
                }}
                onUploadDirectory={() => {
                  setDirectoryMode('upload')
                  setDirectoryModalOpen(true)
                }}
                onUploadFile={() => quickUploadInputRef.current?.click()}
              />
            ) : null}
            {canManage ? (
              <CapsuleButton disabled={rebuildTargetIds.length === 0 || batchRebuilding} onClick={() => setBatchRebuildModalOpen(true)} type="button" variant="secondary">
                {batchRebuilding ? 'Rebuilding…' : 'Batch rebuild'}
              </CapsuleButton>
            ) : null}
            {canManage ? <CapsuleButton href="/workspace/knowledge/collections/create" variant="secondary">New collection</CapsuleButton> : null}
            {canManage ? <CapsuleButton href="/workspace/knowledge/create" variant="primary">New knowledge</CapsuleButton> : null}
          </>
        }
        description="Upload retrieval sources and inspect indexed knowledge available to projects and models."
        label="Workspace"
        title="Knowledge"
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
            <strong>Collections</strong>
            <p>{collections.length}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Projects attached</strong>
            <p>{projects.filter((project) => project.data.files.some((file) => file.selected && file.knowledgeItemId)).length}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Avg chunk length</strong>
            <p>{chunkStats?.summary.averageChunkLength ?? 0}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Median chunk length</strong>
            <p>{chunkStats?.summary.medianChunkLength ?? 0}</p>
          </article>
          <article className="workspace-resource-detail-card">
            <strong>Thin / Balanced / Oversized</strong>
            <p>
              {(chunkStats?.summary.thinChunkCount ?? 0)} / {(chunkStats?.summary.balancedChunkCount ?? 0)} / {(chunkStats?.summary.oversizedChunkCount ?? 0)}
            </p>
          </article>
        </div>
        {!loading && knowledgeView === 'collections' && collections.length > 0 ? (
          <div className="workspace-collection-grid">
            {pagedCollections.map((collection) => (
              <Link key={collection.id} className="workspace-collection-card" href={`/workspace/knowledge/collections/${collection.id}`}>
                <strong>{collection.name}</strong>
                <p>{collection.description || 'Grouped retrieval sources for shared context.'}</p>
                <div className="workspace-module-chip-row">
                  <Tag>{collection.itemCount} items</Tag>
                  <Tag>{collectionProjectCounts[collection.id] ?? 0} projects</Tag>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
        <div className="workspace-resource-filters">
          <Field label={knowledgeView === 'documents' ? 'Search documents' : knowledgeView === 'collections' ? 'Search collections' : knowledgeView === 'sources' ? 'Search sources' : 'Search chunks'}>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                knowledgeView === 'documents'
                  ? 'Name, preview, source'
                  : knowledgeView === 'collections'
                    ? 'Name, description'
                    : knowledgeView === 'sources'
                      ? 'Label, kind, source'
                      : 'Name, preview, source'
              }
              value={query}
            />
          </Field>
          <Field label="Collection">
            <select onChange={(event) => setCollectionFilter(event.target.value)} value={collectionFilter}>
              <option value="all">All collections</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name} ({collection.itemCount})
                </option>
              ))}
            </select>
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
          {knowledgeView === 'documents' ? (
            <Field label="Sort by">
              <select onChange={(event) => setDocumentSortBy(event.target.value as KnowledgeDocumentSort)} value={documentSortBy}>
                <option value="uploaded">Uploaded time</option>
                <option value="name">Name</option>
                <option value="chunks">Chunk count</option>
                <option value="size">Size</option>
              </select>
            </Field>
          ) : null}
          {knowledgeView === 'sources' ? (
            <Field label="Sort by">
              <select onChange={(event) => setSourceSortBy(event.target.value as KnowledgeSourceSort)} value={sourceSortBy}>
                <option value="documents">Linked documents</option>
                <option value="label">Label</option>
                <option value="size">Size</option>
                <option value="kind">Kind</option>
              </select>
            </Field>
          ) : null}
          {knowledgeView === 'chunks' ? (
            <Field label="Sort by">
              <select onChange={(event) => setChunkSortBy(event.target.value as KnowledgeChunkSort)} value={chunkSortBy}>
                <option value="item">Document</option>
                <option value="length">Chunk length</option>
                <option value="index">Chunk index</option>
              </select>
            </Field>
          ) : null}
          {knowledgeView !== 'collections' ? (
            <Field label="Sort direction">
              <select onChange={(event) => setSortDirection(event.target.value as KnowledgeSortDirection)} value={sortDirection}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </Field>
          ) : null}
          <Field label="Page size">
            <select onChange={(event) => setPageSize(Number(event.target.value) || 20)} value={String(pageSize)}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="40">40</option>
              <option value="80">80</option>
            </select>
          </Field>
        </div>
        {!loading ? (
          <div className="workspace-module-chip-row">
            <Tag>{totalVisibleCount} total</Tag>
            <Tag>Page {safePage} / {totalPages}</Tag>
            <CapsuleButton disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button" variant="secondary">Previous</CapsuleButton>
            <CapsuleButton disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} type="button" variant="secondary">Next</CapsuleButton>
          </div>
        ) : null}
        {!loading && knowledgeView === 'documents' && canManage ? (
          <div className="workspace-module-chip-row">
            <Tag>{selectedDocumentIds.length} selected</Tag>
            <CapsuleButton onClick={toggleSelectVisibleDocuments} type="button" variant="secondary">
              {allVisibleDocumentsSelected ? 'Clear visible' : 'Select visible'}
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedDocumentIds.length === 0 || batchMaintaining}
              onClick={() => void handleBatchDocumentAction('reindex')}
              type="button"
              variant="secondary"
            >
              Re-index selected
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedDocumentIds.length === 0 || batchMaintaining}
              onClick={() => void handleBatchDocumentAction('reset')}
              type="button"
              variant="secondary"
            >
              Reset selected
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedDocumentIds.length === 0 || batchMaintaining}
              onClick={() => setMoveCollectionModalOpen(true)}
              type="button"
              variant="secondary"
            >
              Move collection
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedDocumentIds.length === 0 || batchMaintaining}
              onClick={() => setBatchRebuildModalOpen(true)}
              type="button"
              variant="secondary"
            >
              Rebuild selected
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedDocumentIds.length === 0 || batchMaintaining}
              onClick={() => void handleBatchDocumentAction('delete')}
              type="button"
              variant="secondary"
            >
              Delete selected
            </CapsuleButton>
          </div>
        ) : null}
        {!loading && knowledgeView === 'sources' && canManage ? (
          <div className="workspace-module-chip-row">
            <Tag>{selectedSourceIds.length} selected</Tag>
            <CapsuleButton onClick={toggleSelectVisibleSources} type="button" variant="secondary">
              {allVisibleSourcesSelected ? 'Clear visible' : 'Select visible'}
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedSourceIds.length === 0 || batchMaintaining}
              onClick={() => void handleBatchSourceAction('rebuild')}
              type="button"
              variant="secondary"
            >
              Rebuild selected
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedSourceIds.length === 0 || batchMaintaining}
              onClick={() => void handleBatchSourceAction('reindex')}
              type="button"
              variant="secondary"
            >
              Re-index selected
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedSourceIds.length === 0 || batchMaintaining}
              onClick={() => void handleBatchSourceAction('reset')}
              type="button"
              variant="secondary"
            >
              Reset selected
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedSourceIds.length === 0 || batchMaintaining}
              onClick={() => void handleBatchSourceAction('remove')}
              type="button"
              variant="secondary"
            >
              Remove selected
            </CapsuleButton>
          </div>
        ) : null}
        {!loading && knowledgeView === 'chunks' && canManage ? (
          <div className="workspace-module-chip-row">
            <Tag>{selectedChunkIds.length} selected</Tag>
            <CapsuleButton onClick={toggleSelectVisibleChunks} type="button" variant="secondary">
              {allVisibleChunksSelected ? 'Clear visible' : 'Select visible'}
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedChunkIds.length === 0 || batchMaintaining}
              onClick={() => void handleBatchChunkAction('rebuild')}
              type="button"
              variant="secondary"
            >
              Rebuild selected
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedChunkIds.length === 0 || batchMaintaining}
              onClick={() => void handleBatchChunkAction('reindex')}
              type="button"
              variant="secondary"
            >
              Re-index selected
            </CapsuleButton>
            <CapsuleButton
              disabled={selectedChunkIds.length === 0 || batchMaintaining}
              onClick={() => void handleBatchChunkAction('reset')}
              type="button"
              variant="secondary"
            >
              Reset selected
            </CapsuleButton>
          </div>
        ) : null}
        {loading ? <p className="workspace-module-empty">Loading knowledge…</p> : null}
        {!loading && knowledgeView === 'documents' && sortedDocuments.length === 0 ? <p className="workspace-module-empty">No knowledge items uploaded yet.</p> : null}
        {!loading && knowledgeView === 'collections' && filteredCollections.length === 0 ? <p className="workspace-module-empty">No knowledge collections match this filter.</p> : null}
        {!loading && knowledgeView === 'sources' && sortedSources.length === 0 ? <p className="workspace-module-empty">No knowledge sources match this filter.</p> : null}
        {!loading && knowledgeView === 'chunks' && sortedChunks.length === 0 ? <p className="workspace-module-empty">No indexed chunk documents match this filter.</p> : null}
        {!loading && knowledgeView === 'documents' ? (
          <div className="workspace-resource-list">
            {pagedDocuments.map((item) => (
              <ResourceCard
                key={item.id}
                actions={
                  <ResourceCardActions>
                    <WorkspaceResourceMenu
                      items={[
                        { href: `/workspace/knowledge/${item.id}`, icon: 'solar:eye-outline', label: 'View' },
                        { href: `/workspace/knowledge/chunks/${item.id}`, icon: 'solar:widget-outline', label: 'Chunks' },
                        ...(canShare
                          ? [{ icon: 'solar:shield-user-outline', label: 'Access', onClick: () => setAccessKnowledgeItemId(item.id) }]
                          : []),
                        ...(canManage
                          ? [
                              {
                                danger: true,
                                icon: 'solar:trash-bin-trash-outline',
                                label: 'Delete',
                                onClick: () => void handleDelete(item.id)
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
                    {canManage ? (
                      <input
                        aria-label={`Select ${item.name}`}
                        checked={selectedDocumentIds.includes(item.id)}
                        onChange={() => toggleDocumentSelection(item.id)}
                        type="checkbox"
                      />
                    ) : null}
                    <strong>{item.name}</strong>
                    <span className="status-pill">{item.retrievalState}</span>
                    <Tag>{item.collectionName}</Tag>
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
            ))}
          </div>
        ) : null}
        {!loading && knowledgeView === 'sources' ? (
          <div className="workspace-resource-list">
            {pagedSources.map((source) => (
              <ResourceCard
                key={source.id}
                actions={
                  <ResourceCardActions>
                    <WorkspaceResourceMenu
                      items={[
                        { href: `/workspace/knowledge/sources/${source.id}`, icon: 'solar:eye-outline', label: 'View source' },
                        ...(canManage
                          ? [
                              {
                                icon: 'solar:settings-outline',
                                label: 'Lifecycle panel',
                                onClick: () => setLifecycleSourceId(source.id)
                              },
                              {
                                disabled: sourceWorkingId === source.id,
                                icon: 'solar:refresh-outline',
                                label: 'Rebuild linked',
                                onClick: () => void handleSourceLifecycle(source.id, 'rebuild', { strategy: 'balanced', chunkSize: 600, overlap: 120, maxChunks: 50 })
                              },
                              {
                                disabled: sourceWorkingId === source.id,
                                icon: 'solar:restart-bold',
                                label: 'Re-index linked',
                                onClick: () => void handleSourceLifecycle(source.id, 'reindex')
                              },
                              {
                                disabled: sourceWorkingId === source.id,
                                icon: 'solar:eraser-linear',
                                label: 'Reset linked',
                                onClick: () => void handleSourceLifecycle(source.id, 'reset')
                              },
                              {
                                danger: true,
                                disabled: sourceWorkingId === source.id,
                                icon: 'solar:trash-bin-trash-outline',
                                label: 'Remove linked',
                                onClick: () => void handleSourceLifecycle(source.id, 'remove')
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
                    {canManage ? (
                      <input
                        aria-label={`Select source ${source.label}`}
                        checked={selectedSourceIds.includes(source.id)}
                        onChange={() => toggleSourceSelection(source.id)}
                        type="checkbox"
                      />
                    ) : null}
                    <strong>{source.label}</strong>
                    <Tag>{source.documents} docs</Tag>
                  </ResourceCardHeading>
                  <p>{Math.max(1, Math.round(source.size / 1024))} KB retained across linked documents.</p>
                  <div className="workspace-module-chip-row">
                    <Tag>{source.kind}</Tag>
                    <Tag>{source.source}</Tag>
                  </div>
                </ResourceCardCopy>
              </ResourceCard>
            ))}
          </div>
        ) : null}
        {!loading && knowledgeView === 'chunks' ? (
          <div className="workspace-resource-list">
              {pagedChunks.map((chunk) => (
                <ResourceCard
                key={chunk.id}
                actions={
                  <ResourceCardActions>
                    <WorkspaceResourceMenu
                      items={[
                        { href: `/workspace/knowledge/chunks/${chunk.id}`, icon: 'solar:eye-outline', label: 'Open chunk' },
                        { href: `/workspace/knowledge/${chunk.itemId}`, icon: 'solar:file-text-outline', label: 'Document' }
                      ]}
                    />
                  </ResourceCardActions>
                }
              >
                <ResourceCardCopy>
                  <ResourceCardHeading>
                    {canManage ? (
                      <input
                        aria-label={`Select chunk ${chunk.index + 1}`}
                        checked={selectedChunkIds.includes(chunk.id)}
                        onChange={() => toggleChunkSelection(chunk.id)}
                        type="checkbox"
                      />
                    ) : null}
                    <strong>Chunk {chunk.index + 1}</strong>
                    <Tag>{chunk.itemName}</Tag>
                    <Tag>{chunk.collectionName}</Tag>
                  </ResourceCardHeading>
                  <p>{chunk.text}</p>
                  <div className="workspace-module-chip-row">
                    <Tag>{chunk.retrievalState}</Tag>
                    <Tag>{chunk.source}</Tag>
                    <Tag>{chunk.text.length} chars</Tag>
                    <Tag>{chunk.sourceCount} sources</Tag>
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

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
