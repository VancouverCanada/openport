'use client'

import { useEffect, useState } from 'react'
import { replaceProjectKnowledgeSource, loadSession, type OpenPortProjectKnowledgeItem, type OpenPortProjectKnowledgeSource } from '../lib/openport-api'
import { notify } from '../lib/toast'
import { CapsuleButton } from './ui/capsule-button'
import { ModalShell } from './ui/modal-shell'

type WorkspaceKnowledgeSourceReplaceModalProps = {
  item: OpenPortProjectKnowledgeItem | null
  onClose: () => void
  onReplaced: (item: OpenPortProjectKnowledgeItem) => void
  open: boolean
  source: OpenPortProjectKnowledgeSource | null
}

export function WorkspaceKnowledgeSourceReplaceModal({
  item,
  onClose,
  onReplaced,
  open,
  source
}: WorkspaceKnowledgeSourceReplaceModalProps) {
  const [label, setLabel] = useState('')
  const [contentText, setContentText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !item || !source) return
    setLabel(source.label)
    setContentText(item.contentText || item.previewText || '')
  }, [item, open, source])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!item || !source || !contentText.trim()) return
    setSaving(true)
    try {
      const response = await replaceProjectKnowledgeSource(
        item.id,
        source.id,
        {
          contentText,
          label
        },
        loadSession()
      )
      onReplaced(response.item)
      notify('success', 'Source content replaced.')
      onClose()
    } catch (error) {
      notify('error', error instanceof Error && error.message ? error.message : 'Unable to replace source content.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      bodyClassName="workspace-knowledge-modal-body"
      closeLabel="Close source replace dialog"
      dialogClassName="project-dialog workspace-knowledge-modal"
      onClose={onClose}
      open={open}
      title="Replace source"
    >
      <form className="workspace-knowledge-modal-form" onSubmit={(event) => void handleSubmit(event)}>
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
            {saving ? 'Replacing…' : 'Replace source'}
          </CapsuleButton>
          <CapsuleButton onClick={onClose} type="button" variant="secondary">Cancel</CapsuleButton>
        </div>
      </form>
    </ModalShell>
  )
}
