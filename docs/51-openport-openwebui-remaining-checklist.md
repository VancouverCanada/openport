# OpenPort Open WebUI Remaining Checklist

## Goal

Audit the current `openport` codebase against the local `open-webui-main` implementation and define a precise completion checklist for the remaining high-value gaps.

This document is not a new product plan. It is a code-progress checkpoint so the next implementation passes can focus on what is still materially missing.

## Reference Baseline

Primary local Open WebUI references used for this audit:

- `src/routes/(app)/+page.svelte`
- `src/lib/components/layout/Sidebar.svelte`
- `src/lib/components/layout/Sidebar/Folders.svelte`
- `src/lib/components/layout/Sidebar/PinnedModelList.svelte`
- `src/lib/components/layout/Sidebar/UserMenu.svelte`
- `src/lib/components/chat/ChatPlaceholder.svelte`
- `src/lib/components/chat/Controls/Controls.svelte`
- `src/lib/components/chat/SettingsModal.svelte`
- `src/lib/components/chat/MessageInput/InputMenu.svelte`
- `src/lib/components/chat/MessageInput/InputMenu/Notes.svelte`
- `src/lib/components/chat/MessageInput/InputMenu/Knowledge.svelte`
- `src/lib/components/chat/MessageInput/InputMenu/Chats.svelte`
- `backend/open_webui/models/chats.py`
- `backend/open_webui/models/folders.py`
- `backend/open_webui/routers/folders.py`

Primary OpenPort files inspected in this audit:

- `apps/web/src/components/chat-shell.tsx`
- `apps/web/src/components/workspace-sidebar.tsx`
- `apps/web/src/components/chat-controls-panel.tsx`
- `apps/web/src/components/chat-settings-modal.tsx`
- `apps/web/src/components/chat-composer-tools-menu.tsx`
- `apps/web/src/components/workspace-search-modal.tsx`
- `apps/api/src/projects/projects.service.ts`
- `apps/api/src/storage/api-state-store.service.ts`

## Status Legend

- `done`: structurally at parity direction and usable in product
- `partial`: implemented, but still lighter or narrower than Open WebUI
- `missing`: not implemented at the expected level yet

## Current Audit Summary

### 1. Authenticated root and chat-first entry

Status: `done`

Current OpenPort state:

- authenticated `/` redirects into chat-first flow
- `/chat` is the primary app surface
- `/dashboard/chat` is a compatibility route

Relevant files:

- `apps/web/src/app/page.tsx`
- `apps/web/src/components/home-entry-gate.tsx`
- `apps/web/src/app/chat/page.tsx`

Remaining notes:

- anonymous `/` is still a branded product entry page, unlike Open WebUI's much more app-centric split
- this is acceptable unless the product goal becomes strict route-level parity

### 2. Sidebar shell

Status: `partial`

Current OpenPort state:

- sidebar has `New chat`, `Search`, `Notes`, `Workspace`
- `Projects`, `Chats`, and `Pinned Models` are present
- sections support local collapse state
- chat time grouping exists
- pinned model ordering exists and persists locally

Relevant files:

- `apps/web/src/components/workspace-sidebar.tsx`
- `apps/web/src/lib/chat-ui-preferences.ts`
- `apps/web/src/lib/chat-workspace.ts`

Still missing or weaker than Open WebUI:

- resizable desktop sidebar width
- persistent sidebar open/closed state at shell level
- stronger mobile sidebar behavior parity
- richer folder/project context menus
- drag-and-drop chat reassignment between projects from the sidebar
- infinite scroll or progressive loading for large chat history
- tighter parity in user menu positioning and sidebar footer behavior

### 3. Projects as folder-like organization

Status: `partial`

Current OpenPort state:

- `Projects` already support hierarchy
- project parent/child relationships are persisted
- project expansion state exists
- root `All chats` entry exists
- project assignment is stored in chat settings and respected by chat/workspace/search

Relevant files:

- `apps/api/src/projects/projects.service.ts`
- `apps/web/src/components/project-tree-item.tsx`
- `apps/web/src/components/workspace-sidebar.tsx`

Still missing or weaker than Open WebUI folders:

- dedicated backend folder/project router semantics as a first-class top-level concept
- cleaner folder/project mutation API parity:
  - rename
  - move parent
  - toggle expanded
  - delete subtree
- full drag-and-drop chat move into project targets from sidebar chat items
- project-level remembered model route for new chats
- project-level "attach project to composer" flows comparable to Open WebUI folder context

### 4. Chat home placeholder and empty-state composition

Status: `partial`

Current OpenPort state:

- `/chat` is centered and chat-first
- empty stage uses model identity + composer + suggestions
- model choice can be carried into first chat creation

Relevant files:

- `apps/web/src/components/chat-shell.tsx`

Still missing or weaker than Open WebUI:

- placeholder proportions and spacing are still heavier
- composer still behaves more like a traditional textarea shell than Open WebUI's lighter input-first block
- top area still exposes more local product context than Open WebUI
- empty-state suggestions are static and not model-aware

### 5. Model picker and pinned models

Status: `partial`

Current OpenPort state:

- top model menu exists
- pinned/unpinned state exists
- sidebar pinned list exists
- pinned models can be reordered locally

Relevant files:

- `apps/web/src/components/chat-shell.tsx`
- `apps/web/src/components/workspace-sidebar.tsx`
- `apps/web/src/lib/chat-ui-preferences.ts`

Still missing or weaker than Open WebUI:

- pinned model ordering is local-only, not user/server persisted
- no model visibility controls from workspace/admin side equivalent to `Hide from Sidebar / Keep in Sidebar`
- no richer model menu states such as grouping, filtering, or preferred defaults tied to project/folder context
- no project-remembered default model application on new chat creation

### 6. Chat controls panel

Status: `partial`

Current OpenPort state:

- right-side controls shell exists
- collapsible sections exist
- local persistence for section open/closed state exists
- project, model route, operator mode, tags, system prompt, and advanced params exist
- pin/archive actions are available from controls

Relevant files:

- `apps/web/src/components/chat-controls-panel.tsx`
- `apps/web/src/components/ui/controls-section.tsx`

Still missing or weaker than Open WebUI:

- controls width is not user-adjustable
- controls open/closed state is not managed at app-shell level like Open WebUI stores
- no permission-aware gating for controls sections
- no data controls/files section parity
- no stronger priority system across:
  - chat-level settings
  - project defaults
  - model defaults
  - global defaults
- still feels like an admin form in some sections instead of a lightweight per-chat options panel

### 7. Settings modal

Status: `partial`

Current OpenPort state:

- searchable multi-tab settings modal exists
- tabs include:
  - `General`
  - `Interface`
  - `Workspace`
  - `Data`
  - `About`
- modal can open from account menu

Relevant files:

- `apps/web/src/components/chat-settings-modal.tsx`

Still missing or weaker than Open WebUI:

- tabs are launcher-oriented, not full settings management surfaces
- missing deeper data controls semantics
- no real interface settings editing beyond informational counts
- no proper persistence UI for settings inside the modal
- no richer separation between chat settings, app settings, and data controls

### 8. Search

Status: `partial`

Current OpenPort state:

- search modal exists
- supports recent searches, recommendations, and query operators
- supports chat/note results and preview
- search results are project-aware

Relevant files:

- `apps/web/src/components/workspace-search-modal.tsx`
- `apps/web/src/lib/workspace-search.ts`
- `apps/api/src/search/search.service.ts`

Still missing or weaker than Open WebUI:

- no true command-palette level action execution parity
- no broader result categories such as models/tools/knowledge resources in one unified surface
- no incremental large-result browsing experience
- no tighter keyboard-driven result navigation and action affordances parity

### 9. Composer tools menu

Status: `partial`

Current OpenPort state:

- root/submenu input tool menu exists
- supports:
  - `Knowledge`
  - `Notes`
  - `Chats`
  - `Prompts`
  - `Webpage`
- search exists inside submenus
- selected tools become attachment chips and are included in message payload

Relevant files:

- `apps/web/src/components/chat-composer-tools-menu.tsx`
- `apps/web/src/components/chat-shell.tsx`

Still missing or weaker than Open WebUI:

- `Webpage` only creates a local attachment payload; there is no backend fetch/crawl/index flow
- no file upload pipeline from composer
- no media/file management controls in chat controls
- no richer inline command-based insertion flow
- no attach-folder/project-as-context behavior

### 10. Chat persistence and metadata

Status: `partial`

Current OpenPort state:

- chat sessions/messages/settings are persisted server-side
- Docker/Postgres path persists `openport_chat_sessions`
- metadata support exists for:
  - pinned
  - archived
  - tags
  - `settings.projectId`

Relevant files:

- `apps/api/src/storage/api-state-store.service.ts`
- `apps/api/src/ai/ai.service.ts`

Still missing or weaker than Open WebUI:

- no dedicated normalized tables for messages/folders/chat metadata
- still not a full database-native chat/folder model like Open WebUI
- no richer session-level operations such as share/public link flows
- limited metadata querying and bulk operations

### 11. Notes and Workspace

Status: `partial`

Current OpenPort state:

- `Notes` and `Workspace` are real pages
- workspace modules are routable and much deeper than before

Relevant files:

- `apps/web/src/app/dashboard/notes/page.tsx`
- `apps/web/src/app/dashboard/workspace/page.tsx`
- `apps/web/src/app/workspace/*`

Still missing or weaker than Open WebUI:

- Notes is still lighter than Open WebUI's integrated notes behavior
- Workspace is strong as a module shell, but not fully aligned with Open WebUI's integrated model/knowledge/tool visibility rules and share flows
- chat-to-workspace linking is present but not yet seamless enough

## Detailed Completion Checklist

### Phase 1: Finish app-shell parity

Priority: highest

- [ ] Add app-shell-level sidebar visibility state
- [ ] Add desktop sidebar resize handle with persisted width
- [ ] Add mobile sidebar open/close behavior parity
- [ ] Move account/footer/menu behavior closer to Open WebUI sidebar shell
- [ ] Persist controls panel width and open/close state at shell level

Acceptance:

- desktop sidebar width survives reload
- controls width survives reload
- mobile open/close behavior does not leave stale overlay state

### Phase 2: Finish folder/project parity

Priority: highest

- [ ] Formalize project folder API operations as first-class endpoints:
  - rename
  - move parent
  - toggle expanded
  - delete subtree
- [ ] Add sidebar drag/drop to move chats into projects directly
- [ ] Persist project-level default model route
- [ ] Apply project-level default model automatically when creating a chat within that project
- [ ] Add project context actions closer to folder actions in Open WebUI

Acceptance:

- moving a project or chat updates backend state, not only local cache
- new chats under a project inherit that project's default model route

### Phase 3: Finish model and controls parity

Priority: highest

- [ ] Persist pinned model ordering server-side per user
- [ ] Add model visibility controls equivalent to sidebar visibility toggles
- [ ] Refine settings precedence:
  - global
  - model
  - project
  - chat
- [ ] Add controls permissions and section-level visibility flags
- [ ] Add file/data controls section to the right panel

Acceptance:

- pinned model order survives device/container changes
- controls sections can be permission-gated
- file/data attachments are inspectable and removable from the controls panel

### Phase 4: Finish composer tool flows

Priority: highest

- [ ] Add real webpage fetch pipeline behind `Webpage`
- [ ] Add file upload flow from composer
- [ ] Add richer command-style insertion shortcuts
- [ ] Add attach-project or attach-project-knowledge flow
- [ ] Add backend-managed attachment lifecycle instead of prompt-only injection

Acceptance:

- webpage attachment produces retrievable server-side content
- uploaded files are visible in composer and controls
- attached resources can be removed without mutating raw draft text

### Phase 5: Finish settings/data controls parity

Priority: medium

- [ ] Turn settings modal tabs from launchers into editable settings surfaces
- [ ] Add data controls comparable to Open WebUI's richer settings/data sections
- [ ] Separate:
  - chat settings
  - interface settings
  - workspace settings
  - data controls
- [ ] Persist interface-level settings from modal

Acceptance:

- settings modal can edit, save, and restore interface/user preferences
- data controls are no longer just links

### Phase 6: Finish search parity

Priority: medium

- [ ] Expand search to include more unified result types
- [ ] Improve keyboard-only navigation and action selection
- [ ] Add stronger command-palette action execution flow
- [ ] Improve preview panel parity for chats/notes/resources

Acceptance:

- one modal can search chats, notes, and major workspace resources
- keyboard-only search flow is complete and predictable

### Phase 7: Finish database-native chat/folder persistence

Priority: medium

- [ ] Split JSON/blob persistence into clearer database-native models
- [ ] Add normalized folder/project records where needed
- [ ] Add richer chat metadata operations and querying
- [ ] Prepare for sharing/public-session-style features

Acceptance:

- chat and project metadata do not depend on opaque JSON payloads for core operations
- migrations are explicit and testable

## Recommended Implementation Order

1. App-shell parity
2. Folder/project parity
3. Model and controls parity
4. Composer tool flows
5. Settings/data controls parity
6. Search parity
7. Database-native persistence cleanup

This order keeps the biggest user-facing chat workflow gaps first, while avoiding rework in sidebar, controls, and attachment flows.

## Non-goals for the next pass

These should not be treated as blockers for the next implementation phase:

- changing `Projects` naming back to `Folders`
- removing the anonymous landing page entirely
- 1:1 visual cloning of Open WebUI spacing or tokens

The goal is functional and structural parity first, while preserving OpenPort-specific naming where it is intentional.
