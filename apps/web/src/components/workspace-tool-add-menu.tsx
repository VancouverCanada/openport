'use client'

import { useEffect, useRef, useState } from 'react'
import { Iconify } from './iconify'
import { CapsuleButton } from './ui/capsule-button'
import { TextButton } from './ui/text-button'

export function WorkspaceToolAddMenu() {
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
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="workspace-resource-menu-wrap">
      <CapsuleButton onClick={() => setOpen((current) => !current)} type="button" variant="primary">
        <Iconify icon="solar:add-circle-outline" size={16} />
        New tool
      </CapsuleButton>
      {open ? (
        <div className="workspace-resource-menu workspace-resource-menu--end">
          <TextButton className="workspace-resource-menu-item" href="/workspace/tools/create" onClick={() => setOpen(false)} variant="menu">
            <Iconify icon="solar:pen-outline" size={16} />
            <span>New tool</span>
          </TextButton>
        </div>
      ) : null}
    </div>
  )
}
