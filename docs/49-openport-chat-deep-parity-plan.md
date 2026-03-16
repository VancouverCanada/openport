# OpenPort Chat Deep Parity Plan

## Goal

Close the remaining high-value Open WebUI chat-home gaps after the `/chat` route was made the authenticated default:

- pinned models in the left sidebar
- a real settings modal from the account menu
- message input tool menus for notes, knowledge, and chats

This pass should keep OpenPort terminology where it matters (`Projects`, `Workspace`), but reuse the Open WebUI interaction architecture wherever it accelerates delivery.

## Open WebUI References

Primary local reference files used for this pass:

- `src/lib/components/layout/Sidebar/PinnedModelList.svelte`
- `src/lib/components/chat/SettingsModal.svelte`
- `src/lib/components/chat/MessageInput/InputMenu.svelte`
- `src/lib/components/chat/MessageInput/InputMenu/Notes.svelte`
- `src/lib/components/chat/MessageInput/InputMenu/Knowledge.svelte`
- `src/lib/components/chat/MessageInput/InputMenu/Chats.svelte`

## Gaps To Close

1. Pinned models are not yet exposed as a first-class left-rail affordance.
2. The account menu still routes outward instead of opening a chat-scoped settings modal.
3. The composer still behaves like a plain textarea toolbar instead of a lightweight tool attachment menu.
4. Chat UI preferences are not yet shared across the chat home and sidebar.

## Implementation Plan

### 1. Pinned models

- Reuse the Open WebUI idea of user-owned pinned model preferences.
- Store pinned model routes in local UI preferences.
- Surface pinned models as a compact sidebar section above project organization.
- Clicking a pinned model should open a fresh `/chat` draft with that model preselected.

### 2. Settings modal

- Open settings from the account menu instead of routing to a different page first.
- Use tabbed sections inspired by Open WebUI:
  - General
  - Workspace
  - Data
  - About
- Keep OpenPort-specific destinations inside those sections.

### 3. Composer input menu

- Add a lightweight root/submenu input menu on the composer `+` affordance.
- Allow attaching:
  - knowledge
  - notes
  - chats
- Show selected attachments as removable chips above the composer.
- Include attachment context in the submitted message payload.

### 4. Shared state and cleanup

- Keep pinned model preferences in a dedicated local storage module.
- Broadcast updates so the sidebar and chat stage stay in sync.
- Continue using route-backed state for drafts where it simplifies behavior.

## Verification

1. `npm run build:web`
2. `npm run compose:up`
3. Confirm:
- pinned models render in the sidebar and survive reloads
- account menu `Settings` opens a modal
- composer `+` opens a tool menu with notes, knowledge, and chats
- selected attachments appear as chips and affect the sent payload
- Docker services remain healthy
