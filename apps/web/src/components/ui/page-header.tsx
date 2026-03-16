'use client'

import type { ReactNode } from 'react'

type PageHeaderProps = {
  actions?: ReactNode
  className?: string
  description?: ReactNode
  label?: ReactNode
  title: ReactNode
}

export function PageHeader({ actions, className = '', description, label, title }: PageHeaderProps) {
  return (
    <header className={`workspace-resource-header${className ? ` ${className}` : ''}`}>
      <div>
        {label ? <span className="dashboard-section-label">{label}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="workspace-resource-header-actions">{actions}</div> : null}
    </header>
  )
}
