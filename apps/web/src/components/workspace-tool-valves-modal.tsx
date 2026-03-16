'use client'

import type { OpenPortWorkspaceToolValveSchemaField } from '../lib/openport-api'
import { CapsuleButton } from './ui/capsule-button'
import { ModalShell } from './ui/modal-shell'
import { ResourceCardCopy, ResourceCardHeading } from './ui/resource-card'
import { TextButton } from './ui/text-button'

type WorkspaceToolValvesModalProps = {
  onAddSchemaField: () => void
  onAddValve: () => void
  onClose: () => void
  onRemoveSchemaField: (id: string) => void
  onRemoveValve: (id: string) => void
  onUpdateSchemaField: (id: string, patch: Partial<OpenPortWorkspaceToolValveSchemaField>) => void
  onUpdateValve: (id: string, patch: Partial<{ key: string; value: string }>) => void
  open: boolean
  schemaFieldCount: number
  valveCount: number
  valveSchema: OpenPortWorkspaceToolValveSchemaField[]
  valves: Array<{ id: string; key: string; value: string }>
}

export function WorkspaceToolValvesModal({
  onAddSchemaField,
  onAddValve,
  onClose,
  onRemoveSchemaField,
  onRemoveValve,
  onUpdateSchemaField,
  onUpdateValve,
  open,
  schemaFieldCount,
  valveCount,
  valveSchema,
  valves
}: WorkspaceToolValvesModalProps) {
  return (
    <ModalShell
      bodyClassName="workspace-tool-modal-body"
      closeLabel="Close valves editor"
      dialogClassName="project-dialog workspace-tool-modal workspace-tool-modal--wide"
      onClose={onClose}
      open={open}
      title="Valves"
    >
      <div className="workspace-tool-modal-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Runtime valves</strong></ResourceCardHeading>
          <span>Keep runtime defaults structured, separate from manifest metadata.</span>
        </ResourceCardCopy>
        <div className="workspace-tool-modal-summary">
          <div><strong>{valveCount}</strong><span>Values</span></div>
          <div><strong>{schemaFieldCount}</strong><span>Schema fields</span></div>
        </div>
      </div>

      <section className="workspace-tool-modal-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Values</strong></ResourceCardHeading>
          <span>Runtime defaults passed into the tool implementation.</span>
        </ResourceCardCopy>
        <div className="workspace-valve-list">
          {valves.map((valve) => (
            <div key={valve.id} className="workspace-valve-row">
              <input
                onChange={(event) => onUpdateValve(valve.id, { key: event.target.value })}
                placeholder="key"
                value={valve.key}
              />
              <input
                onChange={(event) => onUpdateValve(valve.id, { value: event.target.value })}
                placeholder="value"
                value={valve.value}
              />
              <TextButton danger onClick={() => onRemoveValve(valve.id)} type="button" variant="link">Remove</TextButton>
            </div>
          ))}
        </div>
        <div className="workspace-editor-actions">
          <CapsuleButton onClick={onAddValve} type="button" variant="secondary">Add valve</CapsuleButton>
        </div>
      </section>

      <section className="workspace-tool-modal-section">
        <ResourceCardCopy className="workspace-editor-section-heading">
          <ResourceCardHeading><strong>Schema</strong></ResourceCardHeading>
          <span>Describe configurable valves separately from runtime values.</span>
        </ResourceCardCopy>
        <div className="workspace-valve-list">
          {valveSchema.map((field) => (
            <div key={field.id} className="workspace-valve-schema-row">
              <input
                onChange={(event) => onUpdateSchemaField(field.id, { key: event.target.value })}
                placeholder="key"
                value={field.key}
              />
              <input
                onChange={(event) => onUpdateSchemaField(field.id, { label: event.target.value })}
                placeholder="label"
                value={field.label}
              />
              <select
                onChange={(event) =>
                  onUpdateSchemaField(field.id, {
                    type: event.target.value as OpenPortWorkspaceToolValveSchemaField['type']
                  })
                }
                value={field.type}
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="json">JSON</option>
              </select>
              <input
                onChange={(event) => onUpdateSchemaField(field.id, { defaultValue: event.target.value })}
                placeholder="default"
                value={field.defaultValue}
              />
              <label className="workspace-editor-checkbox">
                <input
                  checked={field.required}
                  onChange={(event) => onUpdateSchemaField(field.id, { required: event.target.checked })}
                  type="checkbox"
                />
                <span>Required</span>
              </label>
              <input
                onChange={(event) => onUpdateSchemaField(field.id, { description: event.target.value })}
                placeholder="description"
                value={field.description}
              />
              <TextButton danger onClick={() => onRemoveSchemaField(field.id)} type="button" variant="link">Remove</TextButton>
            </div>
          ))}
        </div>
        <div className="workspace-editor-actions">
          <CapsuleButton onClick={onAddSchemaField} type="button" variant="secondary">Add schema field</CapsuleButton>
        </div>
      </section>
    </ModalShell>
  )
}
