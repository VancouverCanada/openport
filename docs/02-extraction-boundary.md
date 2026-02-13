# Extraction Boundary

This document defines what can and cannot be extracted from any private product into OpenPort.

## Investigation summary (source modules)

Main references to review in the source product:

- agent gateway routes and handlers
- policy/permission checks for agent calls
- draft and approval pipelines
- audit logging and export behavior
- related data models used by the agent layer

## Classification rules

Use this label per file/module:

- `OPEN`: safe to publish as generic pattern/spec
- `ADAPTER`: publish interface only, keep implementation private
- `PRIVATE`: never publish directly

## Module classification

### OPEN

- Endpoint patterns: `manifest`, read APIs, action APIs, draft APIs
- Scope checks and policy concepts (ABAC shape)
- Draft execution state machine (draft/confirmed/canceled/failed)
- Audit envelope schema (generic event fields)
- Preflight hash / idempotency concepts

### ADAPTER (interface only)

- Identity & tenant resolution (`user`, `org`, membership checks)
- Domain service calls (finance, org member operations, exports)
- Rate-limit backend implementation
- Email/notification delivery implementation
- SIEM integration and anomaly alert pipelines

### PRIVATE (must not be open-sourced)

- Internal user/org schemas and account lifecycle logic
- Service-account creation details and internal email conventions
- Existing production audit payload formats containing business context
- Product-specific DTOs and business rules tied to the source product
- Environment variable names or infrastructure topology details

## Clean-room extraction protocol

1. Freeze scope: list only conceptual behavior to copy.
2. Define neutral interfaces in OpenPort (`TenantResolver`, `PolicyStore`, `AuditSink`, `ActionExecutor`).
3. Re-implement from spec, not by direct copy-paste of private modules.
4. Red-team review before first public push.

## Data and secret leakage prevention

Required controls:

- no production sample data in repository
- no private hostnames or internal IDs in docs/examples
- no `.env` or test credentials
- mandatory secret scanning in CI
- manual legal/security review before tag `v0.1.0`
