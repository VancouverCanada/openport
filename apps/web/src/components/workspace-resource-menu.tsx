'use client'

import { useEffect, useRef, useState } from 'react'
import { Iconify } from './iconify'
import { IconButton } from './ui/icon-button'
import { TextButton } from './ui/text-button'

export type WorkspaceResourceMenuItem = {
  type?: 'action' | 'divider'
  danger?: boolean
  disabled?: boolean
  href?: string
  icon: string
  label: string
  onClick?: () => void
}

type WorkspaceResourceMenuProps = {
  align?: 'start' | 'end'
  ariaLabel?: string
  items: WorkspaceResourceMenuItem[]
}

export function WorkspaceResourceMenu({
  align = 'end',
  ariaLabel = 'Open resource menu',
  items
}: WorkspaceResourceMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function runAction(action?: () => void): void {
    setOpen(false)
    action?.()
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div ref={containerRef} className="workspace-resource-menu-wrap">
      <IconButton
        aria-expanded={open}
        aria-label={ariaLabel}
        className="workspace-resource-menu-trigger"
        onClick={() => setOpen((current) => !current)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Iconify icon="solar:menu-dots-bold" size={14} />
      </IconButton>

      {open ? (
        <div className={`workspace-resource-menu workspace-resource-menu--${align}`}>
          {items.map((item, index) =>
            item.type === 'divider' ? (
              <div className="workspace-resource-menu-divider" key={`divider-${index}`} />
            ) : item.href ? (
              item.disabled ? (
                <button
                  key={item.label}
                  className="text-button text-button--menu text-button--md workspace-resource-menu-item"
                  disabled
                  type="button"
                >
                  <Iconify icon={item.icon} size={16} />
                  <span>{item.label}</span>
                </button>
              ) : (
                <TextButton
                  key={item.label}
                  className="workspace-resource-menu-item"
                  danger={item.danger}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  variant="menu"
                >
                  <Iconify icon={item.icon} size={16} />
                  <span>{item.label}</span>
                </TextButton>
              )
            ) : (
              <TextButton
                key={item.label}
                className="workspace-resource-menu-item"
                danger={item.danger}
                disabled={item.disabled}
                onClick={() => runAction(item.onClick)}
                type="button"
                variant="menu"
              >
                <Iconify icon={item.icon} size={16} />
                <span>{item.label}</span>
              </TextButton>
            )
          )}
        </div>
      ) : null}
    </div>
  )
}
