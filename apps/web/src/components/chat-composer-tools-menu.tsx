'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  OpenPortChatSession,
  OpenPortNote,
  OpenPortProjectAsset,
  OpenPortProjectKnowledgeItem,
  OpenPortWorkspacePrompt
} from '../lib/openport-api'
import {
  createProjectWebAsset,
  fetchChatSessions,
  fetchNotes,
  fetchProjectAssets,
  fetchProjectKnowledge,
  fetchWorkspacePrompts,
  loadSession,
  uploadProjectAsset
} from '../lib/openport-api'
import { notify } from '../lib/toast'
import { Iconify } from './iconify'
import { CapsuleButton } from './ui/capsule-button'
import { TextButton } from './ui/text-button'

export type ComposerAttachment = {
  id: string
  label: string
  meta?: string
  payload: string
  type: 'chat' | 'file' | 'knowledge' | 'note' | 'prompt' | 'web'
  assetId?: string | null
  contentUrl?: string | null
}

type ChatComposerToolsMenuProps = {
  currentThreadId?: string | null
  onClose: () => void
  onSelect: (attachment: ComposerAttachment) => void
  open: boolean
}

type ToolTab = 'root' | 'files' | 'knowledge' | 'notes' | 'chats' | 'prompts' | 'web'

const toolLabels: Record<Exclude<ToolTab, 'root'>, string> = {
  files: 'Files',
  knowledge: 'Knowledge',
  notes: 'Notes',
  chats: 'Chats',
  prompts: 'Prompts',
  web: 'Webpage'
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const [, payload = ''] = result.split(',', 2)
      resolve(payload)
    }
    reader.readAsDataURL(file)
  })
}

export function ChatComposerToolsMenu({
  currentThreadId = null,
  onClose,
  onSelect,
  open
}: ChatComposerToolsMenuProps) {
  const [tab, setTab] = useState<ToolTab>('root')
  const [query, setQuery] = useState('')
  const [webUrl, setWebUrl] = useState('')
  const [notes, setNotes] = useState<OpenPortNote[]>([])
  const [assets, setAssets] = useState<OpenPortProjectAsset[]>([])
  const [knowledgeItems, setKnowledgeItems] = useState<OpenPortProjectKnowledgeItem[]>([])
  const [chats, setChats] = useState<OpenPortChatSession[]>([])
  const [prompts, setPrompts] = useState<OpenPortWorkspacePrompt[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const captureInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    void Promise.all([
      fetchNotes({}, loadSession()).catch(() => ({ items: [] })),
      fetchProjectAssets({ scope: 'workspace' }, loadSession()).catch(() => ({ items: [] })),
      fetchProjectKnowledge(loadSession()).catch(() => ({ items: [] })),
      fetchChatSessions({}, loadSession()).catch(() => ({ items: [] })),
      fetchWorkspacePrompts(loadSession()).catch(() => ({ items: [] }))
    ]).then(([notesResponse, assetsResponse, knowledgeResponse, chatsResponse, promptsResponse]) => {
      if (cancelled) return
      setNotes(notesResponse.items.slice(0, 12))
      setAssets(
        assetsResponse.items
          .filter((asset) => asset.kind === 'chat' || asset.kind === 'webpage')
          .slice(0, 16)
      )
      setKnowledgeItems(knowledgeResponse.items.slice(0, 12))
      setChats(chatsResponse.items.filter((chat) => chat.id !== currentThreadId).slice(0, 12))
      setPrompts(promptsResponse.items.slice(0, 12))
    })

    return () => {
      cancelled = true
    }
  }, [currentThreadId, open])

  useEffect(() => {
    if (!open) {
      setTab('root')
      setQuery('')
      setWebUrl('')
      setFeedback(null)
    }
  }, [open])

  useEffect(() => {
    setQuery('')
  }, [tab])

  const normalizedQuery = query.trim().toLowerCase()

  const filteredKnowledge = useMemo(
    () =>
      knowledgeItems.filter((item) =>
        [item.name, item.type, item.collectionName || '', item.previewText || ''].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        )
      ),
    [knowledgeItems, normalizedQuery]
  )
  const filteredNotes = useMemo(
    () =>
      notes.filter((note) =>
        [note.title, note.excerpt, note.contentMd].some((value) => value.toLowerCase().includes(normalizedQuery))
      ),
    [notes, normalizedQuery]
  )
  const filteredChats = useMemo(
    () =>
      chats.filter((chat) =>
        [chat.title, ...chat.tags].some((value) => value.toLowerCase().includes(normalizedQuery))
      ),
    [chats, normalizedQuery]
  )
  const filteredPrompts = useMemo(
    () =>
      prompts.filter((prompt) =>
        [prompt.title, prompt.command, prompt.description, prompt.content].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        )
      ),
    [prompts, normalizedQuery]
  )
  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) =>
        [asset.name, asset.kind, asset.previewText || '', asset.sourceUrl || ''].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        )
      ),
    [assets, normalizedQuery]
  )

  if (!open) return null

  async function handleFileUpload(file: File | null): Promise<void> {
    if (!file) return
    const session = loadSession()
    if (!session) return
    setIsUploading(true)
    setFeedback(null)
    try {
      const contentBase64 = await fileToBase64(file)
      const response = await uploadProjectAsset(
        {
          kind: 'chat',
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          contentBase64
        },
        session
      )
      setAssets((current) => [response.asset, ...current.filter((asset) => asset.id !== response.asset.id)])
      onSelect({
        id: response.asset.id,
        label: response.asset.name,
        meta: response.asset.type,
        payload: response.asset.previewText || `Attached file: ${response.asset.name}`,
        type: 'file',
        assetId: response.asset.id,
        contentUrl: response.asset.contentUrl
      })
      onClose()
    } catch {
      setFeedback('Unable to upload file.')
      notify('error', 'Unable to upload file.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleWebpageAttach(): Promise<void> {
    const nextUrl = webUrl.trim()
    if (!nextUrl) return
    const session = loadSession()
    if (!session) return
    setIsUploading(true)
    setFeedback(null)
    try {
      const response = await createProjectWebAsset({ url: nextUrl }, session)
      setAssets((current) => [response.asset, ...current.filter((asset) => asset.id !== response.asset.id)])
      onSelect({
        id: response.asset.id,
        label: response.asset.name,
        meta: 'webpage',
        payload: response.asset.previewText || `Web reference: ${response.asset.sourceUrl || nextUrl}`,
        type: 'web',
        assetId: response.asset.id,
        contentUrl: response.asset.contentUrl
      })
      onClose()
    } catch {
      setFeedback('Unable to fetch webpage.')
      notify('error', 'Unable to fetch webpage.')
    } finally {
      setIsUploading(false)
    }
  }

  function renderSearchBar(placeholder: string) {
    return (
      <div className="chat-tools-menu-search">
        <Iconify icon="solar:magnifer-outline" size={15} />
        <input
          aria-label={placeholder}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          value={query}
        />
      </div>
    )
  }

  return (
    <div className="chat-tools-menu" role="menu">
      <input
        accept="*/*"
        hidden
        onChange={(event) => void handleFileUpload(event.target.files?.[0] ?? null)}
        ref={fileInputRef}
        type="file"
      />
      <input
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => void handleFileUpload(event.target.files?.[0] ?? null)}
        ref={captureInputRef}
        type="file"
      />
      {tab === 'root' ? (
        <div className="chat-tools-menu-list">
          <div className="chat-tools-menu-heading">Include context</div>
          <TextButton
            className="chat-tools-menu-item"
            onClick={() => fileInputRef.current?.click()}
            type="button"
            variant="menu"
          >
            <Iconify icon="solar:upload-outline" size={17} />
            <span className="chat-tools-menu-copy">
              <strong>Upload Files</strong>
              <span>Add local files to this chat</span>
            </span>
          </TextButton>
          <TextButton
            className="chat-tools-menu-item"
            onClick={() => captureInputRef.current?.click()}
            type="button"
            variant="menu"
          >
            <Iconify icon="solar:camera-outline" size={17} />
            <span className="chat-tools-menu-copy">
              <strong>Capture</strong>
              <span>Attach a fresh image from the camera</span>
            </span>
          </TextButton>
          <TextButton className="chat-tools-menu-item" onClick={() => setTab('web')} type="button" variant="menu">
            <Iconify icon="solar:global-outline" size={17} />
            <span className="chat-tools-menu-copy">
              <strong>Attach Webpage</strong>
              <span>Fetch and attach a URL snapshot</span>
            </span>
          </TextButton>
          <TextButton className="chat-tools-menu-item" onClick={() => setTab('files')} type="button" variant="menu">
            <Iconify icon="solar:folder-with-files-outline" size={17} />
            <span className="chat-tools-menu-copy">
              <strong>Files</strong>
              <span>{assets.length} uploaded assets</span>
            </span>
          </TextButton>
          <TextButton className="chat-tools-menu-item" onClick={() => setTab('knowledge')} type="button" variant="menu">
            <Iconify icon="solar:database-outline" size={17} />
            <span className="chat-tools-menu-copy">
              <strong>Knowledge</strong>
              <span>{knowledgeItems.length} items ready</span>
            </span>
          </TextButton>
          <TextButton className="chat-tools-menu-item" onClick={() => setTab('notes')} type="button" variant="menu">
            <Iconify icon="solar:notebook-outline" size={17} />
            <span className="chat-tools-menu-copy">
              <strong>Notes</strong>
              <span>{notes.length} notes available</span>
            </span>
          </TextButton>
          <TextButton className="chat-tools-menu-item" onClick={() => setTab('chats')} type="button" variant="menu">
            <Iconify icon="solar:chat-round-line-outline" size={17} />
            <span className="chat-tools-menu-copy">
              <strong>Chats</strong>
              <span>{chats.length} recent threads</span>
            </span>
          </TextButton>
          <TextButton className="chat-tools-menu-item" onClick={() => setTab('prompts')} type="button" variant="menu">
            <Iconify icon="solar:chat-round-like-outline" size={17} />
            <span className="chat-tools-menu-copy">
              <strong>Prompts</strong>
              <span>{prompts.length} reusable prompts</span>
            </span>
          </TextButton>
          <TextButton className="chat-tools-menu-item" onClick={() => setTab('web')} type="button" variant="menu">
            <Iconify icon="solar:global-outline" size={17} />
            <span className="chat-tools-menu-copy">
              <strong>Webpage</strong>
              <span>Paste a URL to attach</span>
            </span>
          </TextButton>
        </div>
      ) : (
        <div className="chat-tools-menu-list">
          <TextButton className="chat-tools-menu-item" onClick={() => setTab('root')} type="button" variant="menu">
            <Iconify icon="solar:alt-arrow-left-outline" size={16} />
            <span>Back</span>
          </TextButton>

          <div className="chat-tools-menu-subheading">{toolLabels[tab]}</div>

          {tab === 'files' ? renderSearchBar('Search files') : null}
          {tab === 'knowledge' ? renderSearchBar('Search knowledge') : null}
          {tab === 'notes' ? renderSearchBar('Search notes') : null}
          {tab === 'chats' ? renderSearchBar('Search chats') : null}
          {tab === 'prompts' ? renderSearchBar('Search prompts') : null}

          {tab === 'files' ? (
            <div className="chat-tools-menu-files">
              <CapsuleButton
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                type="button"
                variant="secondary"
              >
                {isUploading ? 'Uploading…' : 'Upload file'}
              </CapsuleButton>

              {filteredAssets.map((asset) => (
                <TextButton
                  className="chat-tools-menu-item"
                  key={asset.id}
                  onClick={() => {
                    onSelect({
                      id: asset.id,
                      label: asset.name,
                      meta: asset.kind,
                      payload: asset.previewText || `Attached ${asset.kind}: ${asset.name}`,
                      type: asset.kind === 'webpage' ? 'web' : 'file',
                      assetId: asset.id,
                      contentUrl: asset.contentUrl
                    })
                    onClose()
                  }}
                  type="button"
                  variant="menu"
                >
                  <span className="chat-tools-menu-copy">
                    <strong>{asset.name}</strong>
                    <span>{asset.kind}</span>
                  </span>
                </TextButton>
              ))}
            </div>
          ) : null}

          {tab === 'knowledge'
            ? filteredKnowledge.map((item) => (
                <TextButton
                  className="chat-tools-menu-item"
                  key={item.id}
                  onClick={() => {
                    onSelect({
                      id: item.id,
                      label: item.name,
                      meta: item.type,
                      payload: `Knowledge reference: ${item.name}${item.previewText ? ` — ${item.previewText}` : ''}`,
                      type: 'knowledge'
                    })
                    onClose()
                  }}
                  type="button"
                  variant="menu"
                >
                  <span className="chat-tools-menu-copy">
                    <strong>{item.name}</strong>
                    <span>{item.type}</span>
                  </span>
                </TextButton>
              ))
            : null}

          {tab === 'notes'
            ? filteredNotes.map((note) => (
                <TextButton
                  className="chat-tools-menu-item"
                  key={note.id}
                  onClick={() => {
                    onSelect({
                      id: note.id,
                      label: note.title,
                      meta: 'note',
                      payload: `Note reference: ${note.title}\n${note.contentMd.slice(0, 220)}`,
                      type: 'note'
                    })
                    onClose()
                  }}
                  type="button"
                  variant="menu"
                >
                  <span className="chat-tools-menu-copy">
                    <strong>{note.title}</strong>
                    <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                  </span>
                </TextButton>
              ))
            : null}

          {tab === 'chats'
            ? filteredChats.map((chat) => (
                <TextButton
                  className="chat-tools-menu-item"
                  key={chat.id}
                  onClick={() => {
                    onSelect({
                      id: chat.id,
                      label: chat.title,
                      meta: 'chat',
                      payload: `Chat reference: ${chat.title}`,
                      type: 'chat'
                    })
                    onClose()
                  }}
                  type="button"
                  variant="menu"
                >
                  <span className="chat-tools-menu-copy">
                    <strong>{chat.title}</strong>
                    <span>{new Date(chat.updatedAt).toLocaleDateString()}</span>
                  </span>
                </TextButton>
              ))
            : null}

          {tab === 'prompts'
            ? filteredPrompts.map((prompt) => (
                <TextButton
                  className="chat-tools-menu-item"
                  key={prompt.id}
                  onClick={() => {
                    onSelect({
                      id: prompt.id,
                      label: prompt.title,
                      meta: prompt.command,
                      payload: `Prompt reference: ${prompt.title}\n${prompt.content.slice(0, 220)}`,
                      type: 'prompt'
                    })
                    onClose()
                  }}
                  type="button"
                  variant="menu"
                >
                  <span className="chat-tools-menu-copy">
                    <strong>{prompt.title}</strong>
                    <span>{prompt.command}</span>
                  </span>
                </TextButton>
              ))
            : null}

          {tab === 'web' ? (
            <div className="chat-tools-menu-web">
              <div className="chat-tools-menu-search">
                <Iconify icon="solar:global-outline" size={15} />
                <input
                  aria-label="Attach webpage"
                  onChange={(event) => setWebUrl(event.target.value)}
                  placeholder="https://example.com"
                  value={webUrl}
                />
              </div>
              <CapsuleButton
                disabled={isUploading || !webUrl.trim()}
                onClick={() => void handleWebpageAttach()}
                size="sm"
                type="button"
                variant="secondary"
              >
                {isUploading ? 'Fetching…' : 'Attach webpage'}
              </CapsuleButton>
            </div>
          ) : null}

          {feedback ? <div className="chat-tools-menu-empty">{feedback}</div> : null}

          {((tab === 'files' && filteredAssets.length === 0) ||
            (tab === 'knowledge' && filteredKnowledge.length === 0) ||
            (tab === 'notes' && filteredNotes.length === 0) ||
            (tab === 'chats' && filteredChats.length === 0) ||
            (tab === 'prompts' && filteredPrompts.length === 0)) ? (
            <div className="chat-tools-menu-empty">No {tab} available for attachment yet.</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
