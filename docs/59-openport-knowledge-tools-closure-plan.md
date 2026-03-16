# OpenPort Knowledge/Tools Final Closure Plan (5-Run Target)

## Goal

Within the remaining implementation window, close the highest-value Open WebUI parity gaps in one convergence wave:

1. `Knowledge`: complete source lifecycle batch flow (`replace/remove/rebuild/reindex/reset`).
2. `Knowledge`: complete chunk deep operations (`chunking strategy`, batch rebuild, hit-quality statistics).
3. `Tools`: deepen toolkit editor with stronger `manifest/valves/schema` validation loop.
4. `Global`: unify resource action menu behavior and module capability gating.

## Open WebUI references

- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `open-webui-main/src/lib/components/workspace/Tools/ToolkitEditor.svelte`
- `open-webui-main/src/lib/components/workspace/PromptMenu.svelte`
- `open-webui-main/src/lib/components/workspace/SkillMenu.svelte`

## Implementation order

1. Knowledge source lifecycle batch completion (backend + web).
2. Knowledge chunk deep operations completion (backend + web).
3. Tools validation/editor depth completion.
4. Global menu + capability gating unification.
5. Build/runtime verification and parity matrix/progress sync.

## Implemented in this wave

### 1) Knowledge source lifecycle batch completion

- Added source batch `rebuild` support in existing batch endpoint:
  - `POST /api/projects/knowledge/sources/:sourceId/batch`
  - actions now: `reindex | reset | remove | replace | rebuild`
- `WorkspaceKnowledgeSourceDetail` now supports:
  - batch rebuild modal with chunking options
  - batch reindex/reset/remove/replace orchestration via backend batch endpoint
  - per-document rebuild in linked document list

### 2) Knowledge chunk deep operations completion

- Added per-item rebuild endpoint:
  - `POST /api/projects/knowledge/:itemId/rebuild`
- Added batch rebuild endpoint:
  - `POST /api/projects/knowledge/batch/rebuild`
- Added chunk stats endpoint:
  - `GET /api/projects/knowledge/chunks/stats`
- Extended chunking strategy options in backend:
  - `strategy: balanced | dense | sparse | semantic`
  - `chunkSize`, `overlap`, `maxChunks`
- `WorkspaceKnowledge` now includes:
  - global chunk health stats cards
  - batch rebuild modal for current filtered/visible set
  - source lifecycle actions in source ledger via shared resource menu
- `WorkspaceKnowledgeChunkDetail` now includes:
  - document rebuild modal
  - retrieval probe summary (`totalMatches/maxScore/averageScore`)

### 3) Tools editor depth completion

- Added toolkit validation endpoint:
  - `POST /api/workspace/tools/validate`
- Added server-side validation report generation:
  - manifest required keys
  - schema duplicate keys
  - required schema coverage
  - unknown runtime valves
  - typed value checks (`number/boolean/json`)
- `WorkspaceToolEditor` now supports:
  - pre-save validation gate
  - explicit “Validate toolkit” action
  - validation report section (errors/warnings/coverage)
  - “Apply schema defaults” runtime helper

### 4) Global menu + capability gating unification

- Capability gating:
  - added `canManageWorkspaceModule()` and exposed `canManageModule()` in authority hook
  - management actions in `Models/Knowledge/Prompts/Tools/Skills` now use module-level gating
  - Knowledge source/chunk detail write actions are now consistently gated
- Resource menu behavior:
  - shared `WorkspaceResourceMenu` no longer hides disabled actions
  - disabled actions now stay visible in menu (consistent operational affordance)

## Verification

- `npm run build:api` -> pass
- `npm run build:web` -> pass

## Status

- Wave status: `done`
- This wave closes the requested Knowledge/Tools/global convergence set and updates matrix/progress tracking for next parity sweep.
