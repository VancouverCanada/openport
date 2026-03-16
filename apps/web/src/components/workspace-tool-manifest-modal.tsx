'use client'

import { CapsuleButton } from './ui/capsule-button'
import { ModalShell } from './ui/modal-shell'
import { ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { Tag } from './ui/tag'

type WorkspaceToolManifestModalProps = {
  manifest: string
  manifestSummary: {
    entry: string
    name: string
  }
  onApplyTemplate: (template: 'http' | 'policy' | 'retrieval') => void
  onChange: (value: string) => void
  onClose: () => void
  open: boolean
}

export function WorkspaceToolManifestModal({
  manifest,
  manifestSummary,
  onApplyTemplate,
  onChange,
  onClose,
  open
}: WorkspaceToolManifestModalProps) {
  return (
    <ModalShell
      bodyClassName="workspace-tool-modal-body"
      closeLabel="Close manifest editor"
      dialogClassName="project-dialog workspace-tool-modal"
      onClose={onClose}
      open={open}
      title="Manifest"
    >
      <div className="workspace-tool-modal-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Manifest templates</strong></ResourceCardHeading>
          <span>Start from a common toolkit shape, then refine the manifest before saving.</span>
        </ResourceCardCopy>
        <div className="workspace-inline-actions">
          <CapsuleButton onClick={() => onApplyTemplate('http')} type="button" variant="secondary">HTTP</CapsuleButton>
          <CapsuleButton onClick={() => onApplyTemplate('policy')} type="button" variant="secondary">Policy</CapsuleButton>
          <CapsuleButton onClick={() => onApplyTemplate('retrieval')} type="button" variant="secondary">Retrieval</CapsuleButton>
        </div>
        <div className="workspace-module-chip-row">
          <Tag>{manifestSummary.name}</Tag>
          <Tag>{manifestSummary.entry}</Tag>
        </div>
      </div>
      <label className="project-modal-field">
        <span>Manifest body</span>
        <textarea onChange={(event) => onChange(event.target.value)} rows={18} value={manifest} />
      </label>
    </ModalShell>
  )
}
