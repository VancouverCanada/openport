import type { ReactNode } from 'react'
import { WorkspaceAppShell } from '../../components/workspace-app-shell'
import { WorkspaceModuleNav } from '../../components/workspace-module-nav'
import { WorkspacePermissionGate } from '../../components/workspace-permission-gate'

export default function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <WorkspaceAppShell>
      <WorkspacePermissionGate>
        <div className="workspace-module-shell">
          <WorkspaceModuleNav />
          {children}
        </div>
      </WorkspacePermissionGate>
    </WorkspaceAppShell>
  )
}
