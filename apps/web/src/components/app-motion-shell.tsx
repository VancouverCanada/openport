'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { MotionLazy, ScrollProgress } from './animate'

type AppMotionShellProps = {
  children: ReactNode
}

export function AppMotionShell({ children }: AppMotionShellProps) {
  const pathname = usePathname()
  const showProgress = pathname !== '/' && !pathname.startsWith('/auth')

  return (
    <MotionLazy>
      {showProgress ? <ScrollProgress /> : null}
      {children}
    </MotionLazy>
  )
}

