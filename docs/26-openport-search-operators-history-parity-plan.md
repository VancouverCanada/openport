# OpenPort Search Operators, History And Modal Parity Plan

## Goal

Close the remaining non-1:1 gaps against Open WebUI search by completing three tracks in one implementation pass:

1. operator parity (`folder:` / `shared:` included)
2. service-side history and recommendation system
3. modal result organization and preview alignment

## Open WebUI References

- [SearchInput.svelte](/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar/SearchInput.svelte)
- [SearchModal.svelte](/Users/Sebastian/open-webui-main/src/lib/components/layout/SearchModal.svelte)
- [chats api search flow](/Users/Sebastian/open-webui-main/src/lib/apis/chats/index.ts)

## Implementation Plan

### Track A: Operator parity

- Backend `/search` parser supports:
  - `tag:`
  - `archived:`
  - `pinned:`
  - `shared:`
  - `project:`
  - `folder:` (mapped to OpenPort project scope)
- Frontend operator autocomplete supports:
  - `tag:`
  - `archived:`
  - `pinned:`
  - `shared:`
  - `project:`
  - `folder:`
  - `type:`

### Track B: Service-side history and recommendation

- Add persistent search history model (file + postgres backends):
  - query
  - usage count
  - created/updated timestamps
  - last result count
  - top result type
- Add APIs:
  - `GET /search/context`
  - `POST /search/history`
  - `DELETE /search/history/:id`
- Move frontend from localStorage to API-backed history/recommendation data.

### Track C: Modal alignment

- Keep Open WebUI-like action section (`new conversation`, `new note`).
- Use time-grouped section labels for chat/note results (`Today`, `Yesterday`, etc.).
- Keep right-side preview for:
  - search results
  - recent history items
  - recommendations
- Keep keyboard selection flow (`ArrowUp/Down`, `Enter`, `Tab` for operator suggestion accept).

### Track D: Strict Open WebUI Search Chain Alignment

- Switch modal data flow to `/chats` and `/chats/search` chain (chat-only list path).
- Use `500ms` debounce for non-empty text, matching Open WebUI search rhythm.
- Remove `Recent` / `Recommended` panels from modal UI in strict mode.
- Keep action items but bind query into routes:
  - new conversation: `/chat?q=<query>`
  - new note: `/dashboard/notes/new?content=<query>`
- Add route consumption:
  - chat page reads `q` as seeded draft
  - notes new page reads `content` as seeded note content

## Progress (Updated: 2026-03-16)

- [x] Added contract types:
  - `OpenPortSearchContextResponse`
  - `OpenPortSearchHistoryResponse`
  - `OpenPortSearchHistoryItem`
  - `OpenPortSearchRecommendation`
  - `OpenPortSearchTagFacet`
- [x] Backend `/search` supports `folder:` and `shared:` filters.
- [x] Added backend search context + history endpoints in `SearchController`.
- [x] Added persisted search history in `ApiStateStoreService`:
  - file backend: `searchHistoryByScope`
  - postgres backend: `openport_search_history` table and indexes
- [x] Frontend search modal now uses server-backed context/history APIs.
- [x] Removed frontend localStorage history dependency in workspace search flow.
- [x] Operator hint and autocomplete updated to include `folder:` and `shared:`.
- [x] Result grouping adjusted to time-range sectioning for chat/note entries.
- [x] Promoted chat `shared` / `folderId` to first-class persisted fields:
  - API contract: `OpenPortChatSession.shared`, `OpenPortChatSession.folderId`
  - API service sync: `folderId <-> settings.projectId`, `shared` fallback from tags
  - Postgres persistence: `openport_chat_sessions.shared`, `openport_chat_sessions.folder_id`
  - File persistence normalization includes both fields
- [x] Search backend now evaluates:
  - `shared:` using `session.shared` first, with legacy tag fallback
  - `folder:` / `project:` against `session.folderId` scope
- [x] Search modal was re-aligned to Open WebUI chat-first structure:
  - removed workspace resource mixed-search (models/prompts/tools/skills/knowledge)
  - kept actions + chat/note results + right-side preview
  - retained server-backed recent history + recommendation tracks
- [x] Search input copy aligned to chat-first behavior (`Search chats and notes`).
- [x] Added strict `/chats` and `/chats/search` endpoints for Open WebUI-like chat search chain.
- [x] Reworked workspace search modal to strict mode:
  - actions + chat list + chat preview
  - removed recent/recommended sections from UI
  - switched to `500ms` debounce search cadence
- [x] Action routes now carry query payload:
  - `/chat?q=...`
  - `/dashboard/notes/new?content=...`
- [x] Chat and notes bootstrap routes now consume seeded query content.

## Verification

- `npm run build:web` passes.
- `npm run build:api` passes.

## Strict Alignment Status

- Open WebUI search chain parity closure for modal flow is complete in this pass (`/chats` + `/chats/search`, 500ms debounce, chat-only result stream, query-bound actions).
