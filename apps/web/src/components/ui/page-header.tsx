'use client'

import type { ReactNode } from 'react'

type PageHeaderProps = {
  actions?: ReactNode
  className?: string
  description?: ReactNode
  label?: ReactNode
  title: ReactNode
}

export function PageHeader({ actions, className = '', title }: PageHeaderProps) {
  return (
    <header className={`workspace-resource-header${className ? ` ${className}` : ''}`}>
      <div>
        <h1>{title}</h1>
      </div>
      {actions ? <div className="workspace-resource-header-actions">{actions}</div> : null}
    </header>
  )
}
