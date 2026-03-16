export type ApiRuntimeEnv = {
  port: number
  host: string
  domainAdapter: 'memory' | 'postgres'
  databaseUrl: string | null
  apiStateBackend: 'file' | 'postgres'
  apiStateFile: string | null
}

function parsePort(raw: string | undefined, fallback: number): number {
  const value = Number(raw || fallback)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid PORT value: ${raw || fallback}`)
  }
  return Math.trunc(value)
}

export function resolveApiRuntimeEnv(): ApiRuntimeEnv {
  const domainAdapter = process.env.OPENPORT_DOMAIN_ADAPTER === 'postgres' ? 'postgres' : 'memory'
  const databaseUrl = process.env.OPENPORT_DATABASE_URL?.trim() || null
  const apiStateBackend = process.env.OPENPORT_API_STATE_BACKEND === 'postgres' ? 'postgres' : 'file'
  const apiStateFile = process.env.OPENPORT_API_STATE_FILE?.trim() || null

  if (domainAdapter === 'postgres' && !databaseUrl) {
    throw new Error('OPENPORT_DATABASE_URL is required when OPENPORT_DOMAIN_ADAPTER=postgres')
  }

  if (apiStateBackend === 'postgres' && !databaseUrl) {
    throw new Error('OPENPORT_DATABASE_URL is required when OPENPORT_API_STATE_BACKEND=postgres')
  }

  return {
    port: parsePort(process.env.PORT, 4000),
    host: process.env.HOST?.trim() || '0.0.0.0',
    domainAdapter,
    databaseUrl,
    apiStateBackend,
    apiStateFile
  }
}
