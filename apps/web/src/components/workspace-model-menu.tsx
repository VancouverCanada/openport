'use client'

import type { OpenPortWorkspaceModel } from '../lib/openport-api'
import { WorkspaceResourceMenu, type WorkspaceResourceMenuItem } from './workspace-resource-menu'

type WorkspaceModelMenuProps = {
  canExport: boolean
  canShare: boolean
  canManage: boolean
  canPromote?: boolean
  item: OpenPortWorkspaceModel
  onDelete: () => void
  onDuplicate: () => void
  onExport: () => void
  onPromote?: () => void
  onShare?: () => void
  working?: boolean
}

export function WorkspaceModelMenu({
  canExport,
  canShare,
  canManage,
  canPromote = false,
  item,
  onDelete,
  onDuplicate,
  onExport,
  onPromote,
  onShare,
  working = false
}: WorkspaceModelMenuProps) {
  const source = item.source === 'runtime' ? 'runtime' : 'managed'
  const isRuntime = source === 'runtime'
  const items: WorkspaceResourceMenuItem[] = [
    ...(canManage && !isRuntime
      ? [
          { href: `/workspace/models/${item.id}`, icon: 'solar:pen-outline', label: 'Edit' },
          ...(canShare && onShare ? [{ icon: 'solar:share-outline', label: 'Share', onClick: onShare }] : []),
          { disabled: working, icon: 'solar:copy-outline', label: 'Clone', onClick: onDuplicate },
          { danger: true, icon: 'solar:trash-bin-trash-outline', label: 'Delete', onClick: onDelete }
        ]
      : []),
    ...(canPromote && isRuntime && onPromote
      ? [{ disabled: working, icon: 'solar:add-circle-outline', label: 'Save as managed', onClick: onPromote }]
      : []),
    ...(canExport ? [{ icon: 'solar:download-minimalistic-outline', label: 'Export', onClick: onExport }] : [])
  ]

  return <WorkspaceResourceMenu ariaLabel="Open model menu" items={items} />
}
