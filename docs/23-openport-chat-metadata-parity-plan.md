# OpenPort Chat Metadata Parity Plan

## Goal

Bring OpenPort chat persistence closer to Open WebUI's chat model by storing and exposing chat metadata as first-class backend state:

- archived
- pinned
- tags
- project assignment
- title updates

## Open WebUI reference

This phase references the local Open WebUI backend:

- chat model:
  - `/Users/Sebastian/open-webui-main/backend/open_webui/models/chats.py`
- chat routes:
  - `/Users/Sebastian/open-webui-main/backend/open_webui/routers/chats.py`

The important alignment points are:

- metadata belongs to the backend chat record
- archive/pin/folder/tag operations are backend mutations
- list routes support filtered views of chat history

## OpenPort target

### Backend record shape

Each chat session should persist:

- `archived`
- `pinned`
- `tags`
- `settings.projectId`

### API behavior

Add backend metadata update behavior for:

- title
- archived
- pinned
- tags
- project assignment

Add filtered session listing for:

- active chats
- archived chats

### Frontend behavior

- sidebar history renders from backend session metadata
- project membership is derived from `session.settings.projectId`
- archived chat view is a real filtered route state
- active thread supports pin/archive/tag updates

## Implementation phases

### Phase 1. Contracts and persistence

- extend `OpenPortChatSession`
- extend Postgres table columns
- extend file fallback state

### Phase 2. API routes

- add list filter DTO
- add metadata update DTO and route
- keep search aligned with metadata timestamps and project ids

### Phase 3. Frontend wiring

- fetch active vs archived views from API
- derive project chat membership from session metadata
- add pin/archive/tag/title actions in chat UI

## Acceptance criteria

- archived chats are excluded from the default chat list
- archived chats are available via the archived view
- pin state persists across reloads and restart
- tags persist across reloads and restart
- project assignment persists in backend session state
- Docker restart preserves all metadata in Postgres

## Implementation status

Implemented in OpenPort:

- backend metadata DTOs and routes:
  - `GET /api/ai/sessions?archived=true|false`
  - `PATCH /api/ai/sessions/:id/meta`
- Postgres-backed metadata persistence in `openport_chat_sessions`
  - `archived`
  - `pinned`
  - `tags`
  - `settings.projectId`
- frontend archived chat view and metadata controls:
  - pin / archive / restore actions in `Chat`
  - tags editing in `Controls`
  - sidebar list sourced from backend session metadata
  - project membership derived from `session.settings.projectId`

Primary implementation files:

- `apps/api/src/ai/ai.controller.ts`
- `apps/api/src/ai/ai.service.ts`
- `apps/api/src/ai/dto/list-chat-sessions.dto.ts`
- `apps/api/src/ai/dto/update-chat-session-meta.dto.ts`
- `apps/api/src/storage/api-state-store.service.ts`
- `apps/api/src/search/search.service.ts`
- `apps/web/src/lib/openport-api.ts`
- `apps/web/src/lib/workspace-search.ts`
- `apps/web/src/components/workspace-sidebar.tsx`
- `apps/web/src/components/project-tree-item.tsx`
- `apps/web/src/components/chat-shell.tsx`
- `apps/web/src/components/chat-controls-panel.tsx`

Validation completed:

- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`
- created a persisted chat session through `/api/ai/sessions`
- updated `pinned / archived / tags` through `/api/ai/sessions/:id/meta`
- confirmed the row in Postgres includes metadata fields
- restarted `compose-api-1`
- confirmed `GET /api/ai/sessions?archived=true` still returns the archived chat
- confirmed `GET /api/ai/sessions?archived=false` excludes it
