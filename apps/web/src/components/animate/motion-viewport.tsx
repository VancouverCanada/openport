'use client'

import { m } from 'framer-motion'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { varContainer } from './variants'

type MotionViewportProps = {
  amount?: number
  children: ReactNode
  className?: string
  disableAnimateOnSmallScreen?: boolean
  once?: boolean
  style?: CSSProperties
}

export function MotionViewport({
  amount = 0.24,
  children,
  className,
  disableAnimateOnSmallScreen = true,
  once = true,
  style
}: MotionViewportProps) {
  const [isSmallScreen, setIsSmallScreen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsSmallScreen(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const disabled = disableAnimateOnSmallScreen && isSmallScreen

  if (disabled) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <m.div
      className={className}
      initial="initial"
      style={style}
      variants={varContainer()}
      viewport={{ once, amount }}
      whileInView="animate"
    >
      {children}
    </m.div>
  )
}

