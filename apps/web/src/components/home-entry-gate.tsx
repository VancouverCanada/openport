'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { clearSession, fetchCurrentUser, loadSession } from '../lib/openport-api'

type HomeEntryGateProps = {
  authenticated?: ReactNode
  children: ReactNode
}

export function HomeEntryGate({ authenticated = null, children }: HomeEntryGateProps) {
  const [status, setStatus] = useState<'checking' | 'anonymous' | 'authenticated'>('checking')

  useEffect(() => {
    let active = true

    async function resolveStatus(): Promise<void> {
      const session = loadSession()
      if (!session?.accessToken) {
        if (active) setStatus('anonymous')
        return
      }

      try {
        await fetchCurrentUser(session)
        if (active) setStatus('authenticated')
      } catch {
        clearSession()
        if (active) setStatus('anonymous')
      }
    }

    void resolveStatus()

    return () => {
      active = false
    }
  }, [])

  if (status === 'checking') {
    return <main className="home-entry-redirect" aria-hidden="true" />
  }

  if (status === 'authenticated') {
    return <>{authenticated}</>
  }

  return <>{children}</>
}
