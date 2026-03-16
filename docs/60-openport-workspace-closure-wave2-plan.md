# OpenPort Workspace Closure Wave 2 Plan

## Goal

Complete a second closure pass focused on structural parity and backend enforcement:

1. remove legacy Workspace routes not present in Open WebUI primary structure,
2. convert alias-only function route into a real page surface,
3. move capability gating from UI-only to backend module enforcement,
4. add file-centric quick content entry on Knowledge home.

## Open WebUI references

- `open-webui-main/src/routes/(app)/workspace/+layout.svelte`
- `open-webui-main/src/routes/(app)/workspace/functions/create/+page.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`

## Implemented

### 1) Legacy workspace access route removal

- Removed `apps/web/src/app/workspace/access/page.tsx`
- Result:
  - `/workspace/access` is no longer part of the Workspace router.
  - `/settings/access` remains the single access-management route.

### 2) Functions create route made concrete

- Updated `apps/web/src/app/workspace/functions/create/page.tsx`
- Route now renders a create surface directly via `WorkspaceToolEditor` in function mode.
- Added `resourceKind` support in `WorkspaceToolEditor` to produce function-specific title/copy.

### 3) Backend capability gating hardening

- Added `WorkspacesService.assertWorkspaceModuleAccess(...)` for module-aware permission checks.
- Applied module checks to:
  - `WorkspaceResourcesService` (`models/prompts/tools/skills` read/manage paths),
  - `ProjectsService` knowledge module endpoints (`read/manage` separation).
- This closes the previous gap where non-manage users could still call write APIs directly.

### 4) Knowledge file-centric quick add flow

- `WorkspaceKnowledge` now includes quick actions:
  - `Upload file` (direct upload),
  - `Add text` (modal authoring + save).
- This reduces dependency on route-jump flow and aligns with Open WebUI-style content-first workflow.
- `WorkspaceKnowledgeSourceDetail` linked collection/document actions were normalized to shared `WorkspaceResourceMenu`.

## Verification

- Build:
  - `npm run build:api` passed
  - `npm run build:web` passed
- Docker:
  - `npm run compose:up` passed
  - `npm run health:product` passed
- Runtime checks:
  - `/workspace/functions/create` -> `200`
  - `/workspace/access` -> `404`
  - `/settings/access` -> `200`
  - backend module gate validation:
    - owner can call `/api/workspace/models` (`200`)
    - member role is blocked from `/api/workspace/models` (`403`)
    - member role is blocked from `/api/projects/knowledge` (`403`)

## Status

- Wave status: `done`
- This wave removes remaining structural drift and upgrades module permission gating from UI convention to backend enforcement.
