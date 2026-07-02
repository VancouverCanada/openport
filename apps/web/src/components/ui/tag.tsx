'use client'

import type { ReactNode } from 'react'

type TagProps = {
  children: ReactNode
  className?: string
  variant?: 'outline' | 'solid'
}

export function Tag({ children, className = '', variant = 'outline' }: TagProps) {
  return (
    <span className={`chat-thread-tag${variant === 'solid' ? ' chat-thread-tag--solid' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  )
}
