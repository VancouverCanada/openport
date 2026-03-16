# OpenPort Chat Parity Plan

## Goal

Align the OpenPort workspace with the parts of Open WebUI that matter most for daily chat usage, without copying its code verbatim:

- grouped and foldable chat history
- richer search surface / command palette behavior
- chat controls backed by real session configuration instead of local-only placeholders

## Current status

- `done`: grouped and foldable chat history
- `done`: command palette actions and mixed search results
- `done`: API-backed chat session settings and controls wiring
- `next`: deepen `Notes`, `Workspace`, and richer chat history organization on top of this foundation

## Open WebUI reference points

This implementation references local Open WebUI source structure and behavior:

- Sidebar chat grouping and time buckets:
  - `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar.svelte`
- Search modal / command palette behavior:
  - `/Users/Sebastian/open-webui-main/src/lib/components/layout/SearchModal.svelte`
  - `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar/SearchInput.svelte`
- Chat controls architecture:
  - `/Users/Sebastian/open-webui-main/src/lib/components/chat/Controls/Controls.svelte`
  - `/Users/Sebastian/open-webui-main/src/lib/components/chat/Controls/Valves.svelte`
  - `/Users/Sebastian/open-webui-main/src/lib/components/chat/Settings/Advanced/AdvancedParams.svelte`

## OpenPort target architecture

### 1. Sidebar history

OpenPort should keep its `Projects` naming, but match Open WebUI's history behavior more closely:

- `Projects` remains the organization layer
- `Chats` becomes a grouped history list
- history groups are time-based:
  - `Today`
  - `Yesterday`
  - `Previous 7 days`
  - `Previous 30 days`
  - `Earlier`
- each time group is collapsible
- collapsed state is persisted locally

### 2. Search

OpenPort already has a modal search surface. It should be upgraded from "search dialog" to "command palette":

- keep keyboard-first modal behavior
- support quick actions at the top of results
- support command-style filtering
- keep chat and note previews on the right
- support grouped results by time bucket for chats

Supported quick actions:

- new chat
- new note
- open notes
- open workspace
- open status

Supported filters:

- `type:chat`
- `type:note`
- `project:name`

Optional command-mode syntax:

- `>` prefix narrows the list to quick actions first

### 3. Chat controls

OpenPort currently persists chat settings locally per thread. That is useful for prototyping but not enough for real product behavior.

The next implementation step is:

- define chat session settings in shared product contracts
- store settings in `apps/api` session state
- return settings as part of chat session payloads
- update settings via dedicated API route
- keep local fallback only for pre-thread draft state if needed

Required settings model:

- `projectId`
- `systemPrompt`
- `valves`
  - `modelRoute`
  - `operatorMode`
  - `functionCalling`
- `params`
  - `streamResponse`
  - `reasoningEffort`
  - `temperature`
  - `maxTokens`
  - `topP`

## Implementation sequence

### Phase 1. Shared contracts and API

- extend shared contracts with `OpenPortChatSettings`
- extend `OpenPortChatSession` with:
  - `updatedAt`
  - `settings`
- add session settings update route in API
- persist settings in `AiService`

### Phase 2. Sidebar parity

- group chat history by `updatedAt`
- persist collapsed state per time bucket
- render grouped sections in sidebar

### Phase 3. Search parity

- add quick actions section
- merge actions with searchable results
- support `>` action mode
- keep keyboard navigation across actions and results

### Phase 4. Controls parity

- load settings from session payload
- patch settings through API for active session
- update chat header model label from real session settings

## Acceptance criteria

- chat history shows grouped sections with collapse state preserved
- search modal supports both quick actions and content search
- selecting a search result opens the correct route
- session settings survive reload because they are stored in API state
- changing `modelRoute`, `systemPrompt`, or params updates the current session, not only local storage
- `npm run build:web` passes
- Docker workspace remains runnable after the changes
