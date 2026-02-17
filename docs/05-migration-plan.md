# Migration Plan (Source Product -> OpenPort)

## Phase 0: Inventory and boundary lock

- list all source-product AI gateway files and classify as OPEN/ADAPTER/PRIVATE
- define no-export list (schemas, env names, service details)

Exit criteria:
- signed boundary matrix

## Phase 1: Protocol extraction

- publish OpenAPI contract and shared error codes
- publish policy schema and action risk model

Exit criteria:
- contract tests pass against reference stubs

## Phase 2: Core runtime

- implement neutral draft engine and tool registry
- implement audit event model + pluggable sink

Exit criteria:
- end-to-end demo with mock adapters

## Phase 3: Private product adapter

- wire OpenPort interfaces to private auth/tenant/domain services
- keep adapter in private repository

Exit criteria:
- parity with current production integration behavior

## Phase 4: Hardening

- fuzz and abuse tests
- red-team test for cross-tenant isolation
- verify kill-switch and key rotation procedures

Exit criteria:
- security checklist fully green

## Phase 5: Public launch

- publish `v0.1.0`
- open issue templates and governance policy
- publish migration cookbook for adopters

Exit criteria:
- public docs + reproducible sample app
