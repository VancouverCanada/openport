'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { CapsuleButton } from './ui/capsule-button'
import { ModalShell } from './ui/modal-shell'

type ConfirmDialogProps = {
  cancelLabel?: string
  children?: ReactNode
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
  open: boolean
  title: string
}

export function ConfirmDialog({
  cancelLabel = 'Cancel',
  children,
  confirmLabel = 'Confirm',
  onCancel,
  onConfirm,
  open,
  title
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel, open])

  return (
    <ModalShell
      closeLabel="Close dialog"
      dialogClassName="project-dialog project-confirm-dialog"
      footer={
        <div className="project-confirm-actions">
          <CapsuleButton onClick={onCancel} type="button" variant="secondary">{cancelLabel}</CapsuleButton>
          <CapsuleButton onClick={onConfirm} type="button" variant="primary">{confirmLabel}</CapsuleButton>
        </div>
      }
      onClose={onCancel}
      open={open}
      title={title}
    >
      {children}
    </ModalShell>
  )
}
