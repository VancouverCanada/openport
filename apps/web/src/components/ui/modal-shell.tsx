'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Iconify } from '../iconify'
import { IconButton } from './icon-button'

type ModalShellProps = {
  ariaLabel?: string
  backdropClassName?: string
  bodyClassName?: string
  children?: ReactNode
  closeLabel?: string
  dialogClassName?: string
  footer?: ReactNode
  headerClassName?: string
  onClose: () => void
  open: boolean
  overlayClassName?: string
  title: ReactNode
}

export function ModalShell({
  ariaLabel = 'Dialog',
  backdropClassName,
  bodyClassName,
  children,
  closeLabel = 'Close dialog',
  dialogClassName = 'project-dialog',
  footer,
  headerClassName = 'project-dialog-header',
  onClose,
  open,
  overlayClassName = 'project-dialog-overlay',
  title
}: ModalShellProps) {
  const [isMounted, setIsMounted] = useState(open)
  const [isVisible, setIsVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setIsMounted(true)
      const id = window.requestAnimationFrame(() => setIsVisible(true))
      return () => window.cancelAnimationFrame(id)
    }

    setIsVisible(false)
    const timeout = window.setTimeout(() => setIsMounted(false), 180)
    return () => window.clearTimeout(timeout)
  }, [open])

  if (!isMounted) return null

  return (
    <div
      aria-modal="true"
      className={`${overlayClassName}${isVisible ? ' is-open' : ' is-closing'}`}
      role="dialog"
    >
      <button aria-label={closeLabel} className={backdropClassName || 'project-dialog-backdrop'} onClick={onClose} type="button" />

      <div className={dialogClassName}>
        <div className={headerClassName}>
          <div className="project-dialog-title">{title}</div>
          <IconButton aria-label={closeLabel} className="project-dialog-close" onClick={onClose} size="md" type="button" variant="ghost">
            <Iconify icon="solar:close-outline" size={18} />
          </IconButton>
        </div>

        <div className={bodyClassName || 'project-dialog-body'}>{children}</div>
        {footer ? <div className="project-dialog-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
