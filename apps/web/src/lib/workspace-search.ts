import type {
  OpenPortSearchField,
  OpenPortSearchHighlight,
  OpenPortSearchItem,
  OpenPortSearchRecommendation,
  OpenPortSearchHistoryItem
} from '@openport/product-contracts'
import { getProjectDescendantIds, type OpenPortProject } from './chat-workspace'

export type WorkspaceSearchResultType = 'chat' | 'note'

export type OpenPortSearchFilters = {
  projectId: string | null
  text: string
  tag: string | null
  archived: boolean | undefined
  pinned: boolean | undefined
  shared: boolean | undefined
}

export type WorkspaceSearchSuggestion = {
  id: string
  label: string
  description: string
  replacement: string
}

export type WorkspaceRecentSearch = OpenPortSearchHistoryItem

export type WorkspaceSearchTagFacet = {
  tag: string
  count: number
}

export type WorkspaceSearchRecommendation = OpenPortSearchRecommendation

const PROJECT_PREFIX = 'project:'
const FOLDER_PREFIX = 'folder:'
const TAG_PREFIX = 'tag:'
const ARCHIVED_PREFIX = 'archived:'
const PINNED_PREFIX = 'pinned:'
const SHARED_PREFIX = 'shared:'
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
] as const

function normalizeProjectName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

export function parseWorkspaceSearchQuery(
  query: string,
  projects: OpenPortProject[]
): OpenPortSearchFilters {
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  const textParts: string[] = []
  let projectId: string | null = null
  let tag: string | null = null
  let archived: boolean | undefined
  let pinned: boolean | undefined
  let shared: boolean | undefined

  tokens.forEach((token) => {
    const lowered = token.toLowerCase()

    if (lowered.startsWith(PROJECT_PREFIX) || lowered.startsWith(FOLDER_PREFIX)) {
      const prefix = lowered.startsWith(PROJECT_PREFIX) ? PROJECT_PREFIX : FOLDER_PREFIX
      const rawProjectName = normalizeProjectName(token.slice(prefix.length))
      const matchedProject = projects.find((project) => {
        const normalizedName = normalizeProjectName(project.name)
        return normalizedName.includes(rawProjectName) || project.id.toLowerCase() === rawProjectName
      })
      projectId = matchedProject?.id || null
      return
    }

    if (lowered.startsWith(TAG_PREFIX)) {
      const rawTag = token.slice(TAG_PREFIX.length).trim().toLowerCase()
      if (rawTag) {
        tag = rawTag
        return
      }
    }

    if (lowered.startsWith(ARCHIVED_PREFIX)) {
      const value = parseBooleanToken(lowered.slice(ARCHIVED_PREFIX.length))
      if (value !== undefined) {
        archived = value
        return
      }
    }

    if (lowered.startsWith(PINNED_PREFIX)) {
      const value = parseBooleanToken(lowered.slice(PINNED_PREFIX.length))
      if (value !== undefined) {
        pinned = value
        return
      }
    }

    if (lowered.startsWith(SHARED_PREFIX)) {
      const value = parseBooleanToken(lowered.slice(SHARED_PREFIX.length))
      if (value !== undefined) {
        shared = value
        return
      }
    }

    textParts.push(token)
  })

  return {
    projectId,
    text: textParts.join(' ').trim().toLowerCase(),
    tag,
    archived,
    pinned,
    shared
  }
}

function parseBooleanToken(value: string): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

export function applyProjectFilter(
  items: OpenPortSearchItem[],
  projectId: string | null,
  projects: OpenPortProject[]
): OpenPortSearchItem[] {
  if (!projectId) return items

  const project = projects.find((entry) => entry.id === projectId)
  if (!project) return items.filter((item) => item.type !== 'chat')

  const scopedProjectIds = new Set([projectId, ...getProjectDescendantIds(projects, projectId)])

  return items.filter((item) => item.type !== 'chat' || (item.projectId ? scopedProjectIds.has(item.projectId) : false))
}

export function attachProjectToSearchHref(
  item: OpenPortSearchItem,
  projects: OpenPortProject[],
  selectedProjectId: string | null
): string {
  if (item.type !== 'chat') return item.href

  const projectId = selectedProjectId || item.projectId || null

  if (!projectId) return item.href

  const url = new URL(item.href, 'http://openport.local')
  url.searchParams.set('project', projectId)
  return `${url.pathname}?${url.searchParams.toString()}`
}

export function getSearchOperatorSuggestions(
  query: string,
  projects: OpenPortProject[],
  tags: string[] = []
): WorkspaceSearchSuggestion[] {
  const match = query.match(/(?:^|\s)(\S*)$/)
  const activeToken = match?.[1] || ''
  const lowered = activeToken.toLowerCase()

  if (!activeToken) return []

  if (!activeToken.includes(':')) {
    return [TAG_PREFIX, PROJECT_PREFIX, PINNED_PREFIX, SHARED_PREFIX, ARCHIVED_PREFIX]
      .filter((option) => option.startsWith(lowered))
      .map((option) => ({
        id: option,
        label: option,
        description:
          option === PROJECT_PREFIX
              ? 'Filter chats by project'
            : option === TAG_PREFIX
                ? 'Filter by tags'
                : option === PINNED_PREFIX
                  ? 'Filter pinned results'
                  : option === SHARED_PREFIX
                    ? 'Filter shared results'
                  : 'Filter archived results',
        replacement: option
      }))
  }

  if (lowered.startsWith(PROJECT_PREFIX) || lowered.startsWith(FOLDER_PREFIX)) {
    const prefix = lowered.startsWith(PROJECT_PREFIX) ? PROJECT_PREFIX : FOLDER_PREFIX
    const rawValue = normalizeProjectName(activeToken.slice(prefix.length))
    return projects
      .filter((project) => normalizeProjectName(project.name).includes(rawValue))
      .slice(0, 6)
      .map((project) => ({
        id: project.id,
        label: project.name,
        description: 'Filter chats in this project',
        replacement: `${PROJECT_PREFIX}${normalizeProjectName(project.name)}`
      }))
  }

  if (lowered.startsWith(TAG_PREFIX)) {
    const rawValue = lowered.slice(TAG_PREFIX.length)
    const suggestions: WorkspaceSearchSuggestion[] = []

    if (!rawValue || 'none'.startsWith(rawValue)) {
      suggestions.push({
        id: 'tag:none',
        label: 'none',
        description: 'Only show untagged items',
        replacement: `${TAG_PREFIX}none`
      })
    }

    return [
      ...suggestions,
      ...tags
      .filter((tag) => tag.toLowerCase().startsWith(rawValue))
      .slice(0, 8)
      .map((tag) => ({
        id: `tag:${tag}`,
        label: tag,
        description: 'Only show items with this tag',
        replacement: `${TAG_PREFIX}${tag}`
      }))
    ]
  }

  if (
    lowered.startsWith(PINNED_PREFIX) ||
    lowered.startsWith(SHARED_PREFIX) ||
    lowered.startsWith(ARCHIVED_PREFIX)
  ) {
    const rawValue = lowered.startsWith(PINNED_PREFIX)
      ? lowered.slice(PINNED_PREFIX.length)
      : lowered.startsWith(SHARED_PREFIX)
        ? lowered.slice(SHARED_PREFIX.length)
      : lowered.slice(ARCHIVED_PREFIX.length)
    const prefix = lowered.startsWith(PINNED_PREFIX)
      ? PINNED_PREFIX
      : lowered.startsWith(SHARED_PREFIX)
        ? SHARED_PREFIX
        : ARCHIVED_PREFIX

    return ['true', 'false']
      .filter((option) => option.startsWith(rawValue))
      .map((option) => ({
        id: `${prefix}${option}`,
        label: option,
        description: `Set ${prefix.slice(0, -1)} filter to ${option}`,
        replacement: `${prefix}${option}`
      }))
  }

  return []
}

export function replaceActiveSearchToken(query: string, replacement: string): string {
  if (!query.trim()) return `${replacement} `
  return query.replace(/(\S*)$/, replacement).replace(/\s+$/, '') + ' '
}

export function extractSearchTerms(query: string): string[] {
  const filters = parseWorkspaceSearchQuery(query, [])
  return filters.text
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
}

function mergeRanges(ranges: OpenPortSearchHighlight[]): OpenPortSearchHighlight[] {
  if (!ranges.length) return []

  const sorted = [...ranges].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return a.end - b.end
  })

  const merged: OpenPortSearchHighlight[] = [sorted[0]]

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1]
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push({ ...current })
    }
  }

  return merged
}

export function resolveSearchHighlights(
  text: string,
  field: OpenPortSearchField,
  highlights: OpenPortSearchHighlight[],
  queryTerms: string[]
): OpenPortSearchHighlight[] {
  const serverHighlights = highlights
    .filter((highlight) => highlight.field === field)
    .map((highlight) => ({ ...highlight }))

  const lowerText = text.toLowerCase()
  const clientHighlights = queryTerms.flatMap((term) => {
    const ranges: OpenPortSearchHighlight[] = []
    if (!term) return ranges

    let cursor = 0
    while (cursor < lowerText.length) {
      const index = lowerText.indexOf(term, cursor)
      if (index < 0) break
      ranges.push({ field, start: index, end: index + term.length })
      cursor = index + term.length
    }
    return ranges
  })

  return mergeRanges([...serverHighlights, ...clientHighlights])
}

export function getSearchHighlights(
  item: OpenPortSearchItem,
  field: OpenPortSearchField
): OpenPortSearchHighlight[] {
  return item.highlights
    .filter((highlight) => highlight.field === field)
    .sort((a, b) => a.start - b.start)
}

export function getSearchTimeLabel(value: string): string {
  const date = new Date(value)
  const now = new Date()
  const diffTime = now.getTime() - date.getTime()
  const diffDays = diffTime / (1000 * 3600 * 24)

  const nowDate = now.getDate()
  const nowMonth = now.getMonth()
  const nowYear = now.getFullYear()

  const dateDate = date.getDate()
  const dateMonth = date.getMonth()
  const dateYear = date.getFullYear()

  if (nowYear === dateYear && nowMonth === dateMonth && nowDate === dateDate) {
    return 'Today'
  }
  if (nowYear === dateYear && nowMonth === dateMonth && nowDate - dateDate === 1) {
    return 'Yesterday'
  }
  if (diffDays <= 7) {
    return 'Previous 7 days'
  }
  if (diffDays <= 30) {
    return 'Previous 30 days'
  }
  if (nowYear === dateYear) {
    return MONTH_NAMES[dateMonth]
  }
  return String(dateYear)
}
