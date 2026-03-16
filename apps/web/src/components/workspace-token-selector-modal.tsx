'use client'

import { useEffect, useState } from 'react'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { ModalShell } from './ui/modal-shell'
import { Tag } from './ui/tag'

type WorkspaceTokenSelectorModalProps = {
  description?: string
  onClose: () => void
  onSave: (tokens: string[]) => void
  open: boolean
  selectedTokens: string[]
  suggestedTokens: string[]
  title: string
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

export function WorkspaceTokenSelectorModal({
  description,
  onClose,
  onSave,
  open,
  selectedTokens,
  suggestedTokens,
  title
}: WorkspaceTokenSelectorModalProps) {
  const [draftTokens, setDraftTokens] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [customToken, setCustomToken] = useState('')

  useEffect(() => {
    if (!open) return
    setDraftTokens(selectedTokens)
    setQuery('')
    setCustomToken('')
  }, [open, selectedTokens])

  if (!open) return null

  const visibleSuggestions = suggestedTokens.filter((token) =>
    query.trim() ? token.toLowerCase().includes(query.trim().toLowerCase()) : true
  )

  function toggleToken(token: string): void {
    setDraftTokens((current) =>
      current.includes(token) ? current.filter((entry) => entry !== token) : [...current, token]
    )
  }

  function addCustomToken(): void {
    const token = normalizeToken(customToken)
    if (!token) return
    setDraftTokens((current) => (current.includes(token) ? current : [...current, token]))
    setCustomToken('')
  }

  return (
    <ModalShell
      onClose={onClose}
      open={open}
      title={title}
      footer={
        <>
          <CapsuleButton onClick={() => onSave(draftTokens)} type="button" variant="primary">Apply</CapsuleButton>
          <CapsuleButton onClick={onClose} type="button" variant="secondary">Cancel</CapsuleButton>
        </>
      }
    >
      <div className="workspace-editor-form">
        {description ? <p className="workspace-module-empty">{description}</p> : null}
        <div className="workspace-module-chip-row">
          {draftTokens.map((token) => (
            <Tag key={token}>{token}</Tag>
          ))}
        </div>
        <Field label="Search suggestions">
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Search token" value={query} />
        </Field>
        <Field label="Add custom token">
          <input
            onChange={(event) => setCustomToken(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              addCustomToken()
            }}
            placeholder="custom-token"
            value={customToken}
          />
        </Field>
        <div className="workspace-inline-actions">
          <CapsuleButton onClick={addCustomToken} type="button" variant="secondary">Add token</CapsuleButton>
        </div>
        <div className="workspace-editor-checklist">
          {visibleSuggestions.length === 0 ? (
            <p className="workspace-module-empty">No matching suggestions.</p>
          ) : (
            visibleSuggestions.map((token) => (
              <label key={token} className="workspace-editor-check">
                <input checked={draftTokens.includes(token)} onChange={() => toggleToken(token)} type="checkbox" />
                <span>{token}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </ModalShell>
  )
}
