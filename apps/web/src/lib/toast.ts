'use client'

export type OpenPortToast = {
  id: string
  tone: 'success' | 'error' | 'info'
  message: string
}

const TOAST_EVENT = 'openport:toast'

export function getToastEventName(): string {
  return TOAST_EVENT
}

export function notify(tone: OpenPortToast['tone'], message: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<OpenPortToast>(TOAST_EVENT, {
      detail: {
        id: `toast_${Math.random().toString(36).slice(2, 10)}`,
        tone,
        message
      }
    })
  )
}
