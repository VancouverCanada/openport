# OpenPort Workspace Depth Closure Plan (Wave 7)

## Goal

Close the latest high-gap parity items against Open WebUI workspace patterns with one implementation wave:

- Models: access-aware resource selectors (knowledge/tools/skills) using unified modal flows
- Knowledge: list pagination/sorting and a denser source lifecycle operations panel
- Tools: multi-tool execution chain orchestration with persisted backend state

## Open WebUI references

- `src/lib/components/workspace/Models/ModelEditor.svelte`
- `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `src/lib/components/workspace/Tools/ToolkitEditor.svelte`

## Scope

1. Models access-aware selector unification
   - Add a reusable resource selector modal (search + permission chips + grouped metadata).
   - Replace inline checklist selection for `knowledge/tools/skills` in `WorkspaceModelEditor`.
   - Resolve per-resource effective access from grants (user/workspace/public/group) for display and safer selection context.

2. Knowledge operational density
   - Add sorting and pagination controls for documents/sources/chunks views.
   - Add a source lifecycle modal panel with consolidated operations:
     - reindex
     - reset
     - rebuild
     - remove
     - replace source content
   - Keep operation execution on existing backend endpoints (`maintainProjectKnowledgeSourceBatch`).

3. Tools execution chain orchestration
   - Extend workspace tool schema/contracts with an `executionChain` object.
   - Persist `executionChain` through API state store for file and postgres backends.
   - Extend toolkit package import/export and validation to include execution chain payload.
   - Add editor section for chain steps (`tool target`, `mode`, `when`, `condition`, `outputKey`) and graph preview.

## Delivery checklist

| Item | Status | Notes |
| --- | --- | --- |
| Wave 7 plan document | done | This file |
| Models unified resource selector modal | done | Added `workspace-resource-selector-modal.tsx` and wired `knowledge/tools/skills/builtin` selectors in `WorkspaceModelEditor` with access-aware badges |
| Knowledge pagination/sorting | done | Added per-view sorting and pagination controls in `WorkspaceKnowledge` |
| Knowledge source lifecycle panel | done | Added `workspace-knowledge-source-lifecycle-modal.tsx` with `reindex/reset/rebuild/remove/replace` batch actions |
| Tools execution chain contracts/API/store | done | Extended contracts + DTO/service + file/postgres state store (`executionChain`) |
| Tools editor execution chain UI | done | Added chain builder section and orchestration graph nodes in `WorkspaceToolEditor` |
| Build verification (`build:api`, `build:web`) | done | Both builds pass after Wave 7 changes |
