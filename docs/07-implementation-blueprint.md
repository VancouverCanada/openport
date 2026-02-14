# OpenMCP Implementation Blueprint

This blueprint is the practical path to ship OpenMCP as an independent open-source project without leaking private product details.

## Workstreams

### 1. Protocol and runtime

- keep `spec/openmcp-v1.openapi.yaml` as the source of truth
- maintain stable envelope and error code behavior
- keep draft-first write flows as default
- keep adapter boundaries explicit in TypeScript interfaces

Exit criteria:

- OpenAPI validation passes
- all documented routes are registered
- no breaking contract change without version bump

### 2. Security controls

- token hash storage only (no plaintext persistence)
- key revoke must fail immediately
- workspace boundary checks on every tenant-bound read/write
- high-risk execute path requires explicit auto-exec policy gates
- audit event emitted for allow/deny/fail paths

Exit criteria:

- policy denial tests pass
- key revocation test passes
- high-risk preflight and idempotency tests pass

### 3. Release hygiene and anti-leak safeguards

- automated secret scan in `scripts/safety-check.sh`
- anti-coupling scan blocks product identifiers in OSS tree
- CI gate runs build + test + safety checks
- examples only use placeholders (no private hosts/ids)

Exit criteria:

- `npm run gate` passes on Node 22
- CI status is green for main branch

### 4. Private adapter strategy

- keep private adapter in a separate closed repository
- map private domain APIs to OpenMCP `DomainAdapter`
- never copy private DTOs/business logic into OpenMCP

Exit criteria:

- private adapter compiles against published OpenMCP interfaces
- no private imports or private package dependencies in OpenMCP

## Recommended execution order

1. finalize protocol and runtime invariants
2. lock extraction boundary and anti-leak policy
3. integrate CI release gate
4. add a private adapter in a separate repository
5. run red-team review before `v0.1.0`
