import type { IncomingHttpHeaders } from 'node:http'

export type RequestActor = {
  userId: string
  workspaceId: string
  adminUserId: string
}

export function getHeaderValue(headers: IncomingHttpHeaders | Record<string, unknown>, name: string): string | null {
  const raw = headers[name.toLowerCase()]
  if (Array.isArray(raw)) return raw[0] ? String(raw[0]).trim() : null
  if (typeof raw === 'string') return raw.trim() || null
  return raw ? String(raw).trim() : null
}

export function resolveBearerToken(headers: IncomingHttpHeaders | Record<string, unknown>): string | null {
  const authorization = getHeaderValue(headers, 'authorization')
  if (!authorization) return null
  const [scheme, token] = authorization.split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) return null
  return token.trim()
}

export function resolveActor(headers: IncomingHttpHeaders | Record<string, unknown>): RequestActor {
  return {
    userId: getHeaderValue(headers, 'x-openport-user') || 'user_demo',
    workspaceId: getHeaderValue(headers, 'x-openport-workspace') || 'ws_demo',
    adminUserId: getHeaderValue(headers, 'x-openport-admin-user') || 'admin_demo'
  }
}
