import { Suspense } from 'react'
import { ChatShell } from '../../components/chat-shell'

export default function ChatPage() {
  return (
    <Suspense fallback={<main className="home-entry-redirect" aria-hidden="true" />}>
      <ChatShell />
    </Suspense>
  )
}
