'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { loadSession } from '../lib/openport-api'

type HomeEntryGateProps = {
  children: ReactNode
}

export function HomeEntryGate({ children }: HomeEntryGateProps) {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'anonymous' | 'authenticated'>('checking')

  useEffect(() => {
    const session = loadSession()
    if (session?.accessToken) {
      setStatus('authenticated')
      return
    }

    setStatus('anonymous')
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/chat')
    }
  }, [router, status])

  if (status === 'checking') {
    return <main className="home-entry-redirect" aria-hidden="true" />
  }

  if (status === 'authenticated') {
    return <main className="home-entry-redirect" aria-hidden="true" />
  }

  return <>{children}</>
}
