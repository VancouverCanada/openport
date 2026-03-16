'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  emitNotesUpdate,
  getNotesEventName,
  groupNotesByTimeRange,
  type OpenPortNote
} from '../../lib/notes-workspace'
import {
  createOpenPortNote,
  deleteOpenPortNote,
  duplicateOpenPortNote,
  fetchNotes,
  loadSession,
  updateOpenPortNote
} from '../../lib/openport-api'
import { Iconify } from '../iconify'
import { CapsuleButton } from '../ui/capsule-button'
import { IconButton } from '../ui/icon-button'

function formatRelativeDate(timestamp: string): string {
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const now = Date.now()
  const diffMs = new Date(timestamp).getTime() - now
  const diffMinutes = Math.round(diffMs / (1000 * 60))
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, 'minute')
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, 'hour')
  return formatter.format(diffDays, 'day')
}

export function NotesWorkspace() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<OpenPortNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let isActive = true

    void (async () => {
      setIsLoading(true)
      try {
        const response = await fetchNotes({ query, archived: false }, loadSession())
        if (!isActive) return
        setNotes(response.items)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    })()

    const sync = () => setReloadToken((value) => value + 1)
    window.addEventListener(getNotesEventName(), sync)
    return () => {
      window.removeEventListener(getNotesEventName(), sync)
      isActive = false
    }
  }, [query, reloadToken])

  const groupedNotes = useMemo(() => groupNotesByTimeRange(notes), [notes])

  async function onCreateNote(): Promise<void> {
    const { note } = await createOpenPortNote({}, loadSession())
    emitNotesUpdate()
    router.push(`/dashboard/notes/${note.id}`)
  }

  return (
    <div className="notes-workspace">
      <section className="notes-workspace-header">
        <div className="notes-workspace-title">
          <span className="dashboard-kicker">Notes</span>
          <h1>Keep context in one place.</h1>
          <p>Searchable notes, grouped by recency, with editor detail and assistant actions in the same workspace.</p>
        </div>

        <CapsuleButton className="notes-primary-action" onClick={onCreateNote} type="button" variant="primary">
          <Iconify icon="solar:add-circle-outline" size={17} />
          <span>New note</span>
        </CapsuleButton>
      </section>

      <section className="notes-toolbar">
        <label className="notes-search">
          <Iconify icon="solar:magnifer-outline" size={16} />
          <input
            aria-label="Search notes"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            type="search"
            value={query}
          />
        </label>

        <div className="notes-toolbar-meta">
          <span>{notes.length} notes</span>
        </div>
      </section>

      {!isLoading && groupedNotes.length > 0 ? (
        <div className="notes-groups">
          {groupedNotes.map(([label, items]) => (
            <section key={label} className="notes-group">
              <div className="notes-group-heading">{label}</div>
              <div className="notes-group-list">
                {items.map((note) => (
                  <article key={note.id} className="notes-list-item">
                    <a className="notes-list-link" href={`/dashboard/notes/${note.id}`}>
                      <div className="notes-list-main">
                        <div className="notes-list-title-row">
                          <strong>{note.title}</strong>
                          <span>{formatRelativeDate(note.updatedAt)}</span>
                        </div>
                        <p>{note.excerpt || 'No content yet.'}</p>
                      </div>
                    </a>

                    <div className="notes-list-actions">
                      <IconButton
                        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                        className="notes-list-action"
                        onClick={async () => {
                          await updateOpenPortNote(note.id, { pinned: !note.pinned }, loadSession())
                          emitNotesUpdate()
                          setReloadToken((value) => value + 1)
                        }}
                        size="md"
                        type="button"
                        variant="list"
                      >
                        <Iconify icon={note.pinned ? 'solar:bookmark-bold' : 'solar:bookmark-outline'} size={16} />
                      </IconButton>
                      <IconButton
                        aria-label="Duplicate note"
                        className="notes-list-action"
                        onClick={async () => {
                          const { note: duplicated } = await duplicateOpenPortNote(note.id, loadSession())
                          emitNotesUpdate()
                          router.push(`/dashboard/notes/${duplicated.id}`)
                        }}
                        size="md"
                        type="button"
                        variant="list"
                      >
                        <Iconify icon="solar:copy-outline" size={16} />
                      </IconButton>
                      <IconButton
                        aria-label="Delete note"
                        className="notes-list-action"
                        onClick={async () => {
                          await deleteOpenPortNote(note.id, loadSession())
                          emitNotesUpdate()
                          setReloadToken((value) => value + 1)
                        }}
                        size="md"
                        type="button"
                        variant="list"
                      >
                        <Iconify icon="solar:trash-bin-trash-outline" size={16} />
                      </IconButton>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="notes-empty-state">
          <Iconify icon="solar:notebook-outline" size={24} />
          <strong>{isLoading ? 'Loading notes…' : query.trim() ? 'No notes match search.' : 'No notes yet.'}</strong>
          <p>
            {isLoading
              ? 'Syncing notes from the OpenPort API.'
              : query.trim()
                ? 'Try a different term.'
                : 'Create the first note to start building a local knowledge trail.'}
          </p>
        </div>
      )}
    </div>
  )
}
