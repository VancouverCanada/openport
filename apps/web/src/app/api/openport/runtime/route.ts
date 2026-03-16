const PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_OPENPORT_API_BASE_URL?.trim() ||
  'http://127.0.0.1:4100/api'

const PUBLIC_SOCKET_BASE_URL =
  process.env.NEXT_PUBLIC_OPENPORT_SOCKET_BASE_URL?.trim() ||
  (() => {
    try {
      return new URL(PUBLIC_API_BASE_URL).origin
    } catch {
      return 'http://127.0.0.1:4100'
    }
  })()

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return Response.json({
    apiBaseUrl: PUBLIC_API_BASE_URL,
    socketBaseUrl: PUBLIC_SOCKET_BASE_URL
  })
}
