'use client'

import { useParams } from 'next/navigation'
import { NoteEditor } from '../../../../components/notes/note-editor'

export default function NoteDetailPage() {
  const params = useParams<{ id: string }>()
  const noteId = Array.isArray(params.id) ? params.id[0] : params.id

  return <NoteEditor noteId={noteId} />
}
