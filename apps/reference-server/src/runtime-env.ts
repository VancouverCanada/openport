export type ReferenceRuntimeEnv = {
  port: number
  host: string
  domainAdapter: 'memory' | 'postgres'
  databaseUrl: string | null
}

function parsePort(raw: string | undefined, fallback: number): number {
  const value = Number(raw || fallback)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid PORT value: ${raw || fallback}`)
  }
  return Math.trunc(value)
}

export function resolveReferenceRuntimeEnv(): ReferenceRuntimeEnv {
  const domainAdapter = process.env.OPENPORT_DOMAIN_ADAPTER === 'postgres' ? 'postgres' : 'memory'
  const databaseUrl = process.env.OPENPORT_DATABASE_URL?.trim() || null

  if (domainAdapter === 'postgres' && !databaseUrl) {
    throw new Error('OPENPORT_DATABASE_URL is required when OPENPORT_DOMAIN_ADAPTER=postgres')
  }

  return {
    port: parsePort(process.env.REFERENCE_PORT || process.env.PORT, 8080),
    host: process.env.REFERENCE_HOST?.trim() || process.env.HOST?.trim() || '127.0.0.1',
    domainAdapter,
    databaseUrl
  }
}
