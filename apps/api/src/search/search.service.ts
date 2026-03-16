import { Injectable } from '@nestjs/common'
import type {
  OpenPortChatSession,
  OpenPortSearchContextResponse,
  OpenPortSearchHistoryResponse,
  OpenPortProject,
  OpenPortNote,
  OpenPortSearchHighlight,
  OpenPortSearchHistoryItem,
  OpenPortSearchItem,
  OpenPortSearchRecommendation,
  OpenPortSearchResponse,
  OpenPortSearchTagFacet,
  OpenPortSearchType
} from '@openport/product-contracts'
import { AiService } from '../ai/ai.service.js'
import type { RequestActor } from '../common/request-context.js'
import { NotesService } from '../notes/notes.service.js'
import { ProjectsService } from '../projects/projects.service.js'
import { ApiStateStoreService } from '../storage/api-state-store.service.js'
import type { SearchQueryDto } from './dto/search-query.dto.js'
import type { SearchHistoryTrackDto } from './dto/search-history-track.dto.js'

type SearchFilters = {
  type: 'all' | OpenPortSearchType
  text: string
  projectQuery: string | null
  projectScopeIds: string[] | null
  tag: string | null
  archived: boolean | undefined
  pinned: boolean | undefined
  shared: boolean | undefined
}

type SearchContextSignals = {
  tags: OpenPortSearchTagFacet[]
  hasArchived: boolean
  hasPinned: boolean
  hasShared: boolean
  hasChats: boolean
  hasNotes: boolean
  hasProjects: boolean
  folderSuggestion: string | null
}

function normalizeProjectToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

@Injectable()
export class SearchService {
  constructor(
    private readonly ai: AiService,
    private readonly notes: NotesService,
    private readonly projects: ProjectsService,
    private readonly stateStore: ApiStateStoreService
  ) {}

  async search(actor: RequestActor, dto: SearchQueryDto): Promise<OpenPortSearchResponse> {
    const filters = await this.resolveFilters(actor, this.parseFilters(dto))
    const limit = dto.limit ?? 20
    const offset = this.parseCursor(dto.cursor)

    const items = [
      ...(filters.type === 'all' || filters.type === 'chat'
        ? await this.buildChatItems(actor.userId, filters)
        : []),
      ...(filters.type === 'all' || filters.type === 'note'
        ? this.buildNoteItems(actor, filters)
        : [])
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    const paged = items.slice(offset, offset + limit)
    const hasMore = offset + limit < items.length

    return {
      items: paged,
      hasMore,
      nextCursor: hasMore ? String(offset + limit) : null,
      total: items.length
    }
  }

  async getContext(actor: RequestActor): Promise<OpenPortSearchContextResponse> {
    const [recentSearches, signals] = await Promise.all([
      this.stateStore.readSearchHistory(actor.workspaceId, actor.userId),
      this.buildSearchContextSignals(actor)
    ])

    return {
      recentSearches,
      recommendations: this.buildRecommendations(recentSearches, signals),
      tags: signals.tags,
      operators: ['tag:', 'folder:', 'project:', 'pinned:', 'shared:', 'archived:', 'type:']
    }
  }

  async trackHistory(actor: RequestActor, dto: SearchHistoryTrackDto): Promise<OpenPortSearchHistoryResponse> {
    const items = await this.stateStore.trackSearchHistory(actor.workspaceId, actor.userId, {
      query: dto.query,
      lastResultCount: dto.lastResultCount,
      topResultType: dto.topResultType
    })
    return { items }
  }

  async removeHistory(actor: RequestActor, id: string): Promise<OpenPortSearchHistoryResponse> {
    const items = await this.stateStore.removeSearchHistory(actor.workspaceId, actor.userId, id)
    return { items }
  }

  private parseFilters(dto: SearchQueryDto): SearchFilters {
    const tokens = (dto.q || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    const textParts: string[] = []
    let type: SearchFilters['type'] = dto.type || 'all'
    let projectQuery: string | null = null
    let tag: string | null = null
    let archived: boolean | undefined
    let pinned: boolean | undefined
    let shared: boolean | undefined

    for (const token of tokens) {
      const lowered = token.toLowerCase()

      if (lowered.startsWith('type:')) {
        const value = lowered.slice('type:'.length)
        if (value === 'chat' || value === 'note') {
          type = value
          continue
        }
      }

      if (lowered.startsWith('project:')) {
        const value = normalizeProjectToken(token.slice('project:'.length))
        if (value) {
          projectQuery = value
        }
        continue
      }

      if (lowered.startsWith('folder:')) {
        const value = normalizeProjectToken(token.slice('folder:'.length))
        if (value) {
          projectQuery = value
        }
        continue
      }

      if (lowered.startsWith('tag:')) {
        const value = token.slice('tag:'.length).trim().toLowerCase()
        if (value) {
          tag = value
          continue
        }
      }

      if (lowered.startsWith('archived:')) {
        const value = this.parseBooleanToken(lowered.slice('archived:'.length))
        if (value !== undefined) {
          archived = value
          continue
        }
      }

      if (lowered.startsWith('pinned:')) {
        const value = this.parseBooleanToken(lowered.slice('pinned:'.length))
        if (value !== undefined) {
          pinned = value
          continue
        }
      }

      if (lowered.startsWith('shared:')) {
        const value = this.parseBooleanToken(lowered.slice('shared:'.length))
        if (value !== undefined) {
          shared = value
          continue
        }
      }

      textParts.push(token)
    }

    return {
      type,
      text: textParts.join(' ').trim(),
      projectQuery,
      projectScopeIds: null,
      tag,
      archived,
      pinned,
      shared
    }
  }

  private async resolveFilters(actor: RequestActor, filters: SearchFilters): Promise<SearchFilters> {
    if (!filters.projectQuery) return filters

    const collection = await this.projects.list({
      userId: actor.userId,
      workspaceId: actor.workspaceId
    })
    const matchedProject = collection.items.find((project) => {
      const normalizedName = normalizeProjectToken(project.name)
      return normalizedName.includes(filters.projectQuery as string) || project.id.toLowerCase() === filters.projectQuery
    })

    if (!matchedProject) {
      return {
        ...filters,
        projectScopeIds: []
      }
    }

    return {
      ...filters,
      projectScopeIds: this.getProjectScopeIds(collection.items, matchedProject.id)
    }
  }

  private parseBooleanToken(value: string): boolean | undefined {
    if (value === 'true') return true
    if (value === 'false') return false
    return undefined
  }

  private parseCursor(raw?: string): number {
    const value = Number(raw)
    return Number.isInteger(value) && value >= 0 ? value : 0
  }

  private async buildChatItems(userId: string, filters: SearchFilters): Promise<OpenPortSearchItem[]> {
    return (await this.ai.listSessions(userId, { archived: filters.archived }))
      .items
      .filter((chat) => this.matchesChat(chat, filters))
      .map((chat) => this.toChatItem(chat, filters.text))
  }

  private buildNoteItems(actor: RequestActor, filters: SearchFilters): OpenPortSearchItem[] {
    if (filters.projectQuery) return []

    return this.notes
      .list(actor, undefined, filters.archived)
      .items
      .filter((note) => {
        if (filters.pinned !== undefined && note.pinned !== filters.pinned) return false
        if (filters.shared !== undefined && this.isSharedNote(note) !== filters.shared) return false
        if (filters.tag && !note.tags.some((tag) => tag.toLowerCase() === filters.tag)) return false
        if (!filters.text) return true
        const haystack = `${note.title} ${note.contentMd} ${note.tags.join(' ')}`.toLowerCase()
        return haystack.includes(filters.text.toLowerCase())
      })
      .map((note) => this.toNoteItem(note, filters.text))
  }

  private matchesChat(chat: OpenPortChatSession, filters: SearchFilters): boolean {
    const chatFolderId = chat.folderId ?? chat.settings.projectId ?? null

    if (filters.projectQuery) {
      if (!filters.projectScopeIds?.length) return false
      if (!chatFolderId || !filters.projectScopeIds.includes(chatFolderId)) return false
    }
    if (filters.archived !== undefined && chat.archived !== filters.archived) return false
    if (filters.pinned !== undefined && chat.pinned !== filters.pinned) return false
    if (filters.shared !== undefined && this.isSharedChat(chat) !== filters.shared) return false
    if (filters.tag && !chat.tags.some((tag) => tag.toLowerCase() === filters.tag)) return false
    if (!filters.text) return true

    const lowered = filters.text.toLowerCase()
    const haystack = [
      chat.title,
      chat.tags.join(' '),
      ...chat.messages.map((message) => message.content)
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(lowered)
  }

  private isSharedChat(chat: OpenPortChatSession): boolean {
    if (chat.shared === true) return true

    return chat.tags.some((tag) => {
      const lowered = tag.toLowerCase()
      return lowered === 'shared' || lowered === 'public'
    })
  }

  private isSharedNote(note: OpenPortNote): boolean {
    return note.accessGrants.some((grant) => {
      if (grant.principalType === 'public' && grant.principalId === '*') return true
      if (grant.principalType === 'user' && grant.principalId !== note.ownerUserId) return true
      return false
    })
  }

  private getProjectScopeIds(projects: OpenPortProject[], projectId: string): string[] {
    const ids = new Set<string>()
    const stack = [projectId]

    while (stack.length > 0) {
      const current = stack.pop()
      if (!current || ids.has(current)) continue
      ids.add(current)
      projects
        .filter((project) => project.parentId === current)
        .forEach((project) => {
          stack.push(project.id)
        })
    }

    return [...ids]
  }

  private toChatItem(chat: OpenPortChatSession, text: string): OpenPortSearchItem {
    const latestMessage = chat.messages[chat.messages.length - 1]
    const excerpt = latestMessage?.content?.slice(0, 180) || 'No messages yet.'

    return {
      id: chat.id,
      type: 'chat',
      title: chat.title,
      excerpt,
      href: `/chat?thread=${chat.id}`,
      updatedAt: chat.updatedAt,
      metadata: 'Chat',
      projectId: chat.folderId ?? chat.settings.projectId ?? null,
      highlights: this.buildHighlights(chat.title, excerpt, text)
    }
  }

  private toNoteItem(note: OpenPortNote, text: string): OpenPortSearchItem {
    return {
      id: note.id,
      type: 'note',
      title: note.title,
      excerpt: note.excerpt || 'Empty note.',
      href: `/dashboard/notes/${note.id}`,
      updatedAt: note.updatedAt,
      metadata: 'Note',
      highlights: this.buildHighlights(note.title, note.excerpt || 'Empty note.', text)
    }
  }

  private buildHighlights(title: string, excerpt: string, text: string): OpenPortSearchHighlight[] {
    if (!text.trim()) return []

    const fields = [
      { field: 'title' as const, value: title },
      { field: 'excerpt' as const, value: excerpt }
    ]
    const tokens = Array.from(new Set(text.toLowerCase().split(/\s+/).filter(Boolean)))
    const highlights: OpenPortSearchHighlight[] = []

    for (const token of tokens) {
      for (const entry of fields) {
        const index = entry.value.toLowerCase().indexOf(token)
        if (index >= 0) {
          highlights.push({
            field: entry.field,
            start: index,
            end: index + token.length
          })
          break
        }
      }
    }

    return highlights
  }

  private async buildSearchContextSignals(actor: RequestActor): Promise<SearchContextSignals> {
    const [chatResponse, noteResponse, projectResponse] = await Promise.all([
      this.ai.listSessions(actor.userId, {}),
      Promise.resolve(this.notes.list(actor)),
      this.projects
        .list({
          userId: actor.userId,
          workspaceId: actor.workspaceId
        })
        .catch(() => ({ items: [] as OpenPortProject[] }))
    ])

    const tagCounts = new Map<string, number>()
    ;[
      ...chatResponse.items.flatMap((chat) => chat.tags),
      ...noteResponse.items.flatMap((note) => note.tags)
    ]
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      })

    const tags = [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count
        return left.tag.localeCompare(right.tag)
      })

    const folderSuggestion = projectResponse.items[0]?.name
      ? normalizeProjectToken(projectResponse.items[0].name)
      : null

    return {
      tags,
      hasArchived:
        chatResponse.items.some((chat) => chat.archived) || noteResponse.items.some((note) => note.archived),
      hasPinned: chatResponse.items.some((chat) => chat.pinned) || noteResponse.items.some((note) => note.pinned),
      hasShared:
        chatResponse.items.some((chat) => this.isSharedChat(chat)) ||
        noteResponse.items.some((note) => this.isSharedNote(note)),
      hasChats: chatResponse.items.length > 0,
      hasNotes: noteResponse.items.length > 0,
      hasProjects: projectResponse.items.length > 0,
      folderSuggestion
    }
  }

  private buildRecommendations(
    recentSearches: OpenPortSearchHistoryItem[],
    context: SearchContextSignals
  ): OpenPortSearchRecommendation[] {
    const recommendations: OpenPortSearchRecommendation[] = []
    const topHistory = [...recentSearches]
      .filter((entry) => entry.query.includes(':'))
      .sort((left, right) => {
        const countDelta = right.count - left.count
        if (countDelta !== 0) return countDelta
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      })
      .slice(0, 2)

    topHistory.forEach((entry, index) => {
      recommendations.push({
        id: `rec-history-${index}`,
        query: entry.query,
        label: entry.query,
        description: `Used ${entry.count} ${entry.count === 1 ? 'time' : 'times'} recently`,
        reason: 'History'
      })
    })

    if (context.hasChats) {
      recommendations.push({
        id: 'rec-type-chat',
        query: 'type:chat',
        label: 'Chats',
        description: 'Only search chat threads',
        reason: 'Scope'
      })
    }

    if (context.hasNotes) {
      recommendations.push({
        id: 'rec-type-note',
        query: 'type:note',
        label: 'Notes',
        description: 'Only search notes',
        reason: 'Scope'
      })
    }

    if (context.hasProjects && context.folderSuggestion) {
      recommendations.push({
        id: 'rec-folder-default',
        query: `folder:${context.folderSuggestion}`,
        label: 'Folder scope',
        description: 'Search chats inside a project folder scope',
        reason: 'Folder'
      })
    }

    if (context.hasShared) {
      recommendations.push({
        id: 'rec-shared-true',
        query: 'shared:true',
        label: 'Shared',
        description: 'Find shared chats and notes',
        reason: 'State'
      })
    }

    if (context.hasPinned) {
      recommendations.push({
        id: 'rec-pinned-true',
        query: 'pinned:true',
        label: 'Pinned',
        description: 'Find pinned chats and notes',
        reason: 'State'
      })
    }

    if (context.hasArchived) {
      recommendations.push({
        id: 'rec-archived-true',
        query: 'archived:true',
        label: 'Archived',
        description: 'Find archived chats and notes',
        reason: 'State'
      })
    }

    context.tags.slice(0, 4).forEach((entry) => {
      recommendations.push({
        id: `rec-tag-${entry.tag}`,
        query: `tag:${entry.tag}`,
        label: `#${entry.tag}`,
        description: `${entry.count} matching ${entry.count === 1 ? 'item' : 'items'}`,
        reason: 'Tag'
      })
    })

    return recommendations
      .filter(
        (recommendation) =>
          !recentSearches.some((recent) => recent.query.toLowerCase() === recommendation.query.toLowerCase())
      )
      .filter(
        (recommendation, index, current) =>
          current.findIndex((entry) => entry.query.toLowerCase() === recommendation.query.toLowerCase()) === index
      )
      .slice(0, 12)
  }
}
