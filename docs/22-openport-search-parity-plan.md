# OpenPort Search Parity Plan

## Goal

Upgrade OpenPort search from a frontend-only filter modal into a product-grade search system closer to Open WebUI's search flow while keeping OpenPort's own product boundaries:

- Search remains a pure search-and-jump surface, not a command palette.
- Results cover chats and notes first.
- Search supports filter operators, keyboard-first navigation, preview, highlighting, and pagination.
- The API contract is reusable for future resources such as connections or archived content.

## Scope

This plan covers three implementation stages:

1. A real backend `/search` endpoint and shared contract.
2. Operator autocomplete and structured filter parsing.
3. Highlighted result rendering and paginated result loading.

This plan does not yet include:

- backend persistence for projects/folders
- archived search
- tag search
- semantic/vector search
- server-side note preview rendering

## Product Rules

- Search should only search and navigate.
- Creation actions stay outside search results.
- `Projects` remains OpenPort's own term even though the structure is inspired by Open WebUI's chat organization.
- `project:` filtering remains supported, but because projects are currently client-local, project filtering is applied client-side after server results are received.

## Target UX

- `Cmd/Ctrl + K` opens a modal search surface.
- Search input accepts free text and filter operators.
- Left pane shows grouped results.
- Right pane shows a lightweight preview for the selected result.
- Arrow keys move selection.
- `Enter` opens the selected result.
- `Esc` closes the modal.
- Results can continue loading when more pages exist.

## Shared Contract

The search contract should live in `@openport/product-contracts`.

### Query Parameters

- `q`: free text query
- `type`: `all | chat | note`
- `cursor`: opaque cursor for pagination
- `limit`: page size

### Response Shape

- `items`
- `hasMore`
- `nextCursor`
- `total`

### Item Shape

- `id`
- `type`
- `title`
- `excerpt`
- `href`
- `updatedAt`
- `metadata`
- `highlights`

### Highlight Shape

- `field`: `title | excerpt`
- `start`
- `end`

## Stage 1: Backend Search Endpoint

### API

Add:

- `GET /api/search`

### Backend Modules

Add:

- `apps/api/src/search/search.module.ts`
- `apps/api/src/search/search.controller.ts`
- `apps/api/src/search/search.service.ts`
- `apps/api/src/search/dto/search-query.dto.ts`

### Data Sources

Reuse:

- `AiService.listSessions(userId)`
- `NotesService.list(actor, query, archived?)`

### First Version Constraints

- search runs over in-memory chat sessions and note records
- `project:` is not executed by the server because projects are client-local
- server returns plain search items plus highlight ranges

### Acceptance

- querying `GET /api/search?q=foo` returns chats and notes
- `type=chat` and `type=note` narrow results
- pagination fields are always present

## Stage 2: Operator Autocomplete

### Operators

Implement:

- `project:`
- `type:`

Reserve for later:

- `tag:`
- `archived:`
- `pinned:`

### Frontend Components

Add:

- `apps/web/src/components/workspace-search-input.tsx`

Extend:

- `apps/web/src/lib/workspace-search.ts`
- `apps/web/src/components/workspace-search-modal.tsx`

### UX Rules

- autocomplete appears when the active token matches a supported operator prefix
- `ArrowUp`, `ArrowDown`, `Tab`, and `Enter` can accept a suggestion
- choosing `project:` inserts a project name from local storage
- choosing `type:` inserts `chat` or `note`

### Acceptance

- typing `pro` suggests `project:`
- typing `type:` suggests `chat` and `note`
- choosing a suggestion rewrites the input cleanly

## Stage 3: Highlighting and Pagination

### Highlighting

- server returns highlight ranges for `title` and `excerpt`
- client renders highlights safely without HTML injection

### Pagination

- search fetches the first page on query change
- when `hasMore` is true, the modal can load the next page
- pagination state resets when filters or query change

### Acceptance

- matching terms are visually highlighted
- large result sets can load additional pages
- keyboard selection remains stable while pages append

## Open WebUI Alignment

Open WebUI concepts being intentionally mirrored:

- modal-first search surface
- keyboard-first navigation
- preview pane
- result grouping
- operator-aware input

OpenPort keeps these deliberate differences:

- search does not mix search results with creation commands
- `Projects` remains the OpenPort label
- first version uses OpenPort's existing chat and note data models

## Implementation Order

1. Add the shared contract.
2. Add backend `search` module and controller.
3. Add frontend API client for `/search`.
4. Switch the modal to use backend results.
5. Add autocomplete.
6. Add highlights and pagination.
7. Verify under `build:web` and Docker.

## Verification Plan

- `npm run build`
- `npm run build:web`
- `npm run compose:up`
- manual search checks:
  - open search with `Cmd/Ctrl + K`
  - search chats
  - search notes
  - apply `type:` filter
  - apply `project:` filter
  - verify highlight rendering
  - verify next-page loading

## Done Criteria

This migration is complete when:

- search uses backend data instead of frontend-only filtering
- operator suggestions are usable with keyboard
- results show highlights
- pagination works
- Docker and local product builds remain healthy
