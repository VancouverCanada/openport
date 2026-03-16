'use client'

import type { OpenPortWorkspaceTool } from '../lib/openport-api'
import { WorkspaceResourceMenu, type WorkspaceResourceMenuItem } from './workspace-resource-menu'

type WorkspaceToolMenuProps = {
  canExport: boolean
  canImport: boolean
  canShare: boolean
  canManage: boolean
  item: OpenPortWorkspaceTool
  onAccess?: () => void
  onCopyJson: () => void
  onCopyManifest: () => void
  onCopyPackagePayload: () => void
  onCopyRuntimePayload: () => void
  onDelete: () => void
  onDuplicate: () => void
  onExport: () => void
  onExportPackage: () => void
  onImportPackage: () => void
  working?: boolean
}

export function WorkspaceToolMenu({
  canExport,
  canImport,
  canShare,
  canManage,
  item,
  onAccess,
  onCopyJson,
  onCopyManifest,
  onCopyPackagePayload,
  onCopyRuntimePayload,
  onDelete,
  onDuplicate,
  onExport,
  onExportPackage,
  onImportPackage,
  working = false
}: WorkspaceToolMenuProps) {
  const items: WorkspaceResourceMenuItem[] = [
    ...(canManage
      ? [
          { href: `/workspace/tools/${item.id}`, icon: 'solar:pen-outline', label: 'Edit' },
          ...(canShare
            ? [
                ...(onAccess ? [{ icon: 'solar:shield-user-outline', label: 'Access', onClick: onAccess }] : [])
              ]
            : []),
          { disabled: working, icon: 'solar:copy-outline', label: 'Clone', onClick: onDuplicate },
          { danger: true, icon: 'solar:trash-bin-trash-outline', label: 'Delete', onClick: onDelete }
        ]
      : []),
    ...(canExport
      ? [
          { icon: 'solar:download-minimalistic-outline', label: 'Export', onClick: onExport },
          { icon: 'solar:download-minimalistic-outline', label: 'Export package', onClick: onExportPackage }
        ]
      : []),
    ...(canImport ? [{ icon: 'solar:upload-minimalistic-outline', label: 'Import package', onClick: onImportPackage }] : []),
    { icon: 'solar:document-text-outline', label: 'Copy manifest', onClick: onCopyManifest },
    { icon: 'solar:copy-outline', label: 'Copy JSON', onClick: onCopyJson },
    { icon: 'solar:archive-outline', label: 'Copy package', onClick: onCopyPackagePayload },
    { icon: 'solar:code-file-outline', label: 'Copy payload', onClick: onCopyRuntimePayload }
  ]

  return <WorkspaceResourceMenu ariaLabel="Open tool menu" items={items} />
}
