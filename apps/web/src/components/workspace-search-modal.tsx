'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { OpenPortChatSession, OpenPortSearchHighlight, OpenPortSearchItem } from '@openport/product-contracts'
import {
  attachProjectToSearchHref,
  extractSearchTerms,
  getSearchOperatorSuggestions,
  getSearchTimeLabel,
  parseWorkspaceSearchQuery,
  replaceActiveSearchToken,
  type WorkspaceSearchSuggestion
} from '../lib/workspace-search'
import {
  fetchChatList,
  fetchChatListBySearchText,
  fetchChatSession,
  fetchSearchContext,
  loadSession
} from '../lib/openport-api'
import { getWorkspaceEventName, loadProjects, type OpenPortProject } from '../lib/chat-workspace'
import { Iconify } from './iconify'
import { SearchHighlight } from './search-highlight'
import { MessageBubble } from './ui/message-bubble'
import { TextButton } from './ui/text-button'
import { WorkspaceSearchInput } from './workspace-search-input'

type WorkspaceSearchModalProps = {
  show: boolean
  onClose: () => void
}

type WorkspaceSearchResultItem = {
  id: string
  type: OpenPortSearchItem['type']
  title: string
  excerpt: string
  href: string
  updatedAt: string
  metadata: string | null
  highlights: OpenPortSearchHighlight[]
  projectId?: string | null
}

type WorkspaceSearchActionItem = {
  id: string
  title: string
  icon: string
  href: string
}

type SearchEntry = { kind: 'result'; item: WorkspaceSearchResultItem } | { kind: 'action'; item: WorkspaceSearchActionItem }

function buildWorkspaceActionCatalog(query: string): WorkspaceSearchActionItem[] {
  const trimmedQuery = query.trim()
  const titleSuffix = trimmedQuery ? `: ${trimmedQuery}` : ''
  const querySuffix = trimmedQuery ? `?q=${encodeURIComponent(trimmedQuery)}` : ''
  const noteSuffix = trimmedQuery ? `?content=${encodeURIComponent(trimmedQuery)}` : ''

  return [
    {
      id: 'action-new-chat',
      title: `Start a new conversation${titleSuffix}`,
      icon: 'solar:pen-new-square-outline',
      href: `/${querySuffix}`
    },
    {
      id: 'action-new-note',
      title: `Create a new note${titleSuffix}`,
      icon: 'solar:notebook-outline',
      href: `/notes${noteSuffix}`
    }
  ]
}

function getEntrySectionLabel(entry: SearchEntry): string {
  if (entry.kind === 'action') return 'Actions'
  return getSearchTimeLabel(entry.item.updatedAt)
}

function getChatTimestampLabel(value: string): string {
  const date = new Date(value)
  const now = new Date()
  const oneDay = 24 * 60 * 60 * 1000
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.floor((todayStart - targetStart) / oneDay)

  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  if (dayDiff > 1 && dayDiff < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' })
  }

  return date.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  })
}

export function WorkspaceSearchModal({ show, onClose }: WorkspaceSearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [projects, setProjects] = useState<OpenPortProject[]>([])
  const [results, setResults] = useState<OpenPortSearchItem[]>([])
  const [searchTags, setSearchTags] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [previewChat, setPreviewChat] = useState<OpenPortChatSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)

  const filters = useMemo(() => parseWorkspaceSearchQuery(query, projects), [projects, query])
  const queryTerms = useMemo(() => extractSearchTerms(query), [query])
  const suggestions = useMemo(
    () => getSearchOperatorSuggestions(query, projects, searchTags),
    [projects, query, searchTags]
  )
  const actionCatalog = useMemo(() => buildWorkspaceActionCatalog(query), [query])

  const visibleResults = useMemo<WorkspaceSearchResultItem[]>(
    () =>
      [...results]
        .map((item) => ({
          ...item,
          href: attachProjectToSearchHref(item, projects, filters.projectId)
        }))
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [filters.projectId, projects, results]
  )

  const entries = useMemo<SearchEntry[]>(() => {
    const items: SearchEntry[] = actionCatalog.map((item) => ({ kind: 'action', item }) as SearchEntry)
    visibleResults.forEach((item) => {
      items.push({ kind: 'result', item })
    })
    return items
  }, [actionCatalog, visibleResults])

  const selectedEntry = entries[selectedIndex] || null
  const selectedResult = selectedEntry?.kind === 'result' ? selectedEntry.item : null

  useEffect(() => {
    if (!show) return
    setProjects(loadProjects())
    setResults([])
    setPage(1)
    setHasMore(false)

    let isActive = true
    void fetchSearchContext(loadSession())
      .then((response) => {
        if (!isActive) return
        setSearchTags(response.tags.map((entry) => entry.tag))
      })
      .catch(() => {
        if (!isActive) return
        setSearchTags([])
      })

    return () => {
      isActive = false
    }
  }, [show])

  useEffect(() => {
    if (!show || typeof window === 'undefined') return

    const handleWorkspaceUpdate = () => {
      setProjects(loadProjects())
    }

    window.addEventListener(getWorkspaceEventName(), handleWorkspaceUpdate)
    return () => {
      window.removeEventListener(getWorkspaceEventName(), handleWorkspaceUpdate)
    }
  }, [show])

  useEffect(() => {
    const normalized = query.trim()
    if (!normalized) {
      setDebouncedQuery('')
      return
    }

    const timeout = window.setTimeout(() => {
      setDebouncedQuery(normalized)
    }, 500)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [query])

  useEffect(() => {
    if (!show) return

    let isActive = true
    setIsLoading(true)
    setPage(1)

    void (async () => {
      try {
        const response = debouncedQuery
          ? await fetchChatListBySearchText(debouncedQuery, 1, loadSession())
          : await fetchChatList(1, loadSession())

        if (!isActive) return
        setResults(response.items)
        setHasMore(response.hasMore)

      } catch {
        if (!isActive) return
        setResults([])
        setHasMore(false)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      isActive = false
    }
  }, [debouncedQuery, show])

  useEffect(() => {
    if (!show) return
    setSelectedIndex(0)
  }, [entries.length, query, show])

  useEffect(() => {
    setSelectedSuggestionIndex(0)
  }, [suggestions.length, query])

  useEffect(() => {
    if (!show) return

    if (!selectedResult || selectedResult.type !== 'chat') {
      setPreviewChat(null)
      return
    }

    let isActive = true

    void (async () => {
      try {
        const { session } = await fetchChatSession(selectedResult.id, loadSession())
        if (!isActive) return
        setPreviewChat(session)
      } catch {
        if (!isActive) return
        setPreviewChat(null)
      }
    })()

    return () => {
      isActive = false
    }
  }, [selectedResult, show])

  async function loadMoreResults(): Promise<void> {
    if (!hasMore || isLoadingMore) return
    const nextPage = page + 1
    setIsLoadingMore(true)

    try {
      const response = debouncedQuery
        ? await fetchChatListBySearchText(debouncedQuery, nextPage, loadSession())
        : await fetchChatList(nextPage, loadSession())
      setResults((current) => [...current, ...response.items])
      setHasMore(response.hasMore)
      setPage(nextPage)
    } finally {
      setIsLoadingMore(false)
    }
  }

  function acceptSuggestion(suggestion: WorkspaceSearchSuggestion): void {
    setQuery((current) => replaceActiveSearchToken(current, suggestion.replacement))
  }

  function openSelectedEntry(entry: SearchEntry | null): void {
    if (!entry) return
    router.push(entry.item.href)
    onClose()
  }

  useEffect(() => {
    if (!show || typeof window === 'undefined') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if ((event.key === 'Enter' || event.key === 'Tab') && suggestions.length > 0) {
        event.preventDefault()
        acceptSuggestion(suggestions[selectedSuggestionIndex] || suggestions[0])
        return
      }

      if (suggestions.length > 0 && event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedSuggestionIndex((current) => Math.min(current + 1, suggestions.length - 1))
        return
      }

      if (suggestions.length > 0 && event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedSuggestionIndex((current) => Math.max(current - 1, 0))
        return
      }

      const maxIndex = Math.max(entries.length - 1, 0)

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((current) => Math.min(current + 1, maxIndex))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((current) => Math.max(current - 1, 0))
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        openSelectedEntry(selectedEntry)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [entries, onClose, selectedEntry, selectedSuggestionIndex, show, suggestions])

  if (!show) return null

  return (
    <div className="workspace-search-modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label="Search workspace"
        className="workspace-search-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="workspace-search-modal-header">
          <WorkspaceSearchInput
            onChange={setQuery}
            onClear={() => setQuery('')}
            onSuggestionAccept={acceptSuggestion}
            onSuggestionHover={setSelectedSuggestionIndex}
            selectedSuggestionIndex={selectedSuggestionIndex}
            suggestions={suggestions}
            value={query}
          />
          <div className="workspace-search-operator-hint">Use `folder:name` or `tag:name` / `pinned:true`.</div>
        </div>

        <div className="workspace-search-modal-body">
          <div
            className="workspace-search-results"
            onScroll={(event) => {
              const element = event.currentTarget
              if (element.scrollTop + element.clientHeight >= element.scrollHeight - 48) {
                void loadMoreResults()
              }
            }}
          >
            {isLoading ? (
              <div className="workspace-search-empty">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="workspace-search-empty">{query.trim() ? 'No results found.' : 'No chats yet.'}</div>
            ) : (
              entries.map((entry, index) => {
                const currentSection = getEntrySectionLabel(entry)
                const previousSection = index > 0 ? getEntrySectionLabel(entries[index - 1] as SearchEntry) : null
                const showSectionTitle = index === 0 || previousSection !== currentSection

                return (
                  <div key={`${entry.kind}-${entry.item.id}`}>
                    {showSectionTitle ? <div className="workspace-search-section-title">{currentSection}</div> : null}

                    <TextButton
                      className={`workspace-search-result workspace-search-result-detail${selectedIndex === index ? ' is-selected' : ''}${entry.kind === 'result' ? ' workspace-search-result-chat' : ''}`}
                      onClick={() => openSelectedEntry(entry)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      size="md"
                      type="button"
                      variant="inline"
                    >
                      {entry.kind === 'action' ? (
                        <div className="workspace-search-result-icon">
                          <Iconify icon={entry.item.icon} size={18} />
                        </div>
                      ) : null}
                      <div className="workspace-search-result-copy">
                        <strong>
                          {entry.kind === 'action' ? (
                            entry.item.title
                          ) : (
                            <SearchHighlight
                              field="title"
                              highlights={entry.item.highlights}
                              queryTerms={queryTerms}
                              text={entry.item.title}
                            />
                          )}
                        </strong>
                        {entry.kind === 'action' ? <span>{entry.item.href}</span> : null}
                      </div>
                      {entry.kind === 'result' ? (
                        <div className="workspace-search-result-meta">
                          <span>{getChatTimestampLabel(entry.item.updatedAt)}</span>
                        </div>
                      ) : null}
                    </TextButton>
                  </div>
                )
              })
            )}

            {hasMore || isLoadingMore ? (
              <div className="workspace-search-loading-more">{isLoadingMore ? 'Loading more…' : 'Scroll for more'}</div>
            ) : null}
          </div>

          <div className="workspace-search-preview">
            {selectedResult && selectedResult.type === 'chat' ? (
              previewChat ? (
                <div className="workspace-search-preview-card">
                  <div className="workspace-search-preview-header">
                    <span className="dashboard-section-label">Preview</span>
                    <h3>{previewChat.title}</h3>
                  </div>
                  <div className="workspace-search-preview-messages" id="chat-preview">
                    {(previewChat.messages.filter((message) =>
                      queryTerms.length ? queryTerms.some((term) => message.content.toLowerCase().includes(term)) : true
                    ).slice(-4).length > 0
                      ? previewChat.messages.filter((message) =>
                          queryTerms.length ? queryTerms.some((term) => message.content.toLowerCase().includes(term)) : true
                        ).slice(-4)
                      : previewChat.messages.slice(-4)
                    ).map((message) => (
                      <MessageBubble key={message.id} role={message.role}>
                        <p>
                          <SearchHighlight field="excerpt" highlights={[]} queryTerms={queryTerms} text={message.content} />
                        </p>
                      </MessageBubble>
                    ))}

                    {previewChat.messages.length === 0 ? (
                      <div className="empty-state">
                        <strong>No messages yet.</strong>
                        <p>This chat is ready for a first prompt.</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="workspace-search-preview-empty">Loading preview…</div>
              )
            ) : (
              <div className="workspace-search-preview-empty">Select a conversation to preview.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
