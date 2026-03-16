'use client'

import { useEffect, useMemo, useState } from 'react'
import { CapsuleButton } from './ui/capsule-button'
import { Field } from './ui/field'
import { ModalShell } from './ui/modal-shell'
import { Tag } from './ui/tag'

export type WorkspaceResourceSelectorPermission = 'none' | 'read' | 'write' | 'admin'

export type WorkspaceResourceSelectorItem = {
  id: string
  name: string
  description?: string
  metadata?: string[]
  permission: WorkspaceResourceSelectorPermission
}

type WorkspaceResourceSelectorModalProps = {
  description?: string
  emptyText?: string
  items: WorkspaceResourceSelectorItem[]
  onClose: () => void
  onSave: (selectedIds: string[]) => void
  open: boolean
  selectedIds: string[]
  title: string
}

type PermissionFilter = 'all' | 'read' | 'write' | 'admin'

function rankPermission(permission: WorkspaceResourceSelectorPermission): number {
  if (permission === 'admin') return 3
  if (permission === 'write') return 2
  if (permission === 'read') return 1
  return 0
}

function permissionMatches(permission: WorkspaceResourceSelectorPermission, filter: PermissionFilter): boolean {
  if (filter === 'all') return true
  return rankPermission(permission) >= rankPermission(filter)
}

export function WorkspaceResourceSelectorModal({
  description,
  emptyText = 'No matching resources.',
  items,
  onClose,
  onSave,
  open,
  selectedIds,
  title
}: WorkspaceResourceSelectorModalProps) {
  const [draftIds, setDraftIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [permissionFilter, setPermissionFilter] = useState<PermissionFilter>('all')

  useEffect(() => {
    if (!open) return
    setDraftIds(selectedIds)
    setQuery('')
    setPermissionFilter('all')
  }, [open, selectedIds])

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return [...items]
      .filter((item) => permissionMatches(item.permission, permissionFilter))
      .filter((item) => {
        if (!normalizedQuery) return true
        return [item.name, item.description || '', ...(item.metadata || [])]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [items, permissionFilter, query])

  if (!open) return null

  function toggle(id: string): void {
    setDraftIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }

  return (
    <ModalShell
      onClose={onClose}
      open={open}
      title={title}
      footer={
        <>
          <CapsuleButton onClick={() => onSave(draftIds)} type="button" variant="primary">Apply</CapsuleButton>
          <CapsuleButton onClick={onClose} type="button" variant="secondary">Cancel</CapsuleButton>
        </>
      }
    >
      <div className="workspace-editor-form">
        {description ? <p className="workspace-module-empty">{description}</p> : null}
        <div className="workspace-module-chip-row">
          <Tag>{draftIds.length} selected</Tag>
          <Tag>{visibleItems.length} visible</Tag>
        </div>
        <div className="workspace-resource-filters">
          <Field label="Search resources">
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Name, metadata" value={query} />
          </Field>
          <Field label="Minimum permission">
            <select onChange={(event) => setPermissionFilter(event.target.value as PermissionFilter)} value={permissionFilter}>
              <option value="all">All</option>
              <option value="read">Read+</option>
              <option value="write">Write+</option>
              <option value="admin">Admin only</option>
            </select>
          </Field>
        </div>
        <div className="workspace-resource-list">
          {visibleItems.length === 0 ? (
            <p className="workspace-module-empty">{emptyText}</p>
          ) : (
            visibleItems.map((item) => {
              const checked = draftIds.includes(item.id)
              const disabled = item.permission === 'none'
              return (
                <label key={item.id} className={`workspace-resource-selector-row${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}>
                  <input checked={checked} disabled={disabled} onChange={() => toggle(item.id)} type="checkbox" />
                  <div className="workspace-resource-selector-copy">
                    <div className="workspace-resource-selector-heading">
                      <strong>{item.name}</strong>
                      <Tag>{item.permission}</Tag>
                    </div>
                    {item.description ? <p>{item.description}</p> : null}
                    {item.metadata && item.metadata.length > 0 ? (
                      <div className="workspace-module-chip-row">
                        {item.metadata.map((meta, index) => (
                          <Tag key={`${item.id}-meta-${index}`}>{meta}</Tag>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </label>
              )
            })
          )}
        </div>
        {draftIds.length > 0 ? (
          <div className="workspace-module-chip-row">
            {draftIds.map((id) => (
              <Tag key={id}>{itemsById.get(id)?.name || id}</Tag>
            ))}
          </div>
        ) : null}
      </div>
    </ModalShell>
  )
}

