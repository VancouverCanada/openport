import { Suspense } from 'react'
import { ChatShell } from '../../components/chat-shell'

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="chat-app-shell" />}>
      <ChatShell />
    </Suspense>
  )
}
