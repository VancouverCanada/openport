'use client'

import { LazyMotion, domMax } from 'framer-motion'
import type { ReactNode } from 'react'

type MotionLazyProps = {
  children: ReactNode
}

export function MotionLazy({ children }: MotionLazyProps) {
  return (
    <LazyMotion strict features={domMax}>
      {children}
    </LazyMotion>
  )
}

