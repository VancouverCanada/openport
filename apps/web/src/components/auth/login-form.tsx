'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState, useTransition } from 'react'
import { loginOpenPort, saveSession } from '../../lib/openport-api'
import { CapsuleButton } from '../ui/capsule-button'
import { FeedbackBanner } from '../ui/feedback-banner'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')

    setError(null)
    setSuccess(null)

    startTransition(() => {
      void (async () => {
      try {
        const session = await loginOpenPort({ email, password, rememberMe: true })
        saveSession(session)
        setSuccess(`Signed in as ${session.email}. Redirecting to chat.`)
        router.push('/')
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : 'Login failed'
        setError(message)
      }
      })()
    })
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label>
        Email
        <input className="auth-input" disabled={isPending} name="email" placeholder="Type your email" type="email" />
      </label>
      <label>
        Password
        <input className="auth-input" disabled={isPending} name="password" placeholder="Type your password" type="password" />
      </label>
      <div className="auth-actions">
        <CapsuleButton disabled={isPending} type="submit" variant="primary">{isPending ? 'Signing in...' : 'Sign in'}</CapsuleButton>
        <CapsuleButton href="/auth/register" variant="secondary">Create account</CapsuleButton>
      </div>
      {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
      {success ? <FeedbackBanner variant="success">{success}</FeedbackBanner> : null}
    </form>
  )
}
