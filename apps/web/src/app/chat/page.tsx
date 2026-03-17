import { Suspense } from 'react'
import { ChatShell } from '../../components/chat-shell'
import { WorkspaceAppShell } from '../../components/workspace-app-shell'

export default function ChatPage() {
  return (
    <WorkspaceAppShell>
      <Suspense fallback={<main className="home-entry-redirect" aria-hidden="true" />}>
        <ChatShell />
      </Suspense>
    </WorkspaceAppShell>
  )
}
