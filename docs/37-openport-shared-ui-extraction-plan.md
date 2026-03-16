# OpenPort Shared UI Extraction Plan

## Goal

Extract the highest-repeat UI structures into shared components and replace page-level handwritten markup across the web app. The target is consistency, lower drift, and faster parity work against the local `open-webui-main` reference.

## Reference Direction

This extraction follows the same high-level component separation visible in local Open WebUI:

- `common/Modal.svelte`
- `common/Badge.svelte`
- `common/Tags.svelte`
- `common/Banner.svelte`
- `common/Collapsible.svelte`
- `common/Sidebar.svelte`
- `chat/Messages.svelte`
- `chat/ChatControls.svelte`

OpenPort keeps its own naming and styling, but the component boundaries should be similarly stable.

## Components To Extract

1. `PageHeader`
- Replaces repeated workspace and dashboard page headers.

2. `Field`
- Replaces repeated `label + input/select/textarea` wrappers.

3. `ResourceCard`
- Replaces repeated workspace resource list cards and card action rails.

4. `ModalShell`
- Replaces duplicated overlay, header, close button, body, footer structure.

5. `Tag`
- Replaces repeated `chat-thread-tag` spans across chat and workspace.

6. `FeedbackBanner`
- Replaces repeated success/error inline banners.

7. `ControlsSection`
- Replaces repeated collapsible sections in chat controls.

8. `SidebarSection`
- Replaces repeated sidebar group headings and grouped item blocks.

9. `MessageBubble`
- Replaces repeated chat message article markup in chat and search preview.

## Replacement Scope

### Workspace

- Resource index pages:
  - models
  - tools
  - prompts
  - skills
  - knowledge
  - access

- Editor pages:
  - model editor
  - tool editor
  - prompt editor
  - skill editor
  - knowledge create/detail
  - knowledge collection editor/detail

### Chat

- Main conversation flow
- Search preview
- Right-side controls
- Sidebar group headings

### Modals

- Project modal
- Confirm dialog
- Keyboard shortcuts modal

### Auth and utility

- Login/register feedback banners
- Dashboard/integrations feedback banners

## Migration Rules

- Preserve existing visual language unless the shared component already defines the same structure.
- Prefer wrapping existing class names inside shared components instead of rewriting styles.
- Keep structural backdrops as native elements where needed for accessibility and outside-click behavior.
- Avoid adding new bespoke button or card styles during migration.

## Verification

1. `npm run build:web`
2. `npm run compose:up`
3. Check Docker health for `web/api/reference/postgres`
4. Spot-check:
- `/`
- `/chat`
- `/workspace/models`
- `/workspace/tools`
- `/workspace/prompts`
- `/workspace/skills`
- `/workspace/knowledge`
- `/dashboard/notes`

