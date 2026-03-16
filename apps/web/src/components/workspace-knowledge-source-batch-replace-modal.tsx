'use client'

import { useEffect, useState } from 'react'
import { maintainProjectKnowledgeSourceBatch, loadSession, type OpenPortProjectKnowledgeSource } from '../lib/openport-api'
import { notify } from '../lib/toast'
import { CapsuleButton } from './ui/capsule-button'
import { ModalShell } from './ui/modal-shell'

type WorkspaceKnowledgeSourceBatchReplaceModalProps = {
  affectedDocumentCount: number
  onClose: () => void
  onReplaced: () => void
  open: boolean
  source: OpenPortProjectKnowledgeSource | null
}

export function WorkspaceKnowledgeSourceBatchReplaceModal({
  affectedDocumentCount,
  onClose,
  onReplaced,
  open,
  source
}: WorkspaceKnowledgeSourceBatchReplaceModalProps) {
  const [label, setLabel] = useState('')
  const [contentText, setContentText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !source) return
    setLabel(source.label)
    setContentText('')
  }, [open, source])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!source || !contentText.trim()) return
    setSaving(true)
    try {
      const response = await maintainProjectKnowledgeSourceBatch(
        source.id,
        {
          action: 'replace',
          contentText,
          label
        },
        loadSession()
      )
      notify('success', `Replaced source across ${response.affectedCount} linked documents.`)
      onReplaced()
      onClose()
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to batch replace source.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      bodyClassName="workspace-knowledge-modal-body"
      closeLabel="Close replace linked sources dialog"
      dialogClassName="project-dialog workspace-knowledge-modal"
      onClose={onClose}
      open={open}
      title="Replace linked source content"
    >
      <form className="workspace-knowledge-modal-form" onSubmit={(event) => void handleSubmit(event)}>
        <p className="project-modal-hint">
          This will replace source content across <strong>{affectedDocumentCount}</strong> linked documents.
        </p>
        <label className="project-modal-field">
          <span>Source label</span>
          <input onChange={(event) => setLabel(event.target.value)} value={label} />
        </label>
        <label className="project-modal-field">
          <span>Replacement content</span>
          <textarea onChange={(event) => setContentText(event.target.value)} rows={14} value={contentText} />
        </label>
        <div className="workspace-inline-actions">
          <CapsuleButton disabled={saving || !contentText.trim()} type="submit" variant="primary">
            {saving ? 'Replacing…' : 'Replace linked'}
          </CapsuleButton>
          <CapsuleButton onClick={onClose} type="button" variant="secondary">Cancel</CapsuleButton>
        </div>
      </form>
    </ModalShell>
  )
}
