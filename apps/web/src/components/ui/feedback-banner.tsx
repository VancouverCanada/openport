'use client'

import type { ReactNode } from 'react'

type FeedbackBannerProps = {
  children: ReactNode
  className?: string
  variant?: 'error' | 'success' | 'warning' | 'info'
}

export function FeedbackBanner({ children, className = '', variant = 'info' }: FeedbackBannerProps) {
  return <p className={`feedback-banner ${variant}${className ? ` ${className}` : ''}`.trim()}>{children}</p>
}
