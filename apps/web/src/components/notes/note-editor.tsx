'use client'

import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  OpenPortClientSession,
  OpenPortNote,
  OpenPortNoteCollaborationState,
  OpenPortNoteGrant,
  OpenPortNotePermission,
  OpenPortNotePrincipalType
} from '@openport/product-contracts'
import {
  askOpenPortNoteAssistant,
  deleteOpenPortNote,
  duplicateOpenPortNote,
  fetchNote,
  fetchOpenPortNoteAccessGrants,
  loadSession,
  restoreOpenPortNoteVersion,
  revokeOpenPortNoteGrant,
  shareOpenPortNote,
  updateOpenPortNote
} from '../../lib/openport-api'
import {
  copyNoteMarkdown,
  emitNotesUpdate,
  generateTitleSuggestion,
  getCharacterCount,
  getNotesEventName,
  getReadingMinutes,
  getWordCount
} from '../../lib/notes-workspace'
import { type OpenPortNoteRichSnapshot, htmlToPlainText } from '../../lib/notes-rich-text'
import { Iconify } from '../iconify'
import { CapsuleButton } from '../ui/capsule-button'
import { TextButton } from '../ui/text-button'
import { type NoteMentionItem, NoteRichTextEditor } from './note-rich-text-editor'

type NoteEditorProps = {
  noteId: string
}

type SaveState = 'saved' | 'saving' | 'error'

type ShareFormState = {
  principalType: OpenPortNotePrincipalType
  principalId: string
  permission: OpenPortNotePermission
}

const DEFAULT_SHARE_FORM: ShareFormState = {
  principalType: 'workspace',
  principalId: '',
  permission: 'write'
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

function toEditorResetKey(note: Pick<OpenPortNote, 'id' | 'updatedAt'>): string {
  return `${note.id}:${note.updatedAt}`
}

function getPresenceInitial(name: string, fallback: string): string {
  const source = name.trim() || fallback.trim()
  if (!source) return '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
}

function getPresenceColor(userId: string): string {
  const palette = ['#2563eb', '#9333ea', '#059669', '#dc2626', '#d97706', '#0891b2']
  let hash = 0
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return palette[Math.abs(hash) % palette.length] || '#2563eb'
}

export function NoteEditor({ noteId }: NoteEditorProps) {
  const router = useRouter()
  const [note, setNote] = useState<OpenPortNote | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentHtml, setContentHtml] = useState<string | null>(null)
  const [assistantPrompt, setAssistantPrompt] = useState('')
  const [previewMode, setPreviewMode] = useState<'write' | 'preview'>('write')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [persistedTitle, setPersistedTitle] = useState('')
  const [persistedContent, setPersistedContent] = useState('')
  const [accessGrants, setAccessGrants] = useState<OpenPortNoteGrant[]>([])
  const [collaboration, setCollaboration] = useState<OpenPortNoteCollaborationState | null>(null)
  const [realtimeState, setRealtimeState] = useState<'connecting' | 'online' | 'offline'>('offline')
  const [shareForm, setShareForm] = useState<ShareFormState>(DEFAULT_SHARE_FORM)
  const [panelMessage, setPanelMessage] = useState<string | null>(null)
  const [editorResetKey, setEditorResetKey] = useState(noteId)

  const session = useMemo<OpenPortClientSession | null>(() => loadSession(), [noteId])

  async function syncNote(mode: 'loading' | 'silent' = 'loading'): Promise<void> {
    if (mode === 'loading') {
      setLoadState('loading')
    }

    try {
      const [{ note: nextNote }, grantsResponse, nextCollaboration] = await Promise.all([
        fetchNote(noteId, session),
        fetchOpenPortNoteAccessGrants(noteId, session).catch(() => ({ items: [] })),
        Promise.resolve({ noteId, activeUsers: [] })
      ])

      setNote(nextNote)
      if (mode === 'loading') {
        setTitle(nextNote.title)
        setContent(nextNote.contentMd)
        setContentHtml(nextNote.contentHtml)
        setPersistedTitle(nextNote.title)
        setPersistedContent(nextNote.contentMd)
        setEditorResetKey(toEditorResetKey(nextNote))
      } else {
        setPersistedTitle(nextNote.title)
      }
      setAccessGrants(grantsResponse.items)
      setCollaboration(nextCollaboration)
      setLoadState('ready')
    } catch {
      setLoadState('error')
      setNote(null)
    }
  }

  useEffect(() => {
    let isActive = true

    void (async () => {
      if (!isActive) return
      await syncNote()
    })()

    const handleUpdate = () => {
      void syncNote('silent')
    }

    window.addEventListener(getNotesEventName(), handleUpdate)
    return () => {
      isActive = false
      window.removeEventListener(getNotesEventName(), handleUpdate)
    }
  }, [noteId, session])

  useEffect(() => {
    if (loadState !== 'ready' || !note) return
    if (title === persistedTitle) return

    setSaveState('saving')
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const { note: savedNote } = await updateOpenPortNote(
            noteId,
            {
              title: title.trim() || persistedTitle || note.title
            },
            session
          )

          setNote(savedNote)
          setTitle(savedNote.title)
          setPersistedTitle(savedNote.title)
          setSaveState('saved')
          emitNotesUpdate()
        } catch {
          setSaveState('error')
        }
      })()
    }, 360)

    return () => window.clearTimeout(timeout)
  }, [loadState, note, noteId, persistedTitle, session, title])

  const stats = useMemo(
    () => ({
      words: getWordCount(content),
      characters: getCharacterCount(content),
      reading: getReadingMinutes(content)
    }),
    [content]
  )

  const mentionItems = useMemo<NoteMentionItem[]>(() => {
    const registry = new Map<string, NoteMentionItem>()

    if (session) {
      registry.set(session.userId, {
        id: session.userId,
        label: session.name || session.email || session.userId,
        description: session.email,
        icon: '•'
      })
    }

    if (note) {
      registry.set(note.ownerUserId, {
        id: note.ownerUserId,
        label: note.ownerUserId === session?.userId
          ? (session?.name || session?.email || note.ownerUserId)
          : note.ownerUserId,
        description: note.ownerUserId === session?.userId ? 'Owner' : 'Owner user',
        icon: '•'
      })
    }

    accessGrants
      .filter((grant) => grant.principalType === 'user')
      .forEach((grant) => {
        if (registry.has(grant.principalId)) return
        registry.set(grant.principalId, {
          id: grant.principalId,
          label: grant.principalId,
          description: `${grant.permission} access`,
          icon: '•'
        })
      })

    collaboration?.activeUsers.forEach((presence) => {
      registry.set(presence.userId, {
        id: presence.userId,
        label: presence.name || presence.email || presence.userId,
        description: presence.email,
        icon: '•'
      })
    })

    return [...registry.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [accessGrants, collaboration, note, session])

  const activeCollaborators = useMemo(() => collaboration?.activeUsers || [], [collaboration])

  if (loadState === 'loading') {
    return (
      <div className="notes-empty-state">
        <Iconify icon="solar:refresh-outline" size={24} />
        <strong>Loading note…</strong>
        <p>Syncing note content and permissions from the OpenPort API.</p>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="notes-empty-state">
        <Iconify icon="solar:file-corrupted-outline" size={24} />
        <strong>Note not found.</strong>
        <p>This note may have been deleted or you may not have access to it.</p>
      </div>
    )
  }

  async function onDelete(): Promise<void> {
    await deleteOpenPortNote(noteId, session)
    emitNotesUpdate()
    router.push('/dashboard/notes')
  }

  async function onDuplicate(): Promise<void> {
    const { note: duplicated } = await duplicateOpenPortNote(noteId, session)
    emitNotesUpdate()
    router.push(`/dashboard/notes/${duplicated.id}`)
  }

  async function onCopy(): Promise<void> {
    if (!note || typeof navigator === 'undefined' || !navigator.clipboard) return

    const noteForCopy: OpenPortNote = {
      ...note,
      title,
      contentMd: content,
      contentHtml,
      excerpt: htmlToPlainText(contentHtml || '').slice(0, 180)
    }

    await navigator.clipboard.writeText(copyNoteMarkdown(noteForCopy))
    setPanelMessage('Markdown copied.')
  }

  async function onAssistantSubmit(): Promise<void> {
    const prompt = assistantPrompt.trim()
    if (!prompt) return

    const response = await askOpenPortNoteAssistant(noteId, prompt, session)
    setNote((current) => {
      if (!current) return current
      return {
        ...current,
        assistantMessages: response.messages,
        updatedAt: new Date().toISOString()
      }
    })
    setAssistantPrompt('')
    emitNotesUpdate()
  }

  async function onShareSubmit(): Promise<void> {
    if (!note) return

    const payload = {
      principalType: shareForm.principalType,
      principalId: shareForm.principalType === 'workspace'
        ? shareForm.principalId.trim() || note.workspaceId
        : shareForm.principalType === 'public'
          ? '*'
          : shareForm.principalId.trim(),
      permission: shareForm.permission
    }

    await shareOpenPortNote(noteId, payload, session)
    const { items } = await fetchOpenPortNoteAccessGrants(noteId, session)
    setAccessGrants(items)
    setPanelMessage('Access grant updated.')
    setShareForm(DEFAULT_SHARE_FORM)
  }

  function handleSnapshot(snapshot: OpenPortNoteRichSnapshot): void {
    setContent(snapshot.contentMd)
    setContentHtml(snapshot.contentHtml)
    setPersistedContent(snapshot.contentMd)
    setSaveState('saved')
    setNote((current) => current
      ? {
          ...current,
          contentMd: snapshot.contentMd,
          contentHtml: snapshot.contentHtml,
          excerpt: snapshot.excerpt,
          updatedAt: new Date().toISOString()
        }
      : current
    )
  }

  return (
    <div className="note-editor-shell">
      <section className="note-editor-main">
        <div className="note-editor-header">
          <div className="note-editor-header-copy">
            <span className="dashboard-kicker">Notes</span>
            <input
              aria-label="Note title"
              className="note-editor-title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled note"
              type="text"
              value={title}
            />
            <div className="note-editor-meta">
              <span>
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'error'
                    ? 'Save failed'
                    : 'Saved'}
              </span>
              <span className={`note-realtime-badge is-${realtimeState}`}>{realtimeState}</span>
              <span>{formatDate(note.updatedAt)}</span>
            </div>
            <div className="note-collaborator-strip">
              {activeCollaborators.length > 0 ? (
                <>
                  <div className="note-collaborator-stack">
                    {activeCollaborators.slice(0, 5).map((presence) => (
                      <span
                        key={`${presence.userId}-${presence.seenAt}`}
                        className="note-collaborator-avatar"
                        style={{ '--presence-color': getPresenceColor(presence.userId) } as CSSProperties}
                        title={`${presence.name} · ${presence.state}`}
                      >
                        {getPresenceInitial(presence.name, presence.email)}
                      </span>
                    ))}
                  </div>
                  <span className="note-collaborator-copy">
                    {activeCollaborators.length} active
                  </span>
                </>
              ) : (
                <span className="note-collaborator-copy">Solo editing</span>
              )}
            </div>
          </div>

          <div className="note-editor-actions">
            <CapsuleButton active={previewMode === 'write'} onClick={() => setPreviewMode('write')} size="sm" type="button" variant="secondary">
              Write
            </CapsuleButton>
            <CapsuleButton active={previewMode === 'preview'} onClick={() => setPreviewMode('preview')} size="sm" type="button" variant="secondary">
              Preview
            </CapsuleButton>
          </div>
        </div>

        <div className="note-editor-canvas">
          {session ? (
            <NoteRichTextEditor
              contentHtml={contentHtml}
              contentMd={content}
              mentionItems={mentionItems}
              mode={previewMode}
              noteId={note.id}
              onConnection={setRealtimeState}
              onPresence={setCollaboration}
              onSnapshot={handleSnapshot}
              resetKey={editorResetKey}
              session={session}
            />
          ) : (
            <div className="note-rich-loading">Sign in to edit this note.</div>
          )}
        </div>
      </section>

      <aside className="note-editor-panel">
        <section className="note-panel-section">
          <div className="note-panel-heading">Details</div>
          <div className="note-panel-list">
            <div className="note-panel-row">
              <span>Words</span>
              <strong>{stats.words}</strong>
            </div>
            <div className="note-panel-row">
              <span>Characters</span>
              <strong>{stats.characters}</strong>
            </div>
            <div className="note-panel-row">
              <span>Read time</span>
              <strong>{stats.reading} min</strong>
            </div>
            <div className="note-panel-row">
              <span>Pinned</span>
              <strong>{note.pinned ? 'Yes' : 'No'}</strong>
            </div>
          </div>
        </section>

        <section className="note-panel-section">
          <div className="note-panel-heading">Collaboration</div>
          <div className="note-version-list">
            {collaboration?.activeUsers.length ? (
              collaboration.activeUsers.map((presence) => (
                <div key={`${presence.userId}-${presence.seenAt}`} className="note-version-item note-presence-item">
                  <span>{presence.name}</span>
                  <strong>{presence.state}</strong>
                </div>
              ))
            ) : (
              <p className="note-panel-empty">No one else is active in this note.</p>
            )}
          </div>
        </section>

        <section className="note-panel-section">
          <div className="note-panel-heading">Sharing</div>
          <div className="note-panel-list">
            {accessGrants.map((grant) => (
              <div key={grant.id} className="note-panel-row">
                <span>{grant.principalType === 'public' ? 'Public' : grant.principalId}</span>
                <strong>{grant.permission}</strong>
                <TextButton
                  className="note-panel-inline-remove"
                  onClick={async () => {
                    await revokeOpenPortNoteGrant(noteId, grant.id, session)
                    const { items } = await fetchOpenPortNoteAccessGrants(noteId, session)
                    setAccessGrants(items)
                    setPanelMessage('Access grant removed.')
                  }}
                  size="sm"
                  type="button"
                  variant="inline"
                >
                  Remove
                </TextButton>
              </div>
            ))}
          </div>
          <div className="note-share-form">
            <select
              aria-label="Share principal type"
              onChange={(event) => {
                setShareForm((current) => ({
                  ...current,
                  principalType: event.target.value as OpenPortNotePrincipalType
                }))
              }}
              value={shareForm.principalType}
            >
              <option value="workspace">Workspace</option>
              <option value="user">User</option>
              <option value="public">Public</option>
            </select>
            {shareForm.principalType !== 'public' ? (
              <input
                aria-label="Share principal id"
                onChange={(event) => {
                  setShareForm((current) => ({
                    ...current,
                    principalId: event.target.value
                  }))
                }}
                placeholder={shareForm.principalType === 'workspace' ? note.workspaceId : 'User ID'}
                type="text"
                value={shareForm.principalId}
              />
            ) : null}
            <select
              aria-label="Share permission"
              onChange={(event) => {
                setShareForm((current) => ({
                  ...current,
                  permission: event.target.value as OpenPortNotePermission
                }))
              }}
              value={shareForm.permission}
            >
              <option value="read">Read</option>
              <option value="write">Write</option>
              <option value="admin">Admin</option>
            </select>
            <CapsuleButton className="note-share-submit" onClick={onShareSubmit} type="button" variant="secondary">Add grant</CapsuleButton>
          </div>
        </section>

        <section className="note-panel-section">
          <div className="note-panel-heading">Actions</div>
          <div className="note-panel-actions">
            <TextButton className="note-panel-action" onClick={() => setTitle(generateTitleSuggestion(content))} variant="panel" type="button">
              <Iconify icon="solar:pen-new-square-outline" size={16} />
              <span>Generate title</span>
            </TextButton>
            <TextButton
              className="note-panel-action"
              onClick={async () => {
                const { note: updated } = await updateOpenPortNote(noteId, { pinned: !note.pinned }, session)
                setNote(updated)
                emitNotesUpdate()
              }}
              variant="panel"
              type="button"
            >
              <Iconify icon={note.pinned ? 'solar:bookmark-bold' : 'solar:bookmark-outline'} size={16} />
              <span>{note.pinned ? 'Unpin note' : 'Pin note'}</span>
            </TextButton>
            <TextButton className="note-panel-action" onClick={onCopy} variant="panel" type="button">
              <Iconify icon="solar:copy-outline" size={16} />
              <span>Copy markdown</span>
            </TextButton>
            <TextButton className="note-panel-action" onClick={onDuplicate} variant="panel" type="button">
              <Iconify icon="solar:document-add-outline" size={16} />
              <span>Duplicate</span>
            </TextButton>
            <TextButton className="note-panel-action" danger onClick={onDelete} variant="panel" type="button">
              <Iconify icon="solar:trash-bin-trash-outline" size={16} />
              <span>Delete note</span>
            </TextButton>
          </div>
        </section>

        <section className="note-panel-section">
          <div className="note-panel-heading">Assistant</div>
          <div className="note-assistant-thread">
            {note.assistantMessages.length > 0 ? (
              note.assistantMessages.map((message) => (
                <article key={message.id} className={`note-assistant-message ${message.role}`}>
                  <span>{message.role === 'assistant' ? 'Assistant' : 'You'}</span>
                  <p>{message.content}</p>
                </article>
              ))
            ) : (
              <p className="note-panel-empty">Ask for a summary, title, or action list.</p>
            )}
          </div>
          <div className="note-assistant-composer">
            <textarea
              aria-label="Ask note assistant"
              onChange={(event) => setAssistantPrompt(event.target.value)}
              placeholder="Ask about this note"
              value={assistantPrompt}
            />
            <CapsuleButton className="note-assistant-submit" onClick={onAssistantSubmit} type="button" variant="primary">Send</CapsuleButton>
          </div>
        </section>

        <section className="note-panel-section">
          <div className="note-panel-heading">Versions</div>
          <div className="note-version-list">
            {note.versions.length > 0 ? (
              note.versions.map((version) => (
                <TextButton
                  key={version.id}
                  className="note-version-item"
                  onClick={async () => {
                    const { note: restored } = await restoreOpenPortNoteVersion(noteId, version.id, session)
                    setNote(restored)
                    setTitle(restored.title)
                    setContent(restored.contentMd)
                    setContentHtml(restored.contentHtml)
                    setPersistedTitle(restored.title)
                    setPersistedContent(restored.contentMd)
                    setEditorResetKey(toEditorResetKey(restored))
                    emitNotesUpdate()
                  }}
                  size="md"
                  type="button"
                  variant="panel"
                >
                  <span>{version.title}</span>
                  <strong>{formatDate(version.savedAt)}</strong>
                </TextButton>
              ))
            ) : (
              <p className="note-panel-empty">Versions appear after edits are saved.</p>
            )}
          </div>
        </section>

        {panelMessage ? <p className="note-panel-message">{panelMessage}</p> : null}
      </aside>
    </div>
  )
}
