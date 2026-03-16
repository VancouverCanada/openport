import { RegisterForm } from '../../../components/auth/register-form'
import { PublicFooter } from '../../../components/public-footer'
import { PublicNavbar } from '../../../components/public-navbar'
import { CapsuleButton } from '../../../components/ui/capsule-button'

export default function RegisterPage() {
  return (
    <main className="landing-page">
      <PublicNavbar
        actions={
          <nav className="landing-nav" aria-label="Auth">
            <CapsuleButton href="/" size="lg" variant="secondary">Home</CapsuleButton>
            <CapsuleButton href="/auth/login" size="lg" variant="primary">Login</CapsuleButton>
          </nav>
        }
      />

      <section className="auth-page">
        <div className="auth-page-inner">
          <div className="auth-copy">
            <h1>Create account.</h1>
            <p>Set up the first operator account and bootstrap your local OpenPort workspace.</p>
          </div>

          <RegisterForm />
        </div>
      </section>

      <PublicFooter />
    </main>
  )
}
