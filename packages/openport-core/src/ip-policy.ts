import net from 'node:net'

function normalizeIp(value: string): string {
  const raw = value.trim()
  if (raw.startsWith('::ffff:')) return raw.slice(7)
  return raw
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4) return null
  for (const p of parts) {
    if (!Number.isInteger(p) || p < 0 || p > 255) return null
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/')
  const bits = Number(bitsRaw)
  if (!base || !Number.isInteger(bits) || bits < 0 || bits > 32) return false
  if (!net.isIPv4(base)) return false

  const ipInt = ipv4ToInt(ip)
  const baseInt = ipv4ToInt(base)
  if (ipInt === null || baseInt === null) return false

  const mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0)
  return (ipInt & mask) === (baseInt & mask)
}

export function isIpAllowed(ip: string, allowed: string[]): boolean {
  const normalizedIp = normalizeIp(ip)
  if (!normalizedIp) return false

  for (const entryRaw of allowed) {
    const entry = normalizeIp(entryRaw)
    if (!entry) continue

    if (entry.includes('/')) {
      if (net.isIPv4(normalizedIp) && ipv4InCidr(normalizedIp, entry)) return true
      continue
    }

    if (entry === normalizedIp) return true
  }

  return false
}
