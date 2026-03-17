import { redirect } from 'next/navigation'

type NotesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const resolved = await searchParams
  const rawContent = resolved.content
  const content = Array.isArray(rawContent) ? rawContent[0] : rawContent

  if (typeof content === 'string' && content.trim().length > 0) {
    const params = new URLSearchParams()
    params.set('content', content.trim())
    redirect(`/dashboard/notes/new?${params.toString()}`)
  }

  redirect('/dashboard/notes')
}
