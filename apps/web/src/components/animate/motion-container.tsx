'use client'

import { m } from 'framer-motion'
import type { ReactNode } from 'react'
import { varContainer } from './variants'

type MotionContainerProps = {
  action?: boolean
  animate?: boolean
  children: ReactNode
  className?: string
}

export function MotionContainer({ action = false, animate, children, className }: MotionContainerProps) {
  return (
    <m.div
      animate={action ? (animate ? 'animate' : 'exit') : 'animate'}
      className={className}
      exit={action ? undefined : 'exit'}
      initial={action ? false : 'initial'}
      variants={varContainer()}
    >
      {children}
    </m.div>
  )
}

