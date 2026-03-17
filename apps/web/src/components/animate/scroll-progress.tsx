'use client'

import { m, useScroll, useSpring } from 'framer-motion'

type ScrollProgressProps = {
  className?: string
}

export function ScrollProgress({ className }: ScrollProgressProps) {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 28,
    restDelta: 0.001
  })

  return <m.div aria-hidden="true" className={className || 'app-scroll-progress'} style={{ scaleX }} />
}

