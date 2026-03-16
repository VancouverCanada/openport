import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonVariant = 'ghost' | 'topbar' | 'toolbar' | 'list'
type IconButtonSize = 'sm' | 'md'

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  active?: boolean
  className?: string
  children: ReactNode
  size?: IconButtonSize
  variant?: IconButtonVariant
}

function joinClassNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function iconButtonClassName({
  active = false,
  className,
  size = 'md',
  variant = 'ghost'
}: Pick<IconButtonProps, 'active' | 'className' | 'size' | 'variant'>): string {
  return joinClassNames(
    'icon-button',
    `icon-button--${variant}`,
    `icon-button--${size}`,
    active && 'is-active',
    className
  )
}

export function IconButton({
  active = false,
  children,
  className,
  size = 'md',
  type = 'button',
  variant = 'ghost',
  ...props
}: IconButtonProps) {
  return (
    <button className={iconButtonClassName({ active, className, size, variant })} type={type} {...props}>
      {children}
    </button>
  )
}
