import { Suspense } from 'react'
import { NotesWorkspace } from '../../../components/notes/notes-workspace'

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="notes-workspace" />}>
      <NotesWorkspace />
    </Suspense>
  )
}
