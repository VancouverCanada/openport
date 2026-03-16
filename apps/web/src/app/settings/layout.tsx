import type { ReactNode } from 'react'
import { WorkspaceAppShell } from '../../components/workspace-app-shell'
import { SettingsModuleNav } from '../../components/settings-module-nav'

export default function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <WorkspaceAppShell>
      <div className="workspace-module-shell">
        <SettingsModuleNav />
        {children}
      </div>
    </WorkspaceAppShell>
  )
}
