'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createOpenPortNote, loadSession } from '../../../../lib/openport-api'
import { emitNotesUpdate } from '../../../../lib/notes-workspace'

export default function NewNotePage() {
  const router = useRouter()

  useEffect(() => {
    void (async () => {
      const seededContent =
        typeof window === 'undefined'
          ? ''
          : new URLSearchParams(window.location.search).get('content')?.trim() || ''
      const { note } = await createOpenPortNote(
        seededContent
          ? {
              contentMd: seededContent
            }
          : {},
        loadSession()
      )
      emitNotesUpdate()
      router.replace(`/dashboard/notes/${note.id}`)
    })()
  }, [router])

  return null
}
