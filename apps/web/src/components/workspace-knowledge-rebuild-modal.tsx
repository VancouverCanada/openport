'use client'

import { useEffect, useState } from 'react'
import type { OpenPortKnowledgeChunkingOptions } from '../lib/openport-api'
import { CapsuleButton } from './ui/capsule-button'
import { ModalShell } from './ui/modal-shell'

type WorkspaceKnowledgeRebuildModalProps = {
  description: string
  onClose: () => void
  onSubmit: (options: OpenPortKnowledgeChunkingOptions) => Promise<void> | void
  open: boolean
  submitting: boolean
  title: string
}

const DEFAULT_OPTIONS: OpenPortKnowledgeChunkingOptions = {
  strategy: 'balanced',
  chunkSize: 600,
  overlap: 120,
  maxChunks: 50
}

export function WorkspaceKnowledgeRebuildModal({
  description,
  onClose,
  onSubmit,
  open,
  submitting,
  title
}: WorkspaceKnowledgeRebuildModalProps) {
  const [options, setOptions] = useState<OpenPortKnowledgeChunkingOptions>(DEFAULT_OPTIONS)

  useEffect(() => {
    if (!open) return
    setOptions(DEFAULT_OPTIONS)
  }, [open])

  return (
    <ModalShell
      bodyClassName="workspace-knowledge-modal-body"
      closeLabel="Close rebuild modal"
      dialogClassName="project-dialog workspace-knowledge-modal"
      onClose={onClose}
      open={open}
      title={title}
    >
      <form
        className="workspace-knowledge-modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit(options)
        }}
      >
        <p className="project-modal-hint">{description}</p>
        <label className="project-modal-field">
          <span>Strategy</span>
          <select
            onChange={(event) =>
              setOptions((current) => ({
                ...current,
                strategy: event.target.value as OpenPortKnowledgeChunkingOptions['strategy']
              }))
            }
            value={options.strategy}
          >
            <option value="balanced">Balanced</option>
            <option value="dense">Dense</option>
            <option value="sparse">Sparse</option>
            <option value="semantic">Semantic</option>
          </select>
        </label>
        <label className="project-modal-field">
          <span>Chunk size</span>
          <input
            min={120}
            onChange={(event) =>
              setOptions((current) => ({
                ...current,
                chunkSize: Number(event.target.value || 600)
              }))
            }
            type="number"
            value={options.chunkSize}
          />
        </label>
        <label className="project-modal-field">
          <span>Overlap</span>
          <input
            min={0}
            onChange={(event) =>
              setOptions((current) => ({
                ...current,
                overlap: Number(event.target.value || 0)
              }))
            }
            type="number"
            value={options.overlap}
          />
        </label>
        <label className="project-modal-field">
          <span>Max chunks</span>
          <input
            min={1}
            onChange={(event) =>
              setOptions((current) => ({
                ...current,
                maxChunks: Number(event.target.value || 1)
              }))
            }
            type="number"
            value={options.maxChunks}
          />
        </label>
        <div className="workspace-inline-actions">
          <CapsuleButton disabled={submitting} type="submit" variant="primary">
            {submitting ? 'Rebuilding…' : 'Run rebuild'}
          </CapsuleButton>
          <CapsuleButton onClick={onClose} type="button" variant="secondary">Cancel</CapsuleButton>
        </div>
      </form>
    </ModalShell>
  )
}
