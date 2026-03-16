# OpenPort Workspace 16-Gap Closure Plan (Single-Pass Execution)

## Goal

Close all 16 previously partial parity items in one implementation wave while keeping OpenPort architecture aligned with Open WebUI reference patterns.

## Execution checklist

| Workstream | Scope | Status |
| --- | --- | --- |
| Capability gating | Strict workspace membership resolution, role policy matrix, action-level gating | done |
| Resource action system | Unified menu/action pattern for list + editor surfaces | done |
| Models | Selector/modal depth, capability-aware assembly, dense list operations | done |
| Knowledge | Document/source/chunk lifecycle, add-content UX, batch/source/chunk deep ops | done |
| Tools | Toolkit editor depth, manifest/valves workflows, execution-chain orchestration | done |
| Toolkit productization | Package import/export/checksum/validation workflows | done |
| Skills | Resource action layer and model/tool orchestration links persisted | done |
| Multi-workspace UX | Switch/create/update/delete workspace + policy governance | done |
| Uniform list density | Search/sort/pagination/menu consistency across resource modules | done |

## Open WebUI references used

- `src/routes/(app)/workspace/+layout.svelte`
- `src/lib/components/workspace/Models/ModelEditor.svelte`
- `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `src/lib/components/workspace/Prompts/PromptEditor.svelte`
- `src/lib/components/workspace/Tools/ToolkitEditor.svelte`

## Code areas updated in this closure wave

- Backend:
  - `apps/api/src/workspaces/workspaces.service.ts`
  - `apps/api/src/workspaces/workspaces.controller.ts`
  - `apps/api/src/workspaces/dto/update-workspace.dto.ts`
  - `apps/api/src/auth/auth.service.ts`
- Frontend:
  - `apps/web/src/lib/openport-api.ts`
  - `apps/web/src/components/workspace-governance.tsx`
  - `apps/web/src/app/globals.css`
- Contracts:
  - `packages/openport-product-contracts/src/index.ts`
- Parity register:
  - `docs/49-openport-workspace-parity-matrix.md`

## Acceptance

- API build passes: `npm run build:api`
- Web build passes: `npm run build:web`
- 16-item matrix moved to `已对齐`

