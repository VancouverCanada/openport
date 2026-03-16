'use client'

import { useEffect, useState } from 'react'
import { getToastEventName, type OpenPortToast } from '../lib/toast'

export function WorkspaceToastRegion() {
  const [toasts, setToasts] = useState<OpenPortToast[]>([])

  useEffect(() => {
    function handleToast(event: Event): void {
      const toast = (event as CustomEvent<OpenPortToast>).detail
      setToasts((current) => [...current, toast])
      window.setTimeout(() => {
        setToasts((current) => current.filter((entry) => entry.id !== toast.id))
      }, 3200)
    }

    window.addEventListener(getToastEventName(), handleToast)
    return () => {
      window.removeEventListener(getToastEventName(), handleToast)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="workspace-toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`workspace-toast workspace-toast-${toast.tone}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}
