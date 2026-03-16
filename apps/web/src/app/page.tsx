import { HomeEntryGate } from '../components/home-entry-gate'
import { LandingEntryActions } from '../components/landing-entry-actions'
import { PublicNavbar } from '../components/public-navbar'

export default function HomePage() {
  return (
    <HomeEntryGate>
      <main className="landing-page landing-page--minimal">
        <PublicNavbar actions={<LandingEntryActions variant="nav" />} />

        <section className="landing-auth-shell">
          <div className="landing-auth-copy">
            <div className="landing-auth-kicker">OpenPort</div>
            <h1>Chat-first local AI.</h1>
            <p>Sign in to continue into the chat workspace.</p>
            <div className="landing-auth-actions">
              <LandingEntryActions variant="hero" />
            </div>
          </div>
        </section>
      </main>
    </HomeEntryGate>
  )
}
