'use client'

import { useEffect, useState } from 'react'
import type { OpenPortKnowledgeChunkingOptions } from '../lib/openport-api'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { ModalShell } from './ui/modal-shell'
import { Tag } from './ui/tag'

type SourceRecord = {
  id: string
  label: string
  kind: string
  source: string
  size: number
  documents: number
}

type WorkspaceKnowledgeSourceLifecycleModalProps = {
  busy: boolean
  onClose: () => void
  onRunAction: (
    action: 'reindex' | 'reset' | 'remove' | 'rebuild' | 'replace',
    input?: Partial<OpenPortKnowledgeChunkingOptions> & { contentText?: string; label?: string }
  ) => void
  open: boolean
  source: SourceRecord | null
}

function formatBytes(size: number): string {
  if (size <= 0) return '0 KB'
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

export function WorkspaceKnowledgeSourceLifecycleModal({
  busy,
  onClose,
  onRunAction,
  open,
  source
}: WorkspaceKnowledgeSourceLifecycleModalProps) {
  const [strategy, setStrategy] = useState<OpenPortKnowledgeChunkingOptions['strategy']>('balanced')
  const [chunkSize, setChunkSize] = useState(600)
  const [overlap, setOverlap] = useState(120)
  const [maxChunks, setMaxChunks] = useState(50)
  const [replaceLabel, setReplaceLabel] = useState('')
  const [replaceContent, setReplaceContent] = useState('')

  useEffect(() => {
    if (!open || !source) return
    setReplaceLabel(source.label)
    setReplaceContent('')
    setStrategy('balanced')
    setChunkSize(600)
    setOverlap(120)
    setMaxChunks(50)
  }, [open, source])

  if (!open || !source) return null

  return (
    <ModalShell
      onClose={onClose}
      open={open}
      title={`Source lifecycle · ${source.label}`}
      footer={
        <>
          <CapsuleButton onClick={onClose} type="button" variant="secondary">Close</CapsuleButton>
        </>
      }
    >
      <div className="workspace-editor-form">
        <div className="workspace-module-chip-row">
          <Tag>{source.documents} docs</Tag>
          <Tag>{source.kind}</Tag>
          <Tag>{source.source}</Tag>
          <Tag>{formatBytes(source.size)}</Tag>
        </div>

        <section className="workspace-editor-section">
          <div className="workspace-editor-section-heading">
            <strong>Lifecycle actions</strong>
            <span>Apply batch maintenance operations to all linked documents.</span>
          </div>
          <div className="workspace-inline-actions">
            <CapsuleButton disabled={busy} onClick={() => onRunAction('reindex')} type="button" variant="secondary">
              {busy ? 'Running…' : 'Re-index linked'}
            </CapsuleButton>
            <CapsuleButton disabled={busy} onClick={() => onRunAction('reset')} type="button" variant="secondary">
              {busy ? 'Running…' : 'Reset linked'}
            </CapsuleButton>
            <CapsuleButton disabled={busy} onClick={() => onRunAction('remove')} type="button" variant="secondary">
              {busy ? 'Running…' : 'Remove linked'}
            </CapsuleButton>
          </div>
        </section>

        <section className="workspace-editor-section">
          <div className="workspace-editor-section-heading">
            <strong>Rebuild linked chunks</strong>
            <span>Run chunk strategy updates for all documents currently attached to this source.</span>
          </div>
          <div className="workspace-resource-filters">
            <Field label="Strategy">
              <select onChange={(event) => setStrategy(event.target.value as OpenPortKnowledgeChunkingOptions['strategy'])} value={strategy}>
                <option value="balanced">Balanced</option>
                <option value="dense">Dense</option>
                <option value="sparse">Sparse</option>
                <option value="semantic">Semantic</option>
              </select>
            </Field>
            <Field label="Chunk size">
              <input max={2400} min={120} onChange={(event) => setChunkSize(Number(event.target.value) || 600)} type="number" value={chunkSize} />
            </Field>
            <Field label="Overlap">
              <input max={1200} min={0} onChange={(event) => setOverlap(Number(event.target.value) || 0)} type="number" value={overlap} />
            </Field>
            <Field label="Max chunks">
              <input max={300} min={1} onChange={(event) => setMaxChunks(Number(event.target.value) || 1)} type="number" value={maxChunks} />
            </Field>
          </div>
          <div className="workspace-inline-actions">
            <CapsuleButton
              disabled={busy}
              onClick={() =>
                onRunAction('rebuild', {
                  strategy,
                  chunkSize,
                  overlap,
                  maxChunks
                })
              }
              type="button"
              variant="secondary"
            >
              {busy ? 'Running…' : 'Rebuild linked'}
            </CapsuleButton>
          </div>
        </section>

        <section className="workspace-editor-section">
          <div className="workspace-editor-section-heading">
            <strong>Replace source content</strong>
            <span>Replace the source payload for all linked documents in one operation.</span>
          </div>
          <Field label="Source label">
            <input onChange={(event) => setReplaceLabel(event.target.value)} value={replaceLabel} />
          </Field>
          <Field label="Replacement content">
            <textarea onChange={(event) => setReplaceContent(event.target.value)} placeholder="Paste replacement source text…" rows={8} value={replaceContent} />
          </Field>
          <div className="workspace-inline-actions">
            <CapsuleButton
              disabled={busy || !replaceContent.trim()}
              onClick={() =>
                onRunAction('replace', {
                  label: replaceLabel.trim() || undefined,
                  contentText: replaceContent
                })
              }
              type="button"
              variant="secondary"
            >
              {busy ? 'Running…' : 'Replace linked source'}
            </CapsuleButton>
          </div>
        </section>
      </div>
    </ModalShell>
  )
}

