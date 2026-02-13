import crypto from 'node:crypto'

export function nowIso(): string {
  return new Date().toISOString()
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

export function base64Url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function generateToken(): string {
  return `op_${base64Url(crypto.randomBytes(32))}`
}

export function readBearerToken(value?: string | null): string | null {
  const raw = (value || '').trim()
  if (!raw) return null
  const parts = raw.split(' ')
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1].trim()
  return null
}

export function getClientIp(input: string): string {
  return input.split(',')[0]?.trim() || ''
}

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value)
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

export function parseDate(value?: string | null, isEnd = false): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  if (isEnd && value.length <= 10) {
    date.setHours(23, 59, 59, 999)
  }
  return date
}

export function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n') || raw.includes('\r')) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export function ensureStringArray(value: unknown, max = 60): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const list = value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, max)
  return list
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.trunc(n), min), max)
}

export function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false
  const t = new Date(expiresAt).getTime()
  if (!Number.isFinite(t)) return true
  return t <= Date.now()
}
