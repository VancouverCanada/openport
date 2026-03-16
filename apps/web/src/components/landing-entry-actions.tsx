'use client'

import { useEffect, useState } from 'react'
import { loadSession } from '../lib/openport-api'
import { CapsuleButton } from './ui/capsule-button'

type EntryActionSet = {
  primaryHref: string
  primaryLabel: string
  secondaryHref: string
  secondaryLabel: string
}

type LandingEntryActionsProps = {
  variant: 'nav' | 'hero'
}

function resolveActions(hasSession: boolean): EntryActionSet {
  if (hasSession) {
    return {
      primaryHref: '/chat',
      primaryLabel: 'Open Chat',
      secondaryHref: '/dashboard',
      secondaryLabel: 'Open Status'
    }
  }

  return {
    primaryHref: '/auth/login',
    primaryLabel: 'Login',
    secondaryHref: '/auth/register',
    secondaryLabel: 'Register'
  }
}

export function LandingEntryActions({ variant }: LandingEntryActionsProps) {
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    const syncSession = (): void => {
      setHasSession(Boolean(loadSession()?.accessToken))
    }

    syncSession()
    window.addEventListener('storage', syncSession)
    return () => window.removeEventListener('storage', syncSession)
  }, [])

  const actions = resolveActions(hasSession)

  if (variant === 'nav') {
    return (
      <nav className="landing-nav" aria-label="Primary">
        <CapsuleButton href={actions.secondaryHref} size="lg" variant="secondary">{actions.secondaryLabel}</CapsuleButton>
        <CapsuleButton href={actions.primaryHref} size="lg" variant="primary">{actions.primaryLabel}</CapsuleButton>
      </nav>
    )
  }

  return (
    <div className="landing-action-block">
      <div className="landing-actions">
        <CapsuleButton href={actions.primaryHref} size="lg" variant="primary">{actions.primaryLabel}</CapsuleButton>
        <CapsuleButton href={actions.secondaryHref} size="lg" variant="secondary">{actions.secondaryLabel}</CapsuleButton>
      </div>
    </div>
  )
}
