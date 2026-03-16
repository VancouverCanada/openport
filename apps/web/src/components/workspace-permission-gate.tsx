'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { fetchCurrentUser, loadSession, type OpenPortSession } from '../lib/openport-api'
import {
  canManageWorkspace,
  canAccessWorkspaceModule,
  getFirstAccessibleWorkspaceHref,
  getWorkspaceModuleForPathname,
  getWorkspacePermissions,
  isWorkspaceManagePath
} from '../lib/workspace-permissions'

export function WorkspacePermissionGate({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setChecked(false)
    const session = loadSession()
    if (!session?.accessToken) {
      router.replace('/auth/login')
      return
    }

    void verifyPermissions(session)
  }, [pathname, router])

  async function verifyPermissions(session: OpenPortSession): Promise<void> {
    try {
      const currentUser = await fetchCurrentUser(session)
      const permissions = getWorkspacePermissions(currentUser)
      const currentModule = getWorkspaceModuleForPathname(pathname)

      if (!canAccessWorkspaceModule(permissions, currentModule)) {
        router.replace(getFirstAccessibleWorkspaceHref(permissions))
        return
      }

      if (isWorkspaceManagePath(pathname) && !canManageWorkspace(currentUser)) {
        router.replace(getFirstAccessibleWorkspaceHref(permissions))
        return
      }

      setChecked(true)
    } catch {
      router.replace('/chat')
    }
  }

  if (!checked) {
    return <div className="workspace-module-shell" />
  }

  return <>{children}</>
}
