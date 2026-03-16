import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type TextButtonVariant = 'sidebar' | 'menu' | 'link' | 'panel' | 'inline'
type TextButtonSize = 'sm' | 'md'

type TextButtonBaseProps = {
  active?: boolean
  children: ReactNode
  className?: string
  danger?: boolean
  size?: TextButtonSize
  variant?: TextButtonVariant
}

type TextButtonLinkProps = TextButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'> & {
    external?: boolean
    href: string
  }

type TextButtonNativeProps = TextButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
    href?: undefined
  }

export type TextButtonProps = TextButtonLinkProps | TextButtonNativeProps

function joinClassNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function textButtonClassName({
  active = false,
  className,
  danger = false,
  size = 'md',
  variant = 'inline'
}: Pick<TextButtonBaseProps, 'active' | 'className' | 'danger' | 'size' | 'variant'>) {
  return joinClassNames(
    'text-button',
    `text-button--${variant}`,
    `text-button--${size}`,
    active && 'is-active',
    danger && 'is-danger',
    className
  )
}

export function TextButton(props: TextButtonProps) {
  const { active = false, children, className, danger = false, size = 'md', variant = 'inline', ...rest } = props
  const resolvedClassName = textButtonClassName({ active, className, danger, size, variant })

  if ('href' in props && typeof props.href === 'string') {
    const { external = false, href, ...anchorProps } = rest as Omit<TextButtonLinkProps, keyof TextButtonBaseProps>
    if (external || /^https?:\/\//.test(href)) {
      return (
        <a className={resolvedClassName} href={href} {...anchorProps}>
          {children}
        </a>
      )
    }

    return (
      <Link className={resolvedClassName} href={href} {...anchorProps}>
        {children}
      </Link>
    )
  }

  return (
    <button className={resolvedClassName} {...(rest as Omit<TextButtonNativeProps, keyof TextButtonBaseProps>)}>
      {children}
    </button>
  )
}
