'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { OpenPortProjectAsset } from '../lib/openport-api'
import {
  createProjectWebAsset,
  deleteProjectAsset,
  fetchProjectAssets,
  loadSession,
  uploadProjectAsset
} from '../lib/openport-api'
import { CapsuleButton } from './ui/capsule-button'
import { FeedbackBanner } from './ui/feedback-banner'
import { IconButton } from './ui/icon-button'
import { ModalShell } from './ui/modal-shell'
import { TextButton } from './ui/text-button'
import { Iconify } from './iconify'

type ChatFilesModalProps = {
  onClose: () => void
  open: boolean
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

const kindOptions: Array<{ label: string; value: 'all' | OpenPortProjectAsset['kind'] }> = [
  { label: 'All assets', value: 'all' },
  { label: 'Files', value: 'chat' },
  { label: 'Webpages', value: 'webpage' },
  { label: 'Knowledge', value: 'knowledge' },
  { label: 'Backgrounds', value: 'background' }
]

export function ChatFilesModal({ onClose, open }: ChatFilesModalProps) {
  const [assets, setAssets] = useState<OpenPortProjectAsset[]>([])
  const [kindFilter, setKindFilter] = useState<'all' | OpenPortProjectAsset['kind']>('all')
  const [feedback, setFeedback] = useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [webUrl, setWebUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function refreshAssets(): Promise<void> {
    const session = loadSession()
    if (!session) return
    setIsLoading(true)
    try {
      const response = await fetchProjectAssets({}, session)
      setAssets(response.items)
    } catch {
      setFeedback({ message: 'Unable to load files.', variant: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setFeedback(null)
    void refreshAssets()
  }, [open])

  const visibleAssets = useMemo(() => {
    const filtered = kindFilter === 'all' ? assets : assets.filter((asset) => asset.kind === kindFilter)
    return [...filtered].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  }, [assets, kindFilter])

  async function handleUpload(file: File | null): Promise<void> {
    if (!file) return
    const session = loadSession()
    if (!session) return
    setIsUploading(true)
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
      setFeedback({ message: `Uploaded ${response.asset.name}.`, variant: 'success' })
    } catch {
      setFeedback({ message: 'Unable to upload file.', variant: 'error' })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleAttachWebpage(): Promise<void> {
    const nextUrl = webUrl.trim()
    if (!nextUrl) return
    const session = loadSession()
    if (!session) return
    setIsUploading(true)
    try {
      const response = await createProjectWebAsset({ url: nextUrl }, session)
      setAssets((current) => [response.asset, ...current.filter((asset) => asset.id !== response.asset.id)])
      setWebUrl('')
      setFeedback({ message: `Fetched ${response.asset.name}.`, variant: 'success' })
    } catch {
      setFeedback({ message: 'Unable to fetch webpage.', variant: 'error' })
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDeleteAsset(asset: OpenPortProjectAsset): Promise<void> {
    const session = loadSession()
    if (!session) return
    try {
      await deleteProjectAsset(asset.id, session)
      setAssets((current) => current.filter((entry) => entry.id !== asset.id))
      setFeedback({ message: `Removed ${asset.name}.`, variant: 'success' })
    } catch {
      setFeedback({ message: 'Unable to remove file.', variant: 'error' })
    }
  }

  if (!open) return null

  return (
    <ModalShell
      closeLabel="Close files"
      dialogClassName="project-dialog chat-files-modal"
      onClose={onClose}
      open={open}
      title="Files"
    >
      <div className="chat-files-layout">
        <div className="chat-files-toolbar">
          <div className="chat-files-filter-row" role="tablist" aria-label="File kinds">
            {kindOptions.map((option) => (
              <TextButton
                active={kindFilter === option.value}
                key={option.value}
                onClick={() => setKindFilter(option.value)}
                size="sm"
                type="button"
                variant="menu"
              >
                <span>{option.label}</span>
              </TextButton>
            ))}
          </div>

          <div className="chat-files-actions">
            <input
              accept="*/*"
              hidden
              onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
              ref={fileInputRef}
              type="file"
            />
            <CapsuleButton
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              type="button"
              variant="secondary"
            >
              {isUploading ? 'Uploading…' : 'Upload file'}
            </CapsuleButton>
          </div>
        </div>

        <div className="chat-files-web-form">
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
            onClick={() => void handleAttachWebpage()}
            size="sm"
            type="button"
            variant="secondary"
          >
            Fetch webpage
          </CapsuleButton>
        </div>

        {feedback ? <FeedbackBanner variant={feedback.variant}>{feedback.message}</FeedbackBanner> : null}

        <div className="chat-files-list">
          {isLoading ? <p className="chat-files-empty">Loading files…</p> : null}
          {!isLoading && visibleAssets.length === 0 ? <p className="chat-files-empty">No files available yet.</p> : null}
          {!isLoading
            ? visibleAssets.map((asset) => (
                <div className="chat-files-item" key={asset.id}>
                  <div className="chat-files-item-copy">
                    <div className="chat-files-item-heading">
                      <strong>{asset.name}</strong>
                      <span>{asset.kind}</span>
                    </div>
                    <span className="chat-files-item-meta">{asset.sourceUrl || asset.contentUrl}</span>
                    {asset.previewText ? <p>{asset.previewText}</p> : null}
                  </div>

                  <div className="chat-files-item-actions">
                    <TextButton external href={asset.contentUrl} rel="noreferrer" target="_blank" variant="menu">
                      <span>Open</span>
                    </TextButton>
                    <IconButton
                      aria-label={`Delete ${asset.name}`}
                      onClick={() => void handleDeleteAsset(asset)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Iconify icon="solar:trash-bin-trash-outline" size={15} />
                    </IconButton>
                  </div>
                </div>
              ))
            : null}
        </div>
      </div>
    </ModalShell>
  )
}
