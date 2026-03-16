import type { ReactNode } from 'react'
import { LandingWordmark } from './landing-wordmark'

type PublicNavbarProps = {
  actions?: ReactNode
}

export function PublicNavbar({ actions }: PublicNavbarProps) {
  return (
    <header className="landing-navbar">
      <div className="landing-nav-inner">
        <a className="landing-brand" href="/">
          <div>
            <strong>
              <LandingWordmark />
            </strong>
          </div>
        </a>

        {actions}
      </div>
    </header>
  )
}
