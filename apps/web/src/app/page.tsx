import { HomeEntryGate } from '../components/home-entry-gate'
import { LandingEntryActions } from '../components/landing-entry-actions'
import { WorkspaceAppShell } from '../components/workspace-app-shell'
import { ChatShell } from '../components/chat-shell'
import { PublicNavbar } from '../components/public-navbar'
import { PublicFooter } from '../components/public-footer'

export default function HomePage() {
  return (
    <HomeEntryGate authenticated={<WorkspaceAppShell><ChatShell /></WorkspaceAppShell>}>
      <main className="landing-page">
        <PublicNavbar actions={<LandingEntryActions variant="nav" />} />

        <section className="landing-hero">
          <div className="landing-content">
            <div className="landing-copy">
              <div className="landing-hero-image">
                <img alt="" aria-hidden="true" src="/images/openport-hero.jpg" />
              </div>
              <h1>The AI stack, on your terms.</h1>
              <p>Bring any model, extend it with code, and keep your data under your control, without compromise.</p>
              <LandingEntryActions variant="hero" />
            </div>
          </div>
        </section>

        <PublicFooter />
      </main>
    </HomeEntryGate>
  )
}
