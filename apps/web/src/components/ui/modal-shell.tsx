'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    // Render modals at the document root so they're not affected by transforms/stacking contexts
    // applied to app layout containers (e.g. sidebar animations).
    setPortalTarget(document.body)
  }, [])

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

  useEffect(() => {
    if (!open) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [open])

  if (!isMounted || !portalTarget) return null

  return createPortal(
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
  , portalTarget)
}
