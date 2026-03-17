import { redirect } from 'next/navigation'

type DashboardChatPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardChatPage({ searchParams }: DashboardChatPageProps) {
  const resolved = await searchParams
  const nextParams = new URLSearchParams()

  Object.entries(resolved).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => nextParams.append(key, entry))
      return
    }

    if (typeof value === 'string') {
      nextParams.set(key, value)
    }
  })

  redirect(nextParams.size > 0 ? `/?${nextParams.toString()}` : '/')
}
