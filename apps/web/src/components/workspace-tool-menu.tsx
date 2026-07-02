'use client'

import type { OpenPortWorkspaceTool } from '../lib/openport-api'
import { WorkspaceResourceMenu, type WorkspaceResourceMenuItem } from './workspace-resource-menu'

type WorkspaceToolMenuProps = {
  canExport: boolean
  canShare: boolean
  canManage: boolean
  item: OpenPortWorkspaceTool
  onCopyJson: () => void
  onCopyManifest: () => void
  onDelete: () => void
  onDuplicate: () => void
  onExport: () => void
  onShare?: () => void
  working?: boolean
}

export function WorkspaceToolMenu({
  canExport,
  canShare,
  canManage,
  item,
  onCopyJson,
  onCopyManifest,
  onDelete,
  onDuplicate,
  onExport,
  onShare,
  working = false
}: WorkspaceToolMenuProps) {
  const items: WorkspaceResourceMenuItem[] = [
    ...(canManage
      ? [
          { href: `/workspace/tools/${item.id}`, icon: 'solar:pen-outline', label: 'Edit' },
          ...(canShare && onShare ? [{ icon: 'solar:share-outline', label: 'Share', onClick: onShare }] : []),
          { disabled: working, icon: 'solar:copy-outline', label: 'Clone', onClick: onDuplicate },
          { danger: true, icon: 'solar:trash-bin-trash-outline', label: 'Delete', onClick: onDelete }
        ]
      : []),
    ...(canExport
      ? [
          { icon: 'solar:download-minimalistic-outline', label: 'Export', onClick: onExport }
        ]
      : []),
    { icon: 'solar:document-text-outline', label: 'Copy manifest', onClick: onCopyManifest },
    { icon: 'solar:copy-outline', label: 'Copy JSON', onClick: onCopyJson }
  ]

  return <WorkspaceResourceMenu ariaLabel="Open tool menu" items={items} />
}
