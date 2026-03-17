# OpenPort Chat Final Gap Plan

## Goal

Close the remaining high-value Open WebUI chat parity gaps that still affect the authenticated chat workspace:

- project-like organization depth
- pinned model ordering
- richer chat settings modal structure
- fuller input tool flows

This pass keeps OpenPort terminology where it is product-defining (`Projects`), but the implementation should continue to mirror Open WebUI architecture when it speeds delivery.

## Open WebUI References

Primary local references:

- `src/lib/components/layout/Sidebar.svelte`
- `src/lib/components/layout/Sidebar/Folders.svelte`
- `src/lib/components/layout/Sidebar/PinnedModelList.svelte`
- `src/lib/components/layout/Sidebar/PinnedModelItem.svelte`
- `src/lib/components/chat/SettingsModal.svelte`
- `src/lib/components/chat/MessageInput/InputMenu.svelte`
- `src/lib/components/chat/MessageInput/InputMenu/Notes.svelte`
- `src/lib/components/chat/MessageInput/InputMenu/Knowledge.svelte`
- `src/lib/components/chat/MessageInput/InputMenu/Chats.svelte`

## Gap Breakdown

### 1. Project-like organization

Current OpenPort `Projects` already support nesting and drag/drop, but the section still feels heavier than Open WebUI organization surfaces.

Target:

- keep `Projects` naming
- make the section behave like a collapsible lightweight project layer
- add an explicit root `All chats` entry
- preserve recursive structure and drag/drop

### 2. Pinned models ordering

Current pinned models are visible but not re-orderable.

Target:

- keep pinned model routes in local chat UI preferences
- allow reordering from the sidebar
- persist order across reloads

### 3. Settings modal depth

Current settings modal is only a lightweight launcher.

Target:

- add Open WebUI-style tabbed structure
- add settings search
- split into clearer sections:
  - General
  - Interface
  - Workspace
  - Data
  - About
- surface runtime and UI state in the modal itself

### 4. Input tool flows

Current composer tools menu supports notes, knowledge, and chats, but it is still narrower than Open WebUI.

Target:

- keep root/submenu structure
- add search inside attachment submenus
- add prompt insertion
- add webpage attachment
- keep attachment chips above composer and preserve payload wiring

## Implementation Plan

1. Extend chat UI preferences to cover sidebar section state and pinned model ordering.
2. Upgrade sidebar sections to behave more like Open WebUI project organization and pinned model groups.
3. Expand the chat settings modal into a searchable multi-section configuration surface.
4. Expand the composer tool menu into a broader root/submenu attachment system.
5. Validate with `build:web` and Docker rebuild.

## Verification

1. `npm run build:web`
2. `npm run compose:up`
3. Confirm:
- `Projects` and `Chats` can collapse independently
- pinned models can be reordered and survive reloads
- settings modal opens with tab search and richer sections
- composer `+` menu supports notes, knowledge, chats, prompts, and webpages
- Docker services remain healthy
