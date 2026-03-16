'use client'

import type { ReactNode } from 'react'

type TagProps = {
  children: ReactNode
  className?: string
}

export function Tag({ children, className = '' }: TagProps) {
  return <span className={`chat-thread-tag${className ? ` ${className}` : ''}`}>{children}</span>
}
