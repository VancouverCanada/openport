export type AgentAppScope = 'personal' | 'workspace'
export type AgentAppStatus = 'active' | 'revoked'

export type DraftStatus = 'draft' | 'confirmed' | 'canceled' | 'failed'
export type ExecutionStatus = 'success' | 'failed'
export type ToolRisk = 'low' | 'medium' | 'high'
export type ContextRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ContextTrust = 'trusted' | 'untrusted' | 'derived' | 'system'
export type ContextAuthorityMode = 'hidden' | 'read_only' | 'draft_only' | 'preflight_required' | 'confirm_required' | 'execute_allowed'
export type ContextSourceLabel =
  | 'trusted_user_instruction'
  | 'trusted_system_policy'
  | 'trusted_admin_policy'
  | 'untrusted_document'
  | 'untrusted_web_content'
  | 'untrusted_tool_output'
  | 'external_message'
  | 'derived_summary'
  | 'model_plan'
  | 'product_preview_block'
  | 'pending_flow_state'
  | 'compute_result'
  | 'provider_fallback_output'
export type IntentClass = 'read' | 'summarize' | 'transform' | 'create' | 'update' | 'delete' | 'export' | 'delegate' | 'admin' | 'unknown'
export type IntentReviewMode = 'allow' | 'draft' | 'preflight' | 'confirm' | 'deny' | 'clarify'

export type ContextSegment = {
  id: string
  source: ContextSourceLabel
  author?: string | null
  trust: ContextTrust
  instructionLike?: boolean
  derivedFrom?: string[]
  hash: string
  ttlSeconds?: number
  createdAt: string
}

export type ContextRiskSnapshot = {
  snapshot_id: string
  app_id: string
  key_id: string
  actor_user_id: string
  session_id: string
  risk: ContextRiskLevel
  score: number
  source_labels: ContextSourceLabel[]
  segment_hashes: string[]
  reasons: string[]
  created_at: string
  expires_at: string | null
}

export type ToolContextRiskPolicy = Partial<Record<ContextRiskLevel, ContextAuthorityMode>> & {
  reasonCodes?: string[]
}

export type IntentCertificate = {
  id: string
  app_id: string
  key_id: string
  actor_user_id: string
  request_hash: string
  request_excerpt: string | null
  intent_classes: IntentClass[]
  resource_bounds: Record<string, unknown>
  effect_bounds: Record<string, unknown>
  confidence: number
  review_mode: IntentReviewMode
  classifier_source: string
  audit_digest: string
  created_at: string
  expires_at: string
  revoked_at: string | null
}

export type AgentDataPolicy = {
  allowed_ledger_ids?: string[]
  allowed_org_ids?: string[]
  max_days?: number
  allow_sensitive_fields?: boolean
}

export type AgentNetworkPolicy = {
  allowed_ips?: string[]
}

export type AgentPolicy = {
  network?: AgentNetworkPolicy
  data?: AgentDataPolicy
}

export type AgentAutoExecute = {
  writes?: {
    enabled?: boolean
    expires_at?: string | null
    allowed_actions?: string[] | null
  }
  high_risk?: {
    enabled?: boolean
    expires_at?: string | null
    require_preflight?: boolean
    require_idempotency?: boolean
    max_export_rows?: number
    allowed_actions?: string[] | null
  }
}

export type AgentApp = {
  id: string
  scope: AgentAppScope
  status: AgentAppStatus
  name: string
  description: string | null
  user_id: string | null
  org_id: string | null
  service_user_id: string | null
  scopes: string[]
  policy: AgentPolicy
  auto_execute: AgentAutoExecute
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AgentKey = {
  id: string
  app_id: string
  name: string
  token_prefix: string
  token_hash: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_by: string | null
  created_at: string
}

export type AgentRequestContext = {
  app: AgentApp
  key: AgentKey
  actorUserId: string
  ip: string | null
  userAgent: string | null
}

export type AgentDraft = {
  id: string
  app_id: string
  key_id: string
  actor_user_id: string
  action_type: string
  payload: Record<string, unknown>
  status: DraftStatus
  requires_confirmation: boolean
  auto_execute_requested: boolean
  request_id: string | null
  idempotency_key: string | null
  justification: string | null
  preflight: Record<string, unknown> | null
  preflight_hash: string | null
  preflight_state_witness: Record<string, unknown> | null
  preflight_state_witness_hash: string | null
  policy_snapshot: Record<string, unknown> | null
  confirmed_by_user_id: string | null
  created_at: string
  updated_at: string
  confirmed_at: string | null
  canceled_at: string | null
}

export type AgentExecution = {
  id: string
  draft_id: string
  app_id: string
  idempotency_key: string | null
  status: ExecutionStatus
  result: Record<string, unknown> | null
  error: string | null
  created_at: string
}

export type AgentAuditLog = {
  id: string
  app_id: string | null
  key_id: string | null
  actor_user_id: string | null
  performed_by_user_id: string | null
  action: string
  status: 'success' | 'failed' | 'denied'
  code: string | null
  request_id: string | null
  draft_id: string | null
  execution_id: string | null
  ip: string | null
  user_agent: string | null
  details: Record<string, unknown> | null
  created_at: string
  prev_event_hash: string | null
  event_hash: string
}

export type Ledger = {
  id: string
  name: string
  currency_home: string
  tz: string
  organization_id: string | null
}

export type Transaction = {
  id: string
  ledger_id: string
  kind: 'income' | 'expense' | 'transfer' | 'adjustment'
  title: string
  amount_home: number
  currency_home: string
  date: string
  notes: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export type ListTransactionsInput = {
  ledgerId: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export type DomainAdapter = {
  listLedgers: (actorUserId: string) => Promise<Ledger[]>
  listTransactions: (actorUserId: string, input: ListTransactionsInput) => Promise<{ items: Transaction[]; total: number; page: number; pageSize: number; hasMore: boolean }>
  createTransaction: (actorUserId: string, payload: Record<string, unknown>) => Promise<Transaction>
  updateTransaction: (actorUserId: string, transactionId: string, payload: Record<string, unknown>) => Promise<Transaction>
  softDeleteTransaction: (actorUserId: string, transactionId: string) => Promise<{ id: string; deleted: true }>
  hardDeleteTransaction: (actorUserId: string, transactionId: string) => Promise<{ id: string; deleted: true; hard: true }>
  getTransactionById: (actorUserId: string, transactionId: string) => Promise<Transaction | null>
  close?: () => Promise<void>
}

export type AgentManifestTool = {
  name: string
  description: string
  requiredScopes: string[]
  risk: ToolRisk
  requiresConfirmation: boolean
  contextRiskPolicy?: ToolContextRiskPolicy
  http?: {
    method: 'GET' | 'POST' | 'PATCH'
    path: string
    notes?: string
  }
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
}

export type AgentActionTool = AgentManifestTool & {
  kind: 'action'
  computeImpact?: (ctx: AgentRequestContext, payload: Record<string, unknown>, deps: { domain: DomainAdapter }) => Promise<Record<string, unknown>>
  computeStateWitness?: (ctx: AgentRequestContext, payload: Record<string, unknown>, deps: { domain: DomainAdapter }) => Promise<Record<string, unknown> | null>
  execute: (ctx: AgentRequestContext, payload: Record<string, unknown>, deps: { domain: DomainAdapter }, opts: { confirmedByUserId: string | null }) => Promise<Record<string, unknown>>
}

export type StepUpSession = {
  id: string
  user_id: string
  code: string
  expires_at: string
  consumed_at: string | null
}

export type StepUpToken = {
  id: string
  user_id: string
  expires_at: string
}
