import { LoginForm } from '../../../components/auth/login-form'
import { PublicFooter } from '../../../components/public-footer'
import { PublicNavbar } from '../../../components/public-navbar'
import { CapsuleButton } from '../../../components/ui/capsule-button'

export default function LoginPage() {
  return (
    <main className="landing-page">
      <PublicNavbar
        actions={
          <nav className="landing-nav" aria-label="Auth">
            <CapsuleButton href="/" size="lg" variant="secondary">Home</CapsuleButton>
            <CapsuleButton href="/auth/register" size="lg" variant="primary">Register</CapsuleButton>
          </nav>
        }
      />

      <section className="auth-page">
        <div className="auth-page-inner">
          <div className="auth-copy">
            <h1>Sign in.</h1>
            <p>Enter your account to continue into the local OpenPort workspace.</p>
          </div>

          <LoginForm />
        </div>
      </section>

      <PublicFooter />
    </main>
  )
}
