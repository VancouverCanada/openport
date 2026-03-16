# OpenPort Chat Persistence Plan

## Goal

Move OpenPort chat session state out of API process memory and into durable backend storage, following the same architectural direction as Open WebUI:

- chat state is owned by the backend
- controls/settings live with the chat session record
- reloads and restarts do not erase chat configuration

## Open WebUI reference

This work references the local Open WebUI backend layout:

- chat data model:
  - `/Users/Sebastian/open-webui-main/backend/open_webui/models/chats.py`
- chat routes:
  - `/Users/Sebastian/open-webui-main/backend/open_webui/routers/chats.py`

The relevant design takeaway is not "copy the schema", but:

- chats are persisted server-side
- the backend is the source of truth for chat metadata and settings
- UI controls are backed by stored chat state, not browser-only storage

## OpenPort implementation choice

OpenPort now uses a dual-backend persistence strategy:

- local developer fallback:
  - file-backed state store in `apps/api`
  - default path:
    - `.openport-product/data/api-state.json`
- Docker / product path:
  - Postgres-backed chat state in the API layer

This keeps `npm run start:product` lightweight, while making the main Docker deployment path align more closely with Open WebUI's database-backed backend model.

## Scope

This phase persists:

- chat sessions
- chat messages
- chat settings
  - project assignment
  - system prompt
  - valves
  - advanced params

This phase does not yet persist:

- auth users and sessions
- notes
- workspace memberships

## Data shape

Stored API state should include:

- `version`
- `chatSessionsByUser`

Each session record keeps:

- `id`
- `userId`
- `title`
- `createdAt`
- `updatedAt`
- `settings`
- `messages`

## Runtime behavior

### Local runtime

When running via `npm run start:product`, `apps/api` writes to:

- `.openport-product/data/api-state.json`

### Docker runtime

When running via `npm run compose:up`, the API container writes to the same logical path inside the container:

- `/app/.openport-product/data/api-state.json`

In addition, Docker now uses Postgres as the primary chat persistence backend:

- `OPENPORT_API_STATE_BACKEND=postgres`
- `OPENPORT_DATABASE_URL=postgres://...`

The file path remains mounted for fallback/debug durability, while the chat source of truth is Postgres.

## Acceptance criteria

- creating a chat stores it in API-backed persistent state
- updating chat controls persists settings on disk
- posting a message updates persisted session data
- restarting the API keeps previous chat sessions and settings
- Docker recreation keeps chat sessions and settings as long as the volume remains
- Docker deployment uses Postgres-backed chat state by default
