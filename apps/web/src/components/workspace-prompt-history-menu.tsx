'use client'

import { downloadJsonFile } from '../lib/workspace-resource-io'
import { notify } from '../lib/toast'
import { WorkspaceResourceMenu, type WorkspaceResourceMenuItem } from './workspace-resource-menu'

type PromptVersion = {
  id: string
  versionLabel: string
  commitMessage?: string
  savedAt: string
  content: string
}

type WorkspacePromptHistoryMenuProps = {
  canDelete: boolean
  isCommunitySubmitted?: boolean
  isProduction: boolean
  isPublished?: boolean
  onPublish?: () => void
  onSubmitCommunity?: () => void
  version: PromptVersion
  onDelete: () => void
  onRestore: () => void
  onSetProduction?: () => void
}

export function WorkspacePromptHistoryMenu({
  canDelete,
  isCommunitySubmitted = false,
  isProduction,
  isPublished = false,
  onPublish,
  onSubmitCommunity,
  version,
  onDelete,
  onRestore,
  onSetProduction
}: WorkspacePromptHistoryMenuProps) {
  async function handleCopyContent(): Promise<void> {
    try {
      await navigator.clipboard.writeText(version.content)
      notify('success', 'Version content copied.')
    } catch {
      notify('error', 'Unable to copy version content.')
    }
  }

  function handleExport(): void {
    downloadJsonFile(`openport-prompt-version-${version.versionLabel}.json`, {
      version
    })
  }

  const items: WorkspaceResourceMenuItem[] = [
    { icon: 'solar:undo-left-outline', label: 'Restore', onClick: onRestore },
    ...(isPublished || !onPublish
      ? []
      : [{ icon: 'solar:cloud-upload-outline', label: 'Publish version', onClick: onPublish }]),
    ...(isCommunitySubmitted || !onSubmitCommunity
      ? []
      : [{ icon: 'solar:share-outline', label: 'Submit to community', onClick: onSubmitCommunity }]),
    ...(isProduction || !onSetProduction
      ? []
      : [{ icon: 'solar:star-outline', label: 'Set production', onClick: onSetProduction }]),
    { icon: 'solar:document-text-outline', label: 'Copy version', onClick: () => void handleCopyContent() },
    { icon: 'solar:download-minimalistic-outline', label: 'Export version', onClick: handleExport },
    ...(canDelete && !isProduction
      ? [{ danger: true, icon: 'solar:trash-bin-trash-outline', label: 'Delete version', onClick: onDelete }]
      : [])
  ]

  return <WorkspaceResourceMenu ariaLabel="Open prompt history menu" items={items} />
}
