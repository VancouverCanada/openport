# OpenPort App Shell And Project Model Parity Plan

## Goal

Continue the remaining Open WebUI parity checklist by finishing the app-shell layer and by promoting project-level default model selection into a real persisted setting.

## Reference Modules

The implementation direction in this round was taken from local `open-webui-main` modules:

- `src/lib/components/layout/Sidebar.svelte`
- `src/lib/components/chat/Controls/Controls.svelte`
- `src/lib/components/chat/ChatPlaceholder.svelte`

OpenPort does not copy those files directly. The goal is to reuse the same structural ideas:

- a shell-owned sidebar/control state instead of per-page local toggles
- mobile drawer behavior for sidebar and controls
- persistent shell widths/open state
- project-level defaults that influence newly created chats

## Scope

### 1. App shell parity

- move sidebar open state into a shared shell provider
- move controls open state into a shared shell provider
- persist sidebar width/open state
- persist controls width/open state
- support mobile drawer close/backdrop behavior
- support desktop resize handles for sidebar and controls

### 2. Project-level default model route

- extend project DTOs so `defaultModelRoute` is accepted by API create/update flows
- normalize and persist `defaultModelRoute` in the projects service
- expose `defaultModelRoute` in the project modal
- use project defaults when deriving new chat settings for a selected project

## Implemented Files

### App shell

- [apps/web/src/components/app-shell-state.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/app-shell-state.tsx)
- [apps/web/src/components/workspace-app-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-app-shell.tsx)
- [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
- [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
- [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)

### Project default model

- [apps/api/src/projects/dto/create-project.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/create-project.dto.ts)
- [apps/api/src/projects/dto/update-project.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/update-project.dto.ts)
- [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
- [apps/web/src/components/project-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-modal.tsx)
- [apps/web/src/lib/chat-workspace.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-workspace.ts)
- [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)

## Acceptance

- sidebar can be collapsed, reopened, resized, and remembered
- controls panel can be opened, closed, resized, and remembered
- on mobile, sidebar and controls behave like drawers with backdrops
- creating or editing a project can set a default model route
- selecting a project and creating a new chat inherits that project model route unless an explicit chat route override is present
- `npm run build:web` passes
- `npm run build:api` passes
