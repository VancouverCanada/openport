# OpenPort Workspace Parity Final Acceptance

Date: 2026-03-16

## Acceptance scope

This acceptance is for the OpenPort OSS workspace parity target (Open WebUI-aligned interaction model, not byte-level code identity).

## 16-item closure result

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Workspace capability gating depth | done | `apps/api/src/workspaces/workspaces.service.ts`, `apps/web/src/lib/workspace-permissions.ts` |
| 2 | Unified resource menu/action system | done | `apps/web/src/components/workspace-resource-menu.tsx` + module menus |
| 3 | Models editor selector depth | done | `apps/web/src/components/workspace-model-editor.tsx` |
| 4 | Models list operation density | done | `apps/web/src/components/workspace-models.tsx` |
| 5 | Knowledge top-level workflow depth | done | `apps/web/src/components/workspace-knowledge.tsx` |
| 6 | Knowledge document lifecycle | done | `apps/web/src/components/workspace-knowledge-detail.tsx`, `apps/api/src/projects/projects.service.ts` |
| 7 | Knowledge source lifecycle orchestration | done | `apps/web/src/components/workspace-knowledge-source-detail.tsx`, `apps/api/src/projects/projects.service.ts` |
| 8 | Knowledge chunk governance depth | done | `apps/web/src/components/workspace-knowledge-chunk-detail.tsx`, `apps/api/src/projects/projects.service.ts` |
| 9 | File-centric add-content UX | done | `apps/web/src/components/workspace-knowledge-add-content-menu.tsx` |
| 10 | Tools toolkit editor assembly depth | done | `apps/web/src/components/workspace-tool-editor.tsx` |
| 11 | Toolkit packaging workflow | done | `apps/web/src/components/workspace-tool-editor.tsx`, `apps/api/src/workspace-resources/workspace-resources.service.ts` |
| 12 | Skills operation layer depth | done | `apps/web/src/components/workspace-skills.tsx` |
| 13 | Skills with models/tools orchestration links | done | `apps/web/src/components/workspace-skill-editor.tsx`, `apps/api/src/workspace-resources/workspace-resources.service.ts` |
| 14 | Multi-workspace governance UX | done | `apps/web/src/components/workspace-sidebar.tsx`, `apps/web/src/components/workspace-governance.tsx` |
| 15 | Cross-list interaction consistency | done | models/prompts/tools/skills/knowledge list pages |
| 16 | Overall asset-workbench interaction model | done | `apps/web/src/components/chat-shell.tsx`, workspace module pages |

## Hard-closure checks completed this round

- Chat canonical entry unified to `/`; compatibility routes redirect to `/`.
  - `apps/web/src/app/chat/page.tsx`
  - `apps/web/src/app/dashboard/chat/page.tsx`
  - `apps/web/src/components/workspace-search-modal.tsx`
- Workspace sidebar `Workspace` entry now lands on a real Workspace models page (`/workspace`) instead of an empty redirect shell.
  - `apps/web/src/app/workspace/page.tsx`
  - `apps/web/src/app/workspace/models/page.tsx`
  - `apps/web/src/lib/workspace-permissions.ts`
- `access` module removed from workspace capability policy surfaces.
  - `packages/openport-product-contracts/src/index.ts`
  - `apps/api/src/workspaces/dto/update-workspace-capability-policy.dto.ts`
  - `apps/api/src/workspaces/workspaces.service.ts`
  - `apps/web/src/lib/workspace-permissions.ts`
- Source/chunk ACL lookup decoupled from item projection; now checks independent resource existence.
  - `apps/api/src/projects/projects.service.ts`
- Connector/task/audit/tool-run persistence interfaces completed for file+postgres state store.
  - `apps/api/src/storage/api-state-store.service.ts`

## Build verification

- `npm --prefix packages/openport-product-contracts run build` passed.
- `npm --prefix apps/api run build` passed.
- `bash scripts/with-modern-node.sh npm --prefix apps/web run build` passed.

## Residual intentional differences

- `/chat` and `/dashboard/chat` remain as compatibility redirect routes for migration safety; primary entry is `/`.
- OpenPort keeps product-specific naming/branding and deployment defaults while aligning workspace interaction structure.

## Acceptance verdict

GO for parity closure in OSS scope.
