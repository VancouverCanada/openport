# OpenPort Folder Project Parity Plan

## Goal

Close the next remaining Open WebUI gap by making `Projects` behave more like Open WebUI's folder layer while preserving OpenPort naming.

## Reference Modules

Primary local references used for this pass:

- `src/lib/components/layout/Sidebar.svelte`
- `src/lib/components/layout/Sidebar/Folders.svelte`
- `backend/open_webui/models/folders.py`
- `backend/open_webui/routers/folders.py`

The implementation in OpenPort follows those ideas without copying the Svelte code directly:

- project/folder state should be durable, not only local UI state
- root-level reorganization should be easy from the sidebar
- folder/project actions should exist in compact context menus rather than separate management screens

## Scope

### 1. Persist project expansion state

- accept `isExpanded` in project create/update DTOs
- persist `isExpanded` in the backend project service
- update sidebar expand/collapse to write through to API instead of staying cache-only

### 2. Root-level folder/project movement

- allow dropping a project onto `All chats` to move it back to root
- allow dropping a chat onto `All chats` to remove its project assignment
- show root drop feedback in the sidebar

### 3. Richer folder/project context menu

- add `Move To Root` for nested projects
- keep create/edit/export/delete in compact sidebar menu form

## Implemented Files

- [apps/api/src/projects/dto/create-project.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/create-project.dto.ts)
- [apps/api/src/projects/dto/update-project.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/update-project.dto.ts)
- [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
- [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
- [apps/web/src/lib/chat-workspace.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-workspace.ts)
- [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
- [apps/web/src/components/project-tree-item.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-tree-item.tsx)
- [apps/web/src/components/project-menu.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-menu.tsx)
- [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)

## Acceptance

- project expand/collapse survives refresh and event-driven sidebar reloads
- nested projects can be moved back to root from the context menu
- dragging a project onto `All chats` re-roots it
- dragging a chat onto `All chats` removes its project assignment
- `npm run build:web` passes
- `npm run build:api` passes

