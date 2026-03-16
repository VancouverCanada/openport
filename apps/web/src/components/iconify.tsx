'use client'

import { Icon } from '@iconify/react'
import type { ComponentProps } from 'react'

type IconifyProps = ComponentProps<typeof Icon> & {
  size?: number
}

export function Iconify({ size = 20, width, height, ...other }: IconifyProps) {
  return <Icon ssr width={width ?? size} height={height ?? size} {...other} />
}
