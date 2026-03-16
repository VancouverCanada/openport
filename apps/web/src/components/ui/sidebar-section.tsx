'use client'

import type { ReactNode } from 'react'

type SidebarSectionProps = {
  actions?: ReactNode
  children?: ReactNode
  className?: string
  title: ReactNode
}

export function SidebarSection({ actions, children, className = '', title }: SidebarSectionProps) {
  return (
    <section className={className}>
      <div className="workspace-sidebar-label-row">
        <div className="workspace-sidebar-label">{title}</div>
        {actions ? <div className="workspace-sidebar-label-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}
