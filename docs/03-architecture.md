# Architecture

## Core idea

OpenMCP separates stable protocol from private implementation.

- Protocol layer is open-source.
- Product identity/data execution remains private through adapters.

## Logical components

1. Gateway API
- Handles auth, request validation, rate limiting, response envelope.

2. Policy Engine
- Evaluates scopes and ABAC restrictions.

3. Tool Registry
- Exposes discoverable tools via manifest.

4. Draft Engine
- Converts risky actions into reviewable drafts.

5. Audit Pipeline
- Emits structured events for every read/action/decision.

6. Adapters
- Tenant resolver
- domain action executors
- notification channels
- persistence backends

## Canonical endpoint set (`v1`)

- `GET /api/agent/v1/manifest`
- `GET /api/agent/v1/ledgers`
- `GET /api/agent/v1/transactions`
- `POST /api/agent/v1/preflight`
- `POST /api/agent/v1/actions`
- `GET /api/agent/v1/drafts/{id}`

Admin side (human-managed):

- app/key lifecycle
- policy/auto-execute config
- draft approve/reject
- audit export and monitoring summaries

## Contract rules

- Stable response envelope:
  - success: `{ ok: true, code, data }`
  - failure: `{ ok: false, code, message, details? }`
- Every action has `risk` and `requiredScopes`.
- High-risk auto-execute requires:
  - explicit enablement
  - short TTL
  - preflight hash
  - idempotency key
  - step-up confirmation
