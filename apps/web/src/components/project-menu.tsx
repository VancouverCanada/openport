'use client'

import { useEffect, useRef, useState } from 'react'
import { Iconify } from './iconify'
import { IconButton } from './ui/icon-button'
import { TextButton } from './ui/text-button'

type ProjectMenuProps = {
  onCreateSubproject: () => void
  onDelete: () => void
  onEdit: () => void
  onExport: () => void
  onMoveToRoot?: (() => void) | null
}

export function ProjectMenu({
  onCreateSubproject,
  onDelete,
  onEdit,
  onExport,
  onMoveToRoot = null
}: ProjectMenuProps) {
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

  function runAction(action: () => void): void {
    setOpen(false)
    action()
  }

  return (
    <div ref={containerRef} className="project-menu-wrap">
      <IconButton
        aria-expanded={open}
        aria-label="Open project menu"
        className="project-tree-action"
        onClick={() => setOpen((current) => !current)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Iconify icon="solar:menu-dots-bold" size={14} />
      </IconButton>

      {open ? (
        <div className="project-menu">
          <TextButton onClick={() => runAction(onCreateSubproject)} variant="menu" type="button">
            <Iconify icon="solar:folder-with-files-outline" size={16} />
            <span>Create project</span>
          </TextButton>
          <TextButton onClick={() => runAction(onEdit)} variant="menu" type="button">
            <Iconify icon="solar:pen-outline" size={16} />
            <span>Edit</span>
          </TextButton>
          <TextButton onClick={() => runAction(onExport)} variant="menu" type="button">
            <Iconify icon="solar:download-minimalistic-outline" size={16} />
            <span>Export</span>
          </TextButton>
          {onMoveToRoot ? (
            <TextButton onClick={() => runAction(onMoveToRoot)} variant="menu" type="button">
              <Iconify icon="solar:folder-open-outline" size={16} />
              <span>Move to root</span>
            </TextButton>
          ) : null}
          <TextButton danger onClick={() => runAction(onDelete)} variant="menu" type="button">
            <Iconify icon="solar:trash-bin-trash-outline" size={16} />
            <span>Delete</span>
          </TextButton>
        </div>
      ) : null}
    </div>
  )
}
