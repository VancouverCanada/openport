# OpenPort Model And Controls Parity Plan

## Goal

Continue the Open WebUI parity checklist by upgrading model-default resolution and the chat controls panel from a flat form into a layered per-chat options surface.

## Reference Modules

Primary local Open WebUI references used in this pass:

- `src/lib/components/chat/Controls/Controls.svelte`
- `src/lib/components/chat/SettingsModal.svelte`
- `src/lib/components/layout/Sidebar/PinnedModelList.svelte`

The OpenPort implementation keeps its own product vocabulary but follows the same structural ideas:

- defaults should come from layered sources rather than one-off hardcoded values
- the controls panel should expose per-chat data and source context
- interface defaults should be editable in a user-facing settings surface

## Scope

### 1. Layered chat defaults

- add interface-level chat defaults to persisted UI preferences
- resolve chat settings through this priority direction:
  - project defaults
  - interface defaults
  - workspace default model
  - runtime fallback
- apply those defaults to new chat creation from both chat home and sidebar

### 2. Controls semantics

- allow pre-chat editing in controls instead of disabling everything without an active thread
- show source hints for `modelRoute` and `systemPrompt`
- add reset-to-inherited actions for key fields
- add a `Files` section to controls so composer attachments are visible and removable from the same panel

### 3. Settings modal

- make `Interface` settings actually editable
- expose:
  - default model
  - default operator mode
  - default system prompt

## Implemented Files

- [apps/web/src/lib/chat-ui-preferences.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-ui-preferences.ts)
- [apps/web/src/lib/chat-defaults.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-defaults.ts)
- [apps/web/src/lib/chat-workspace.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-workspace.ts)
- [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
- [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
- [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
- [apps/web/src/components/chat-settings-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-settings-modal.tsx)
- [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)

## Acceptance

- interface defaults are persisted in local chat UI preferences
- new chats created from sidebar and chat home inherit project/interface/workspace defaults
- controls can edit pending settings before the first message is sent
- controls display a files section when attachments exist
- controls show source hints and reset actions for inherited values
- `npm run build:web` passes

