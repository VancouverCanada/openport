# OpenPort Workspace Depth Closure Plan (Wave 5)

## Goal

Close the remaining high-value parity gaps around editor depth and workflow density, aligned to Open WebUI patterns:

- Models: selector-driven editor sections (instead of text-only token inputs)
- Knowledge: document-centric batch lifecycle operations
- Tools: stronger toolkit orchestration via model bindings

## Open WebUI references

- `src/lib/components/workspace/Models/ModelEditor.svelte`
- `src/lib/components/workspace/Models/ActionsSelector.svelte`
- `src/lib/components/workspace/Models/DefaultFiltersSelector.svelte`
- `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `src/lib/components/workspace/Knowledge/KnowledgeBase/AddContentMenu.svelte`
- `src/lib/components/workspace/Tools/ToolkitEditor.svelte`

## Scope

1. Knowledge batch lifecycle
   - Add backend batch-maintain endpoint for document actions:
     - `reindex`
     - `reset`
     - `rebuild`
     - `move_collection`
     - `delete`
   - Add frontend document selection + batch actions in Workspace Knowledge document view.

2. Models editor depth
   - Replace free-text action/filter/feature editing with selector-style token workflow:
     - suggested options from existing models
     - explicit selected token lists
     - add/remove custom tokens without comma-parsing errors

3. Tools orchestration depth
   - Add model binding section in tool editor:
     - attach tool to model `toolIds`
     - attach as builtin via `builtinToolIds`
   - Persist model binding updates after tool save (create or update path).

## Delivery checklist

| Item | Status | Notes |
| --- | --- | --- |
| Wave 5 plan document | done | This file |
| Backend: knowledge batch maintain endpoint | done | Added `POST /projects/knowledge/batch/maintain` with `reindex/reset/rebuild/move_collection/delete` |
| Frontend: knowledge document batch actions | done | Added document selection, batch toolbar, and move-collection modal in `WorkspaceKnowledge` |
| Frontend: model editor selector-style token workflow | done | Replaced comma text editing with token selectors + suggested tokens from existing models |
| Frontend: tool editor model bindings orchestration | done | Added link/builtin model bindings and post-save synchronization via model updates |
| Progress docs updated | done | 已更新 `docs/15-openport-productization-progress.md` 与 `docs/49-openport-workspace-parity-matrix.md` |
| Build verification | done | `npm run build:api` and `npm run build:web` passed |
