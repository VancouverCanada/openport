# OpenPort Open WebUI Auth Shell Final Closure Plan

## Goal

Close the remaining UI and interaction gaps between OpenPort and the local `open-webui-main` app shell by finishing the following in one pass:

1. Remove the remaining landing-style weight from the anonymous root.
2. Make authenticated navigation resolve to `/chat` as the canonical chat home.
3. Reduce sidebar management weight so `Chats` stays primary and `Projects` behaves as a lighter organization layer.
4. Simplify the chat placeholder so it reads more like `ChatPlaceholder.svelte`.
5. Reduce `Controls` form weight and keep context/settings secondary.
6. Reorganize `Settings` and composer tools so their information architecture is closer to `SettingsModal.svelte` and `InputMenu.svelte`.

## Reference Modules

- `/Users/Sebastian/open-webui-main/src/routes/(app)/+page.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/ChatPlaceholder.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/Controls/Controls.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/SettingsModal.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/MessageInput/InputMenu.svelte`

## Implementation Checklist

### 1. Anonymous Root

- Replace the remaining branded landing hero with a centered auth-first entry shell.
- Keep `Login / Register` only.
- Keep authenticated `/` behavior as an immediate hand-off into chat.

### 2. Canonical Chat Route

- Make `/chat` the real chat page.
- Keep `/dashboard/chat` as compatibility redirect.
- Update internal chat links and archived chat links to target `/chat`.

### 3. Sidebar

- Move `Chats` ahead of `Projects`.
- Remove the workspace switcher from the sidebar.
- Keep `Projects` available, but lower its visual weight and empty-state messaging.
- Keep `Pinned Models`, but retain it as a secondary section.

### 4. Chat Empty State

- Keep the hero centered on:
  - model selector
  - composer
  - suggestions
- Remove the heavier project-context block treatment.
- Keep any project hint subtle and inline.

### 5. Controls

- Keep `Valves`, `System Prompt`, `Advanced Params`, and `Context`.
- Reduce label emphasis and visible configuration weight.
- Hide `Context` unless there is active project/tag context.
- Rename `Model route` presentation to `Model`.

### 6. Settings and Tools

- Remove extra OpenPort-specific IA where not needed.
- Drop the separate `Workspace` tab and fold that navigation into `Integrations`.
- Keep `Data` and `Connections`, but with lighter, more Open WebUI-like copy.
- Reorganize composer tools so root actions follow the Open WebUI flow:
  - upload
  - capture
  - attach webpage
  - notes
  - knowledge
  - chats
  - prompts
  - recent files

## Acceptance

- Anonymous `/` is visibly lighter and auth-first.
- Authenticated `/` hands off to `/chat`.
- `/chat` is the canonical app home for chat.
- Sidebar feels lighter, with `Chats` primary and `Projects` secondary.
- Empty chat state is centered and model/composer-driven.
- Controls read as a lightweight chat panel instead of a settings form.
- Settings/tools IA is closer to Open WebUI and no longer repeats extra workspace categories.
