import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type CapsuleButtonVariant = 'primary' | 'secondary'
type CapsuleButtonSize = 'sm' | 'md' | 'lg' | 'icon'

type CapsuleButtonBaseProps = {
  active?: boolean
  children: ReactNode
  className?: string
  size?: CapsuleButtonSize
  variant?: CapsuleButtonVariant
}

type CapsuleButtonLinkProps = CapsuleButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'> & {
    external?: boolean
    href: string
  }

type CapsuleButtonNativeProps = CapsuleButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
    href?: undefined
  }

export type CapsuleButtonProps = CapsuleButtonLinkProps | CapsuleButtonNativeProps

function joinClassNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function capsuleButtonClassName({
  active = false,
  className,
  size = 'md',
  variant = 'secondary'
}: Pick<CapsuleButtonBaseProps, 'active' | 'className' | 'size' | 'variant'>): string {
  return joinClassNames(
    'capsule-button',
    `capsule-button--${variant}`,
    `capsule-button--${size}`,
    active && 'is-active',
    className
  )
}

export function CapsuleButton(props: CapsuleButtonProps) {
  const { active = false, children, className, size = 'md', variant = 'secondary', ...rest } = props
  const resolvedClassName = capsuleButtonClassName({ active, className, size, variant })

  if ('href' in props && typeof props.href === 'string') {
    const { external = false, href, ...anchorProps } = rest as Omit<CapsuleButtonLinkProps, keyof CapsuleButtonBaseProps>

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
    <button className={resolvedClassName} {...(rest as Omit<CapsuleButtonNativeProps, keyof CapsuleButtonBaseProps>)}>
      {children}
    </button>
  )
}
