import { HomeEntryGate } from '../components/home-entry-gate'
import { LandingEntryActions } from '../components/landing-entry-actions'
import { LandingWordmark } from '../components/landing-wordmark'

export default function HomePage() {
  return (
    <HomeEntryGate>
      <main className="landing-page landing-page--entry">
        <section className="landing-auth-shell landing-auth-shell--entry">
          <div className="landing-auth-copy landing-auth-copy--entry">
            <LandingWordmark />
            <p>Sign in to enter the workspace.</p>
            <LandingEntryActions variant="hero" />
          </div>
        </section>
      </main>
    </HomeEntryGate>
  )
}
