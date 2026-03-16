'use client'

import type { OpenPortWorkspacePrompt } from '../lib/openport-api'
import { WorkspaceResourceMenu, type WorkspaceResourceMenuItem } from './workspace-resource-menu'

type WorkspacePromptMenuProps = {
  canAccess: boolean
  canExport: boolean
  canPublish: boolean
  canManage: boolean
  item: OpenPortWorkspacePrompt
  onAccess?: () => void
  onCopyCommand: () => void
  onCopyContent: () => void
  onCopyPayload: () => void
  onDelete: () => void
  onDuplicate: () => void
  onExport: () => void
  onPublish?: () => void
  onRetractCommunity?: () => void
  onShare?: () => void
  onSubmitCommunity?: () => void
  onUnpublish?: () => void
  working?: boolean
}

export function WorkspacePromptMenu({
  canAccess,
  canExport,
  canPublish,
  canManage,
  item,
  onAccess,
  onCopyCommand,
  onCopyContent,
  onCopyPayload,
  onDelete,
  onDuplicate,
  onExport,
  onPublish,
  onRetractCommunity,
  onShare,
  onSubmitCommunity,
  onUnpublish,
  working = false
}: WorkspacePromptMenuProps) {
  const items: WorkspaceResourceMenuItem[] = [
    ...(canManage
      ? [
          { href: `/workspace/prompts/${item.id}`, icon: 'solar:pen-outline', label: 'Edit' },
          ...(canAccess
            ? [
                ...(onAccess ? [{ icon: 'solar:shield-user-outline', label: 'Access', onClick: onAccess }] : [])
              ]
            : []),
          { disabled: working, icon: 'solar:copy-outline', label: 'Clone', onClick: onDuplicate },
          ...(canPublish
            ? item.publishedVersionId
              ? [{ icon: 'solar:cloud-cross-outline', label: 'Unpublish', onClick: onUnpublish }]
              : [{ icon: 'solar:cloud-upload-outline', label: 'Publish', onClick: onPublish }]
            : []),
          ...(canPublish
            ? item.communityStatus === 'submitted'
              ? [{ icon: 'solar:cloud-cross-outline', label: 'Retract community', onClick: onRetractCommunity }]
              : [{ icon: 'solar:cloud-upload-outline', label: 'Submit to community', onClick: onSubmitCommunity }]
            : []),
          ...(canPublish && onShare ? [{ icon: 'solar:share-outline', label: 'Share', onClick: onShare }] : []),
          ...(canExport
            ? [
                { icon: 'solar:document-text-outline', label: 'Copy payload', onClick: onCopyPayload },
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
