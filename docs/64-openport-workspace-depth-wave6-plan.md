# OpenPort Workspace Depth Closure Plan (Wave 6)

## Goal

Continue parity closure on the remaining depth gaps with direct Open WebUI references:

- Modalized selector orchestration in Models editor
- Knowledge file/source lifecycle expansion (`Add content`, webpage ingest, directory upload/sync)
- Tools toolkit orchestration visibility

## Open WebUI references

- `src/lib/components/workspace/Models/ModelEditor.svelte`
- `src/lib/components/workspace/Models/ActionsSelector.svelte`
- `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `src/lib/components/workspace/Knowledge/KnowledgeBase/AddContentMenu.svelte`
- `src/lib/components/workspace/Tools/ToolkitEditor.svelte`

## Scope

1. Models modal selectors
   - Add reusable token selector modal.
   - Wire `filters/default filters/actions/default features` to modalized selector workflow.

2. Knowledge lifecycle density
   - Add backend webpage ingestion endpoint.
   - Add `Add content` menu actions:
     - upload files
     - upload directory
     - sync directory
     - add webpage
     - add text
   - Reuse batch-maintain endpoint for sync replacement behavior.

3. Tools orchestration
   - Extend tool editor with orchestration graph preview derived from model bindings.

## Delivery checklist

| Item | Status | Notes |
| --- | --- | --- |
| Wave 6 plan document | done | This file |
| Models modal selector component | done | Added reusable `workspace-token-selector-modal.tsx` |
| Models editor modal selector wiring | done | Applied to filters/default filters/actions/default features |
| Backend webpage ingest API | done | Added `POST /projects/knowledge/web` |
| Frontend knowledge add-content workflow | done | Added content menu + webpage modal + directory upload/sync modal |
| Tools orchestration graph preview | done | Added graph section in `WorkspaceToolEditor` |
| Build verification | done | `npm run build:api` and `npm run build:web` passed |

