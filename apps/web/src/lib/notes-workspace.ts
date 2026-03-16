'use client'

import type { OpenPortNote } from './openport-api'

const NOTES_EVENT = 'openport-notes:update'

export type { OpenPortNote }

export function getNotesEventName(): string {
  return NOTES_EVENT
}

export function emitNotesUpdate(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NOTES_EVENT))
}

export function groupNotesByTimeRange(notes: OpenPortNote[]): Array<[string, OpenPortNote[]]> {
  const groups = new Map<string, OpenPortNote[]>()

  for (const note of notes) {
    const key = getTimeRangeLabel(note.updatedAt)
    const items = groups.get(key) || []
    items.push(note)
    groups.set(key, items)
  }

  return Array.from(groups.entries())
}

function getTimeRangeLabel(timestamp: string): string {
  const value = new Date(timestamp).getTime()
  const date = new Date(value)
  const now = new Date()

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000

  if (value >= startOfToday) return 'Today'
  if (value >= startOfYesterday) return 'Yesterday'
  if (value >= startOfWeek) return 'This week'
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) return 'Earlier this month'
  return 'Older'
}

export function getWordCount(content: string): number {
  return content.trim() ? content.trim().split(/\s+/).length : 0
}

export function getCharacterCount(content: string): number {
  return content.length
}

export function getReadingMinutes(content: string): number {
  return Math.max(1, Math.ceil(getWordCount(content) / 220))
}

export function generateTitleSuggestion(content: string): string {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) {
    return `Note ${new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}`
  }

  return firstLine.replace(/^#+\s*/, '').slice(0, 48)
}

export function copyNoteMarkdown(note: OpenPortNote): string {
  return `# ${note.title}\n\n${note.contentMd}`.trim()
}
