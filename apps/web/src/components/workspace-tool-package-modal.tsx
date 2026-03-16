'use client'

import { useEffect, useState } from 'react'
import { CapsuleButton } from './ui/capsule-button'
import { FeedbackBanner } from './ui/feedback-banner'
import { ModalShell } from './ui/modal-shell'

type WorkspaceToolPackageModalProps = {
  defaultTargetToolId?: string
  onClose: () => void
  onSubmit: (input: {
    packagePayload: Record<string, unknown>
    targetToolId?: string
    forceEnable?: boolean
  }) => Promise<void>
  open: boolean
  tools: Array<{ id: string; name: string }>
}

export function WorkspaceToolPackageModal({
  defaultTargetToolId,
  onClose,
  onSubmit,
  open,
  tools
}: WorkspaceToolPackageModalProps) {
  const [payloadText, setPayloadText] = useState('')
  const [targetToolId, setTargetToolId] = useState('')
  const [forceEnable, setForceEnable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTargetToolId(defaultTargetToolId || '')
    setForceEnable(false)
    setError(null)
  }, [defaultTargetToolId, open])

  async function handleImport(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      const parsed = JSON.parse(payloadText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Package payload must be a JSON object.')
        return
      }
      await onSubmit({
        packagePayload: parsed as Record<string, unknown>,
        targetToolId: targetToolId || undefined,
        forceEnable
      })
      setPayloadText('')
      onClose()
    } catch {
      setError('Unable to parse or import package payload.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePaste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText()
      setPayloadText(text)
      setError(null)
    } catch {
      setError('Unable to read clipboard.')
    }
  }

  return (
    <ModalShell
      bodyClassName="workspace-tool-modal-body"
      closeLabel="Close package import"
      dialogClassName="project-dialog workspace-tool-modal workspace-tool-modal--wide"
      onClose={onClose}
      open={open}
      title="Import tool package"
    >
      {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
      <label className="project-modal-field">
        <span>Target tool</span>
        <select onChange={(event) => setTargetToolId(event.target.value)} value={targetToolId}>
          <option value="">Create as new tool</option>
          {tools.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.name}
            </option>
          ))}
        </select>
      </label>
      <label className="workspace-editor-checkbox">
        <input checked={forceEnable} onChange={(event) => setForceEnable(event.target.checked)} type="checkbox" />
        <span>Force enable on import</span>
      </label>
      <label className="project-modal-field">
        <span>Package JSON</span>
        <textarea onChange={(event) => setPayloadText(event.target.value)} rows={14} value={payloadText} />
      </label>
      <div className="workspace-inline-actions">
        <CapsuleButton onClick={() => void handlePaste()} type="button" variant="secondary">Paste from clipboard</CapsuleButton>
        <CapsuleButton disabled={saving || !payloadText.trim()} onClick={() => void handleImport()} type="button" variant="primary">
          {saving ? 'Importing…' : 'Import package'}
        </CapsuleButton>
      </div>
    </ModalShell>
  )
}
