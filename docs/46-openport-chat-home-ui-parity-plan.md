# OpenPort Chat Home UI Parity Plan

## Goal

Continue narrowing the UI and interaction gap between OpenPort chat and the local `open-webui-main` reference, with focus on the authenticated chat home rather than workspace resource pages.

## Open WebUI References

Primary reference files used for this pass:

- `src/routes/(app)/+page.svelte`
- `src/lib/components/chat/Chat.svelte`
- `src/lib/components/chat/ChatPlaceholder.svelte`
- `src/lib/components/chat/Controls/Controls.svelte`
- `src/lib/components/layout/Sidebar.svelte`

OpenPort keeps its own product model (`Projects`, `Workspace`, `Notes`), but this pass should reuse the Open WebUI structure where it materially improves chat-first behavior.

## Gaps To Close

1. The authenticated root should behave like chat home.
2. The empty chat state should be centered around the model and composer.
3. Model selection should feel like a first-class chat action, not only a right-rail field.
4. The left sidebar should read like app navigation, not like a management console.
5. Controls should feel like a lightweight chat options panel, not a backend form.

## Implementation Plan

### 1. Chat-first stage

- Keep `/chat` as the authenticated default.
- Preserve `/dashboard/chat` only as a compatibility redirect.
- Leave the anonymous landing page intact for unauthenticated users.

### 2. Empty-state parity

- Rebuild the empty chat stage around:
  - selected model
  - one-line model description
  - centered composer
  - lightweight suggestions
- Remove heavy thread-management affordances from the empty stage.

### 3. Top-level model entry

- Add a lightweight model menu at the top of the chat stage.
- Source model options from workspace models where available.
- When no session exists yet, store model choice in draft chat settings so the next created session inherits it.

### 4. Sidebar de-emphasis

- Keep `Projects` as OpenPort terminology.
- Remove the large top-level project management affordances from the main navigation flow.
- Convert create/import controls into compact section actions.
- Keep the sidebar structurally close to Open WebUI:
  - primary new-chat action
  - utility navigation
  - organization layer
  - chat history

### 5. Controls parity

- Persist controls section open state in local storage, similar to Open WebUI collapsibles.
- Reduce the weight of the panel.
- Split project-derived status into a lighter `Context` section.
- Keep `pin/archive` available, but move them out of the main stage and into controls.

## Verification

1. `npm run build:web`
2. `npm run compose:up`
3. Confirm:
- `/` redirects to `/chat` when authenticated
- `/chat` renders the centered empty stage
- model menu opens and updates the pending chat settings
- controls retain open/closed state across reloads
- Docker services remain healthy
