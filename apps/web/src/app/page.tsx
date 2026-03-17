import { HomeEntryGate } from '../components/home-entry-gate'
import { EntryParallaxCarousel } from '../components/entry-parallax-carousel'
import { LandingEntryActions } from '../components/landing-entry-actions'
import { LandingWordmark } from '../components/landing-wordmark'
import { MotionViewport } from '../components/animate'

export default function HomePage() {
  return (
    <HomeEntryGate>
      <main className="landing-page landing-page--entry">
        <section className="landing-auth-shell landing-auth-shell--entry">
          <MotionViewport amount={0.2} className="landing-entry-motion">
            <div className="landing-auth-copy landing-auth-copy--entry landing-auth-copy--bare">
              <EntryParallaxCarousel />
              <LandingWordmark />
              <LandingEntryActions variant="hero" />
            </div>
          </MotionViewport>
        </section>
      </main>
    </HomeEntryGate>
  )
}
