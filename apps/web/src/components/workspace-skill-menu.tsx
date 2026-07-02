'use client'

import type { OpenPortWorkspaceSkill } from '../lib/openport-api'
import { WorkspaceResourceMenu, type WorkspaceResourceMenuItem } from './workspace-resource-menu'

type WorkspaceSkillMenuProps = {
  canExport: boolean
  canManage: boolean
  item: OpenPortWorkspaceSkill
  onDelete: () => void
  onDuplicate: () => void
  onExport: () => void
}

export function WorkspaceSkillMenu({
  canExport,
  canManage,
  item,
  onDelete,
  onDuplicate,
  onExport
}: WorkspaceSkillMenuProps) {
  const items: WorkspaceResourceMenuItem[] = [
    ...(canManage
      ? [
          { href: `/workspace/skills/${item.id}`, icon: 'solar:pen-outline', label: 'Edit' },
          { icon: 'solar:copy-outline', label: 'Clone', onClick: onDuplicate },
          { danger: true, icon: 'solar:trash-bin-trash-outline', label: 'Delete', onClick: onDelete }
        ]
      : []),
    ...(canExport ? [{ icon: 'solar:download-minimalistic-outline', label: 'Export', onClick: onExport }] : [])
  ]

  return <WorkspaceResourceMenu ariaLabel="Open skill menu" items={items} />
}
