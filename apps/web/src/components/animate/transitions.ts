import type { Transition } from 'framer-motion'

const easing: [number, number, number, number] = [0.43, 0.13, 0.23, 0.96]

export const transitionEnter = (props?: Partial<Transition>): Transition => ({
  duration: 0.78,
  ease: easing,
  ...(props || {})
})

export const transitionExit = (props?: Partial<Transition>): Transition => ({
  duration: 0.58,
  ease: easing,
  ...(props || {})
})

export const transitionHover = (props?: Partial<Transition>): Transition => ({
  duration: 0.42,
  ease: easing,
  ...(props || {})
})

export const transitionTap = (props?: Partial<Transition>): Transition => ({
  type: 'spring',
  stiffness: 320,
  damping: 20,
  ...(props || {})
})
