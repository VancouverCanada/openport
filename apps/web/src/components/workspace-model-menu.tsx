'use client'

import type { OpenPortWorkspaceModel } from '../lib/openport-api'
import { WorkspaceResourceMenu, type WorkspaceResourceMenuItem } from './workspace-resource-menu'

type WorkspaceModelMenuProps = {
  canExport: boolean
  canShare: boolean
  canManage: boolean
  item: OpenPortWorkspaceModel
  onAccess?: () => void
  onDelete: () => void
  onExport: () => void
  onMakeDefault: () => void
}

export function WorkspaceModelMenu({
  canExport,
  canShare,
  canManage,
  item,
  onAccess,
  onDelete,
  onExport,
  onMakeDefault
}: WorkspaceModelMenuProps) {
  const items: WorkspaceResourceMenuItem[] = [
    ...(canManage
      ? [
          ...(!item.isDefault
            ? [{ icon: 'solar:star-outline', label: 'Make default', onClick: onMakeDefault }]
            : []),
          { href: `/workspace/models/${item.id}`, icon: 'solar:pen-outline', label: 'Edit' },
          ...(canShare
            ? [
                ...(onAccess ? [{ icon: 'solar:shield-user-outline', label: 'Access', onClick: onAccess }] : [])
              ]
            : []),
          { danger: true, icon: 'solar:trash-bin-trash-outline', label: 'Delete', onClick: onDelete }
        ]
      : []),
    ...(canExport ? [{ icon: 'solar:download-minimalistic-outline', label: 'Export', onClick: onExport }] : [])
  ]

  return <WorkspaceResourceMenu ariaLabel="Open model menu" items={items} />
}
