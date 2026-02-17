# OpenPort As An MCP Security + Governance Profile

Stewardship: **Accentrust** and the OpenPort authors (**Genliang Zhu**, **Chu Wang**, **Ziyuan Wang**, **Zhida Li**).

## Positioning

OpenPort is best understood as an **MCP server profile**:

- MCP provides the base paradigm: a server exposes machine-readable tools (name, description, input/output schemas) that clients can discover and call.
- OpenPort adds the missing production requirements: **authorization**, **risk-gated writes**, **auditability**, and **rate limiting**.

In other words: OpenPort does not try to replace MCP's tool discovery. It defines a security and governance layer that makes MCP-style tool exposure safe in real systems.

## Relationship to WebMCP

WebMCP can be viewed as an MCP-style server surface in the browser:

- tools live in client-side scripts
- agents discover tools and call them without DOM scraping

OpenPort focuses on **server-side automation** and central governance:

- cross-model, cross-runtime compatibility (workers, queues, scheduled jobs, automation platforms)
- centralized revocation, quotas, and audit export
- server-enforced tenant and policy boundaries

## Core extensions (tool metadata)

OpenPort treats the following fields as first-class tool metadata, beyond basic MCP tool descriptors:

- `risk`: `low | medium | high`
- `requiredScopes`: string array
- `requiresConfirmation`: boolean
- `draftPolicy`:
  - `defaultMode`: `draft | execute`
  - `highRiskRequiresPreflight`: boolean
  - `highRiskRequiresIdempotency`: boolean
  - `highRiskRequiresJustification`: boolean
- `rateLimitHints`:
  - `bucket`: string
  - `limitPerMinute`: number

These fields can be carried inside MCP tool definitions (as extension fields) or returned by a manifest endpoint when integrating OpenPort over HTTP.

## Server-side invariants (must-haves)

An implementation claiming OpenPort compatibility MUST enforce:

- Deny-by-default: no scope implies no access.
- Tenant/workspace boundary: every read/write must be bound to server-verified tenant context.
- Revocation immediacy: revoked keys fail immediately (no caching loopholes).
- Draft-first writes by default; explicit enablement required for any auto-execute.
- High-risk write safeguards:
  - preflight hash binding (when enabled)
  - idempotency keys (when enabled)
  - justification required for high-risk execution
  - short-lived authorization windows
- Audit on allow/deny/fail paths with stable reason codes.
- Rate limiting / quotas on machine traffic.

## Conformance

OpenPort should ship as testable profiles:

1. `core`: endpoint presence + envelope consistency
2. `authz`: scope and policy denials + revocation behavior
3. `writes`: draft-first and high-risk safeguards
4. `abuse`: rate limits and non-5xx fuzz regression
5. `state-witness` (optional stronger governance profile): execute-time precondition checks against server-observed resource state

The repository already includes a minimal `core` conformance runner; the next step is to add `authz` and `abuse` profiles.

## Optional strong profile: State Witness / Preconditions

This profile addresses TOCTOU between preflight and execute, including delayed human approvals.

- `POST /preflight` MAY return `stateWitness` and `stateWitnessHash`.
- `POST /actions` MAY receive `stateWitnessHash`; implementations SHOULD also support `preflightId` so clients can avoid payload regeneration.
- If a draft is bound to `preflight_state_witness_hash`, `executeDraft` MUST recompute the current witness and fail closed when mismatch occurs.
- Recommended denial code: `agent.precondition_failed`.

The profile is intentionally optional for broad ecosystem compatibility, but strongly recommended for high-risk write actions.
