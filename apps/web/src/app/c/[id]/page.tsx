import { redirect } from 'next/navigation'

type ChatCompatPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ChatCompatPage({ params, searchParams }: ChatCompatPageProps) {
  const { id } = await params
  const resolved = await searchParams
  const nextParams = new URLSearchParams()
  nextParams.set('thread', id)

  Object.entries(resolved).forEach(([key, value]) => {
    if (key === 'thread') return

    if (Array.isArray(value)) {
      value.forEach((entry) => nextParams.append(key, entry))
      return
    }

    if (typeof value === 'string') {
      nextParams.set(key, value)
    }
  })

  redirect(`/?${nextParams.toString()}`)
}
