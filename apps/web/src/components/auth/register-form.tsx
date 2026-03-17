'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState, useTransition } from 'react'
import { registerOpenPort, saveSession } from '../../lib/openport-api'
import { CapsuleButton } from '../ui/capsule-button'
import { FeedbackBanner } from '../ui/feedback-banner'

export function RegisterForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    setError(null)
    setSuccess(null)

    startTransition(() => {
      void (async () => {
      try {
        const session = await registerOpenPort({
          name: String(formData.get('name') || '').trim(),
          email: String(formData.get('email') || '').trim(),
          workspaceName: String(formData.get('workspaceName') || '').trim(),
          password: String(formData.get('password') || '')
        })
        saveSession(session)
        setSuccess(`Workspace ${session.workspaceId} created. Redirecting to chat.`)
        router.push('/')
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : 'Registration failed'
        setError(message)
      }
      })()
    })
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label>
        Name
        <input className="auth-input" disabled={isPending} name="name" placeholder="Type your name" type="text" />
      </label>
      <label>
        Email
        <input className="auth-input" disabled={isPending} name="email" placeholder="Type your email" type="email" />
      </label>
      <label>
        Workspace
        <input className="auth-input" disabled={isPending} name="workspaceName" placeholder="Type your workspace name" type="text" />
      </label>
      <label>
        Password
        <input className="auth-input" disabled={isPending} name="password" placeholder="Type your password" type="password" />
      </label>
      <div className="auth-actions">
        <CapsuleButton disabled={isPending} type="submit" variant="primary">{isPending ? 'Creating account...' : 'Create account'}</CapsuleButton>
        <CapsuleButton href="/auth/login" variant="secondary">Back to login</CapsuleButton>
      </div>
      {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
      {success ? <FeedbackBanner variant="success">{success}</FeedbackBanner> : null}
    </form>
  )
}
