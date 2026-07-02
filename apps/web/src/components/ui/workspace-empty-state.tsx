'use client'

import { Iconify } from '../iconify'

type WorkspaceEmptyStateProps = {
  description?: string
  icon?: string
  title: string
}

export function WorkspaceEmptyState({
  description = 'Try adjusting your search or filters.',
  icon = 'solar:notebook-outline',
  title
}: WorkspaceEmptyStateProps) {
  return (
    <div className="workspace-empty-state">
      <Iconify icon={icon} size={24} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}
