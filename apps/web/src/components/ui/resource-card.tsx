'use client'

import type { ReactNode } from 'react'

type ResourceCardProps = {
  actions?: ReactNode
  children?: ReactNode
  className?: string
  copy?: ReactNode
  stacked?: boolean
}

type ResourceCardHeadingProps = {
  children: ReactNode
  className?: string
}

type ResourceCardCopyProps = {
  children: ReactNode
  className?: string
}

type ResourceCardActionsProps = {
  children: ReactNode
  className?: string
}

export function ResourceCard({ actions, children, className = '', copy, stacked = false }: ResourceCardProps) {
  return (
    <article className={`workspace-resource-card${stacked ? ' workspace-resource-card--stack' : ''}${className ? ` ${className}` : ''}`}>
      {copy ? <div className="workspace-resource-card-copy">{copy}</div> : children}
      {actions ? <div className="workspace-resource-card-actions">{actions}</div> : null}
    </article>
  )
}

export function ResourceCardCopy({ children, className = '' }: ResourceCardCopyProps) {
  return <div className={`workspace-resource-card-copy${className ? ` ${className}` : ''}`}>{children}</div>
}

export function ResourceCardHeading({ children, className = '' }: ResourceCardHeadingProps) {
  return <div className={`workspace-resource-card-heading${className ? ` ${className}` : ''}`}>{children}</div>
}

export function ResourceCardActions({ children, className = '' }: ResourceCardActionsProps) {
  return <div className={`workspace-resource-card-actions${className ? ` ${className}` : ''}`}>{children}</div>
}
