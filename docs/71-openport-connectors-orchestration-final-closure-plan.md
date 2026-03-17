# OpenPort Connectors + Toolkit Orchestration Final Closure Plan

## Goal

Close the remaining high-value parity gaps in one pass for:

1. External connector full lifecycle:
   - credential management
   - scheduled + incremental sync
   - retry flow
   - task status + audit ledger
   - expanded source adapters
2. Toolkit orchestration runtime depth:
   - DAG-like chain execution runtime
   - step-level debug/replay snapshots
   - branch/condition visibility
   - runtime orchestration control panel APIs + UI

Open WebUI reference direction:
- workspace modular resource flows
- modal/action-driven operations
- runtime status surfaces bound to persistent backend state

## Scope

### A) External Connectors

- Add workspace connectors resource with adapters:
  - `directory`
  - `web`
  - `s3`
  - `github`
  - `notion`
  - `rss`
- Add connector credentials resource with masked field exposure.
- Add connector task queue model:
  - `queued` / `running` / `success` / `failed` / `cancelled`
  - trigger: `manual` / `schedule` / `retry`
  - mode: `full` / `incremental`
- Add scheduler tick for due connector schedules.
- Add retry handling:
  - auto-schedule retry by policy
  - manual retry endpoint
- Add connector audit event ledger with task-linked events.

### B) Toolkit Orchestration Runtime

- Add orchestration run resource per tool:
  - run metadata + trigger + status
  - per-step execution snapshots
  - condition evaluation + branch path
  - replay support from prior run
- Add orchestration runtime panel APIs:
  - launch run
  - list runs
  - inspect run detail
  - replay run
  - cancel run

### C) Persistence

- Extend `ApiStateStoreService` for file + postgres persistence:
  - connectors
  - connector credentials
  - connector tasks
  - connector audit events
  - tool orchestration runs
- Add required postgres tables + indexes.

### D) Web UI

- Add `Workspace > Knowledge > Connectors` route/page and manager.
- Add connector credentials manager + connector editor + task/audit views.
- Extend `Workspace > Tools > Editor` with orchestration runtime control panel:
  - trigger run
  - inspect steps
  - replay/cancel
  - branch/condition visualization

## Implementation Order

1. Contracts and API DTO/controller/service endpoints.
2. Storage persistence in file/postgres backends.
3. Scheduler + runtime runners.
4. Web API client wrappers.
5. Knowledge connectors UI + tools orchestration runtime UI.
6. Docs + build verification.

## Progress

- [x] Plan document created.
- [x] Contracts and DTOs updated.
- [x] API connector lifecycle endpoints implemented.
- [x] API orchestration runtime endpoints implemented.
- [x] State store persistence extended (file + postgres).
- [x] Knowledge connectors UI implemented.
- [x] Tool orchestration runtime panel implemented.
- [x] Parity/progress docs updated.
- [x] Build verification passed.

## Final hard-closure notes (2026-03-16)

- State store now includes connector credentials/connectors/tasks/audit/tool-runs read-write + workspace index listing for both file and postgres backends.
- Connector/task/audit and tool-run APIs are build-clean and wired through workspace resources service.
- Knowledge connectors route import path and connector adapter typing issues in web were fixed.
- Canonical chat entry remains `/`; compatibility `/chat` route stays as redirect only.

## Verification

- `npm --prefix packages/openport-product-contracts run build` ✅
- `npm --prefix apps/api run build` ✅
- `bash scripts/with-modern-node.sh npm --prefix apps/web run build` ✅
