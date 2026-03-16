'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChatShell } from './chat-shell'
import { WorkspaceAppShell } from './workspace-app-shell'
import { loadSession } from '../lib/openport-api'

type HomeEntryGateProps = {
  children: ReactNode
}

export function HomeEntryGate({ children }: HomeEntryGateProps) {
  const [status, setStatus] = useState<'checking' | 'anonymous' | 'authenticated'>('checking')

  useEffect(() => {
    const session = loadSession()
    if (session?.accessToken) {
      setStatus('authenticated')
      return
    }

    setStatus('anonymous')
  }, [])

  if (status === 'checking') {
    return <main className="home-entry-redirect" aria-hidden="true" />
  }

  if (status === 'authenticated') {
    return (
      <WorkspaceAppShell>
        <ChatShell />
      </WorkspaceAppShell>
    )
  }

  return <>{children}</>
}
