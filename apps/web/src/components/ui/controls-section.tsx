'use client'

import type { ReactNode } from 'react'
import { Iconify } from '../iconify'
import { TextButton } from './text-button'

type ControlsSectionProps = {
  children?: ReactNode
  icon: string
  open: boolean
  onToggle: () => void
  title: ReactNode
}

export function ControlsSection({ children, icon, onToggle, open, title }: ControlsSectionProps) {
  return (
    <section className={`chat-controls-section${open ? ' is-open' : ''}`}>
      <TextButton className="chat-controls-toggle" onClick={onToggle} size="md" type="button" variant="panel">
        <span className="chat-controls-toggle-copy">
          <Iconify icon={icon} size={16} />
          <span>{title}</span>
        </span>
        <Iconify icon={open ? 'solar:alt-arrow-up-outline' : 'solar:alt-arrow-down-outline'} size={16} />
      </TextButton>
      <div aria-hidden={!open} className="chat-controls-section-body">
        <div className="chat-controls-section-body-inner">{children}</div>
      </div>
    </section>
  )
}
