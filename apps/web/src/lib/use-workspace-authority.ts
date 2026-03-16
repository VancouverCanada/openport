'use client'

import { useEffect, useState } from 'react'
import type { OpenPortCurrentUserResponse } from '@openport/product-contracts'
import { fetchCurrentUser, loadSession } from './openport-api'
import {
  canManageWorkspace,
  canManageWorkspaceModule,
  canWorkspaceModuleAction,
  getWorkspaceCapabilities,
  getWorkspacePermissions,
  type WorkspaceModuleAction,
  type WorkspaceModuleKey
} from './workspace-permissions'

export function useWorkspaceAuthority() {
  const [currentUser, setCurrentUser] = useState<OpenPortCurrentUserResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = loadSession()
    if (!session?.accessToken) {
      setCurrentUser(null)
      setLoading(false)
      return
    }

    setLoading(true)
    void fetchCurrentUser(session)
      .then((response) => {
        setCurrentUser(response)
      })
      .catch(() => {
        setCurrentUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return {
    currentUser,
    loading,
    permissions: getWorkspacePermissions(currentUser),
    capabilities: getWorkspaceCapabilities(currentUser),
    canManage: canManageWorkspace(currentUser),
    canManageModule: (module: WorkspaceModuleKey) => canManageWorkspaceModule(currentUser, module),
    canModuleAction: (module: WorkspaceModuleKey, action: WorkspaceModuleAction) =>
      canWorkspaceModuleAction(currentUser, module, action)
  }
}
