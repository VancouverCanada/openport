'use client'

import { useEffect, useRef, useState } from 'react'
import { Iconify } from './iconify'
import { CapsuleButton } from './ui/capsule-button'
import { TextButton } from './ui/text-button'

type WorkspaceKnowledgeAddContentMenuProps = {
  disabled?: boolean
  onAddText: () => void
  onAddWebpage: () => void
  onSyncDirectory: () => void
  onUploadDirectory: () => void
  onUploadFile: () => void
}

export function WorkspaceKnowledgeAddContentMenu({
  disabled = false,
  onAddText,
  onAddWebpage,
  onSyncDirectory,
  onUploadDirectory,
  onUploadFile
}: WorkspaceKnowledgeAddContentMenuProps) {
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

  function runAction(action: () => void): void {
    setOpen(false)
    action()
  }

  return (
    <div ref={containerRef} className="workspace-resource-menu-wrap">
      <CapsuleButton disabled={disabled} onClick={() => setOpen((current) => !current)} type="button" variant="secondary">
        <Iconify icon="solar:add-circle-outline" size={16} />
        Add content
      </CapsuleButton>
      {open ? (
        <div className="workspace-resource-menu workspace-resource-menu--end">
          <TextButton className="workspace-resource-menu-item" onClick={() => runAction(onUploadFile)} type="button" variant="menu">
            <Iconify icon="solar:upload-outline" size={16} />
            <span>Upload files</span>
          </TextButton>
          <TextButton className="workspace-resource-menu-item" onClick={() => runAction(onUploadDirectory)} type="button" variant="menu">
            <Iconify icon="solar:folder-with-files-outline" size={16} />
            <span>Upload directory</span>
          </TextButton>
          <TextButton className="workspace-resource-menu-item" onClick={() => runAction(onSyncDirectory)} type="button" variant="menu">
            <Iconify icon="solar:restart-bold" size={16} />
            <span>Sync directory</span>
          </TextButton>
          <TextButton className="workspace-resource-menu-item" onClick={() => runAction(onAddWebpage)} type="button" variant="menu">
            <Iconify icon="solar:global-outline" size={16} />
            <span>Add webpage</span>
          </TextButton>
          <TextButton className="workspace-resource-menu-item" onClick={() => runAction(onAddText)} type="button" variant="menu">
            <Iconify icon="solar:document-text-outline" size={16} />
            <span>Add text content</span>
          </TextButton>
        </div>
      ) : null}
    </div>
  )
}
