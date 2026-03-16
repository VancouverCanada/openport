export function getPublicApiBaseUrl(): string {
  return '/api/openport'
}

export function getPublicSocketBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_OPENPORT_SOCKET_BASE_URL?.trim()
  if (explicit) return explicit

  const apiBase = process.env.NEXT_PUBLIC_OPENPORT_API_BASE_URL?.trim()
  if (apiBase) {
    try {
      return new URL(apiBase).origin
    } catch {}
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'http://127.0.0.1:4100'
}
