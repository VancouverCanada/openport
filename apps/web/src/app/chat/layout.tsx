import { type ReactNode } from 'react'
import { WorkspaceAppShell } from '../../components/workspace-app-shell'

export default function ChatLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <WorkspaceAppShell>{children}</WorkspaceAppShell>
}
