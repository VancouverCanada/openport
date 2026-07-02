'use client'

import type { OpenPortWorkspacePrompt } from '../lib/openport-api'
import { WorkspaceResourceMenu, type WorkspaceResourceMenuItem } from './workspace-resource-menu'

type WorkspacePromptMenuProps = {
  canShare: boolean
  canExport: boolean
  canManage: boolean
  item: OpenPortWorkspacePrompt
  onCopyCommand: () => void
  onCopyContent: () => void
  onDelete: () => void
  onDuplicate: () => void
  onExport: () => void
  onShare?: () => void
  working?: boolean
}

export function WorkspacePromptMenu({
  canShare,
  canExport,
  canManage,
  item,
  onCopyCommand,
  onCopyContent,
  onDelete,
  onDuplicate,
  onExport,
  onShare,
  working = false
}: WorkspacePromptMenuProps) {
  const items: WorkspaceResourceMenuItem[] = [
    ...(canManage
      ? [
          { href: `/workspace/prompts/${item.id}`, icon: 'solar:pen-outline', label: 'Edit' },
          ...(canShare && onShare ? [{ icon: 'solar:share-outline', label: 'Share', onClick: onShare }] : []),
          { disabled: working, icon: 'solar:copy-outline', label: 'Clone', onClick: onDuplicate },
          ...(canExport
            ? [
                { icon: 'solar:download-minimalistic-outline', label: 'Export', onClick: onExport }
              ]
            : []),
          { danger: true, icon: 'solar:trash-bin-trash-outline', label: 'Delete', onClick: onDelete }
        ]
      : []),
    { icon: 'solar:slash-square-outline', label: 'Copy command', onClick: onCopyCommand },
    { icon: 'solar:document-text-outline', label: 'Copy content', onClick: onCopyContent }
  ]

  return <WorkspaceResourceMenu ariaLabel="Open prompt menu" items={items} />
}
