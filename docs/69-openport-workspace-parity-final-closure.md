# OpenPort Workspace Parity Final Closure (2026-03-16)

## Objective

One-pass closure for the remaining parity gaps called out in audit:

1. Identity/workspace persistence still file-first JSON semantics.
2. Knowledge source/chunk ACL still projected from item ACL.
3. Compatibility access route layer still present.
4. OpenPort-specific settings Access IA still exposed as primary entry.

## Implementation plan and completion

| Step | Target | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Persistence backend to postgres-first | done | `apps/api/src/storage/identity-state.service.ts`, `apps/api/src/storage/api-state-store.service.ts` |
| 2 | Independent source/chunk ACL persistence and service wiring | done | `apps/api/src/storage/api-state-store.service.ts`, `apps/api/src/projects/projects.service.ts` |
| 3 | Remove compatibility resource access routes | done | Removed `apps/web/src/app/workspace/{models,prompts,tools,skills}/[id]/access/page.tsx`; menus are modal-only |
| 4 | Remove `/settings/access` IA divergence | done | Removed `apps/web/src/app/settings/access/page.tsx`; `settings-module-nav.tsx` now only exposes `Workspaces` |

## Delivered behavior

- Identity and workspace state can persist in Postgres as the primary backend when DB config is present.
- Source and chunk access grants are first-class persisted ACL records (not item-grant projection).
- Access operations use resource-in-context modal flows; compatibility route layer is removed.
- Settings governance canonical path is `/settings/workspaces`.

## Verification

- `npm --prefix apps/api run build` ✅
- `bash scripts/with-modern-node.sh npm --prefix apps/web run build` ✅
