'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchCurrentUser, loadSession } from '../../lib/openport-api'
import { getFirstAccessibleWorkspaceHref, getWorkspacePermissions } from '../../lib/workspace-permissions'

export default function WorkspaceIndexPage() {
  const router = useRouter()

  useEffect(() => {
    const session = loadSession()
    if (!session?.accessToken) {
      router.replace('/auth/login')
      return
    }

    void fetchCurrentUser(session)
      .then((currentUser) => {
        router.replace(getFirstAccessibleWorkspaceHref(getWorkspacePermissions(currentUser)))
      })
      .catch(() => {
        router.replace('/')
      })
  }, [router])

  return <div className="workspace-module-shell" />
}
