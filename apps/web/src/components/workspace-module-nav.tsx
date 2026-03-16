'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { fetchCurrentUser, loadSession } from '../lib/openport-api'
import { getWorkspacePermissions, primaryWorkspaceTabs } from '../lib/workspace-permissions'

export function WorkspaceModuleNav() {
  const pathname = usePathname()
  const [visibleTabs, setVisibleTabs] = useState<typeof primaryWorkspaceTabs>([])

  useEffect(() => {
    const session = loadSession()
    if (!session?.accessToken) {
      setVisibleTabs([])
      return
    }

    void fetchCurrentUser(session)
      .then((currentUser) => {
        const permissions = getWorkspacePermissions(currentUser)
        setVisibleTabs(primaryWorkspaceTabs.filter((tab) => permissions[tab.module]))
      })
      .catch(() => {
        setVisibleTabs([])
      })
  }, [pathname])

  return (
    <nav className="workspace-module-nav" aria-label="Workspace sections">
      {visibleTabs.map((tab) => {
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
