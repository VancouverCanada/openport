import type { Transition, Variants } from 'framer-motion'
import { transitionEnter, transitionExit } from './transitions'

export function varContainer(props?: {
  transitionIn?: Partial<Transition>
  transitionOut?: Partial<Transition>
}): Variants {
  return {
    animate: {
      transition: {
        staggerChildren: 0.07,
        delayChildren: 0.08,
        ...(props?.transitionIn || {})
      }
    },
    exit: {
      transition: {
        staggerChildren: 0.06,
        staggerDirection: -1,
        ...(props?.transitionOut || {})
      }
    }
  }
}

export function varFade(
  direction: 'in' | 'inUp' | 'inDown' | 'inLeft' | 'inRight',
  options?: {
    distance?: number
    transitionIn?: Partial<Transition>
    transitionOut?: Partial<Transition>
  }
): Variants {
  const distance = options?.distance ?? 40
  const transitionIn = options?.transitionIn
  const transitionOut = options?.transitionOut

  const map = {
    in: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: transitionEnter(transitionIn) },
      exit: { opacity: 0, transition: transitionExit(transitionOut) }
    },
    inUp: {
      initial: { y: distance, opacity: 0 },
      animate: { y: 0, opacity: 1, transition: transitionEnter(transitionIn) },
      exit: { y: distance, opacity: 0, transition: transitionExit(transitionOut) }
    },
    inDown: {
      initial: { y: -distance, opacity: 0 },
      animate: { y: 0, opacity: 1, transition: transitionEnter(transitionIn) },
      exit: { y: -distance, opacity: 0, transition: transitionExit(transitionOut) }
    },
    inLeft: {
      initial: { x: -distance, opacity: 0 },
      animate: { x: 0, opacity: 1, transition: transitionEnter(transitionIn) },
      exit: { x: -distance, opacity: 0, transition: transitionExit(transitionOut) }
    },
    inRight: {
      initial: { x: distance, opacity: 0 },
      animate: { x: 0, opacity: 1, transition: transitionEnter(transitionIn) },
      exit: { x: distance, opacity: 0, transition: transitionExit(transitionOut) }
    }
  }

  return map[direction]
}

export const varHover = (value = 1.03) => ({ scale: value })
export const varTap = (value = 0.97) => ({ scale: value })
