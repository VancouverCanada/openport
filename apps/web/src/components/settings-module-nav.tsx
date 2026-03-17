'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const settingsTabs = [
  { href: '/settings/workspaces', label: 'Workspaces' },
  { href: '/settings/connections', label: 'Connections' }
] as const

export function SettingsModuleNav() {
  const pathname = usePathname()

  return (
    <nav className="workspace-module-nav" aria-label="Settings sections">
      {settingsTabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`)

        return (
          <Link
            key={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`workspace-module-tab${isActive ? ' is-active' : ''}`}
            href={tab.href}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
