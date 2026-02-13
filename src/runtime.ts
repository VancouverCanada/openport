import { AuditService, InMemoryAuditSink } from './audit.js'
import { AdminEngine } from './admin-engine.js'
import { AgentEngine } from './agent-engine.js'
import { AgentAuthService } from './auth.js'
import { InMemoryDomainAdapter } from './domain.js'
import { OpenPortError } from './errors.js'
import { ErrorCodes } from './error-codes.js'
import { RateLimiter } from './rate-limit.js'
import { InMemoryStore } from './store.js'
import { AgentToolRegistry } from './tool-registry.js'
import type { DomainAdapter } from './types.js'
import { PostgresDomainAdapter } from './adapters/postgres-domain-adapter.js'
import { PrismaDomainAdapter, type OpenPortPrismaClient } from './adapters/prisma-domain-adapter.js'

export type OpenPortRuntime = {
  store: InMemoryStore
  domain: DomainAdapter
  tools: AgentToolRegistry
  audit: AuditService
  auth: AgentAuthService
  agent: AgentEngine
  admin: AdminEngine
}

export type OpenPortRuntimeOptions = {
  domain?: DomainAdapter
  domainAdapter?: 'memory' | 'postgres' | 'prisma'
  postgresConnectionString?: string
  prismaClient?: OpenPortPrismaClient
}

function createDomainAdapter(options: OpenPortRuntimeOptions): DomainAdapter {
  if (options.domain) return options.domain

  const modeEnv = process.env.OPENPORT_DOMAIN_ADAPTER
  const mode = options.domainAdapter || (modeEnv === 'postgres' || modeEnv === 'prisma' ? modeEnv : 'memory')
  if (mode === 'postgres') {
    const connectionString = options.postgresConnectionString || process.env.OPENPORT_DATABASE_URL
    if (!connectionString) {
      throw new OpenPortError(500, ErrorCodes.COMMON_VALIDATION, 'OPENPORT_DATABASE_URL is required when using postgres adapter')
    }
    return new PostgresDomainAdapter({ connectionString })
  }

  if (mode === 'prisma') {
    if (!options.prismaClient) {
      throw new OpenPortError(500, ErrorCodes.COMMON_VALIDATION, 'prismaClient is required when using prisma adapter')
    }
    return new PrismaDomainAdapter(options.prismaClient)
  }

  return new InMemoryDomainAdapter()
}

export function createOpenPortRuntime(options: OpenPortRuntimeOptions = {}): OpenPortRuntime {
  const store = new InMemoryStore()
  const domain = createDomainAdapter(options)
  const tools = new AgentToolRegistry(domain)
  const audit = new AuditService(new InMemoryAuditSink())
  const auth = new AgentAuthService(store, new RateLimiter())
  const agent = new AgentEngine(store, domain, tools, audit)
  const admin = new AdminEngine(store, domain, tools, agent, audit)

  return {
    store,
    domain,
    tools,
    audit,
    auth,
    agent,
    admin
  }
}
