# OpenMCP As An MCP Security + Governance Profile

Stewardship: **Accentrust Inc.** and **Sebastian Zhu**.

## Positioning

OpenMCP is best understood as an **MCP server profile**:

- MCP provides the base paradigm: a server exposes machine-readable tools (name, description, input/output schemas) that clients can discover and call.
- OpenMCP adds the missing production requirements: **authorization**, **risk-gated writes**, **auditability**, and **rate limiting**.

In other words: OpenMCP does not try to replace MCP's tool discovery. It defines a security and governance layer that makes MCP-style tool exposure safe in real systems.

## Relationship to WebMCP

WebMCP can be viewed as an MCP-style server surface in the browser:

- tools live in client-side scripts
- agents discover tools and call them without DOM scraping

OpenMCP focuses on **server-side automation** and central governance:

- cross-model, cross-runtime compatibility (workers, queues, scheduled jobs, automation platforms)
- centralized revocation, quotas, and audit export
- server-enforced tenant and policy boundaries

## Core extensions (tool metadata)

OpenMCP treats the following fields as first-class tool metadata, beyond basic MCP tool descriptors:

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

These fields can be carried inside MCP tool definitions (as extension fields) or returned by a manifest endpoint when integrating OpenMCP over HTTP.

## Server-side invariants (must-haves)

An implementation claiming OpenMCP compatibility MUST enforce:

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

OpenMCP should ship as testable profiles:

1. `core`: endpoint presence + envelope consistency
2. `authz`: scope and policy denials + revocation behavior
3. `writes`: draft-first and high-risk safeguards
4. `abuse`: rate limits and non-5xx fuzz regression

The repository already includes a minimal `core` conformance runner; the next step is to add `authz` and `abuse` profiles.
