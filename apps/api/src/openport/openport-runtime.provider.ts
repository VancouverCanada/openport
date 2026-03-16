import { createOpenPortRuntime, type OpenPortRuntimeOptions } from '@openport/core'

export const OPENPORT_RUNTIME = Symbol('OPENPORT_RUNTIME')

function resolveRuntimeOptions(): OpenPortRuntimeOptions {
  const mode = process.env.OPENPORT_DOMAIN_ADAPTER
  if (mode === 'postgres') {
    return {
      domainAdapter: 'postgres',
      postgresConnectionString: process.env.OPENPORT_DATABASE_URL
    }
  }

  return {
    domainAdapter: 'memory'
  }
}

export const openPortRuntimeProvider = {
  provide: OPENPORT_RUNTIME,
  useFactory: () => createOpenPortRuntime(resolveRuntimeOptions())
}
