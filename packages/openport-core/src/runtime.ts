import { AuditService, InMemoryAuditSink, type AuditSink } from './audit.js'
import { AdminEngine } from './admin-engine.js'
import { AgentEngine } from './agent-engine.js'
import { AgentAuthService } from './auth.js'
import { ContextRiskEngine } from './context-risk.js'
import { CapabilityLeaseEngine } from './capability-lease.js'
import { ProcessLocalActionExecutionCoordinator, type ActionExecutionCoordinator } from './action-execution-coordinator.js'
import type { AgentActionStateStore } from './agent-action-state-store.js'
import type { SingleHostDurableActionExecutor } from './durable-action-executor.js'
import { InMemoryDomainAdapter } from './domain.js'
import { ErrorCodes } from './error-codes.js'
import { OpenPortError } from './errors.js'
import { IntentEngine } from './intent-engine.js'
import { RateLimiter } from './rate-limit.js'
import { RouteEngine } from './route-engine.js'
import { InMemoryStore } from './store.js'
import type { CapabilityLeaseStateStore } from './capability-lease-store.js'
import { AgentToolRegistry } from './tool-registry.js'
import type { DomainAdapter } from './types.js'
import { PostgresDomainAdapter } from './adapters/postgres-domain-adapter.js'

export type OpenPortRuntime = {
  store: InMemoryStore
  actionState: AgentActionStateStore
  domain: DomainAdapter
  tools: AgentToolRegistry
  audit: AuditService
  auth: AgentAuthService
  intent: IntentEngine
  contextRisk: ContextRiskEngine
  route: RouteEngine
  capabilityLease: CapabilityLeaseEngine
  agent: AgentEngine
  admin: AdminEngine
}

export type OpenPortRuntimeOptions = {
  store?: InMemoryStore
  actionStateStore?: AgentActionStateStore
  auditSink?: AuditSink
  capabilityLeaseStateStore?: CapabilityLeaseStateStore
  actionExecutionCoordinator?: ActionExecutionCoordinator
  durableActionExecutor?: SingleHostDurableActionExecutor
  domain?: DomainAdapter
  domainAdapter?: 'memory' | 'postgres'
  postgresConnectionString?: string
}

function createDomainAdapter(options: OpenPortRuntimeOptions): DomainAdapter {
  if (options.domain) return options.domain

  const modeEnv = process.env.OPENPORT_DOMAIN_ADAPTER
  const mode = options.domainAdapter || (modeEnv === 'postgres' ? modeEnv : 'memory')
  if (mode === 'postgres') {
    const connectionString = options.postgresConnectionString || process.env.OPENPORT_DATABASE_URL
    if (!connectionString) {
      throw new OpenPortError(500, ErrorCodes.COMMON_VALIDATION, 'OPENPORT_DATABASE_URL is required when using postgres adapter')
    }
    return new PostgresDomainAdapter({ connectionString })
  }

  return new InMemoryDomainAdapter()
}

export function createOpenPortRuntime(options: OpenPortRuntimeOptions = {}): OpenPortRuntime {
  const store = options.store || new InMemoryStore()
  const actionState = options.actionStateStore || store
  const domain = createDomainAdapter(options)
  const tools = new AgentToolRegistry(domain)
  const audit = new AuditService(options.auditSink || new InMemoryAuditSink())
  const auth = new AgentAuthService(store, new RateLimiter())
  const intent = new IntentEngine(store, audit)
  const contextRisk = new ContextRiskEngine(store, audit)
  const route = new RouteEngine(store, tools, audit, intent, contextRisk)
  const capabilityLease = new CapabilityLeaseEngine(store, tools, audit, intent, contextRisk, options.capabilityLeaseStateStore)
  const actionExecutionCoordinator = options.actionExecutionCoordinator || new ProcessLocalActionExecutionCoordinator()
  const agent = new AgentEngine(
    store,
    domain,
    tools,
    audit,
    intent,
    contextRisk,
    capabilityLease,
    actionExecutionCoordinator,
    actionState,
    options.durableActionExecutor || null
  )
  const admin = new AdminEngine(store, domain, tools, agent, audit, actionState)

  return {
    store,
    actionState,
    domain,
    tools,
    audit,
    auth,
    intent,
    contextRisk,
    route,
    capabilityLease,
    agent,
    admin
  }
}
