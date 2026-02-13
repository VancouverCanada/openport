import { AuditService, InMemoryAuditSink } from './audit.js'
import { AdminEngine } from './admin-engine.js'
import { AgentEngine } from './agent-engine.js'
import { AgentAuthService } from './auth.js'
import { InMemoryDomainAdapter } from './domain.js'
import { RateLimiter } from './rate-limit.js'
import { InMemoryStore } from './store.js'
import { AgentToolRegistry } from './tool-registry.js'

export type OpenPortRuntime = {
  store: InMemoryStore
  domain: InMemoryDomainAdapter
  tools: AgentToolRegistry
  audit: AuditService
  auth: AgentAuthService
  agent: AgentEngine
  admin: AdminEngine
}

export function createOpenPortRuntime(): OpenPortRuntime {
  const store = new InMemoryStore()
  const domain = new InMemoryDomainAdapter()
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
