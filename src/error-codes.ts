export const ErrorCodes = {
  COMMON_VALIDATION: 'common.validation',
  AGENT_TOKEN_INVALID: 'agent.token_invalid',
  AGENT_TOKEN_EXPIRED: 'agent.token_expired',
  AGENT_FORBIDDEN: 'agent.forbidden',
  AGENT_SCOPE_DENIED: 'agent.scope_denied',
  AGENT_POLICY_DENIED: 'agent.policy_denied',
  AGENT_ACTION_UNKNOWN: 'agent.action_unknown',
  AGENT_ACTION_INVALID: 'agent.action_invalid',
  AGENT_DRAFT_NOT_FOUND: 'agent.draft_not_found',
  AGENT_DRAFT_ALREADY_FINAL: 'agent.draft_already_final',
  AGENT_PREFLIGHT_REQUIRED: 'agent.preflight_required',
  AGENT_PREFLIGHT_MISMATCH: 'agent.preflight_mismatch',
  AGENT_PREFLIGHT_NOT_FOUND: 'agent.preflight_not_found',
  AGENT_PRECONDITION_FAILED: 'agent.precondition_failed',
  AGENT_IDEMPOTENCY_REQUIRED: 'agent.idempotency_required',
  AGENT_IDEMPOTENCY_REPLAY: 'agent.idempotency_replay',
  AGENT_AUTO_EXECUTE_DISABLED: 'agent.auto_execute_disabled',
  AGENT_AUTO_EXECUTE_DENIED: 'agent.auto_execute_denied',
  AGENT_AUTO_EXECUTE_EXPIRED: 'agent.auto_execute_expired',
  AGENT_STEP_UP_REQUIRED: 'agent.step_up_required',
  AGENT_STEP_UP_INVALID: 'agent.step_up_invalid',
  AGENT_RATE_LIMITED: 'agent.rate_limited',
  AGENT_NOT_FOUND: 'agent.not_found'
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]
