# OpenPort Open WebUI UI Gap Closure Round 2

## Goal

Close the remaining six UI and interaction gaps against the local `open-webui-main` app shell in one pass:

1. Strip the anonymous root down to a minimal auth-first entry.
2. Lower sidebar management weight so `Chats` remains primary.
3. Make the empty chat home read closer to `ChatPlaceholder.svelte`.
4. Reduce `Controls` form density and push project semantics into a lighter context surface.
5. Rebalance `Settings` tabs and copy toward the Open WebUI information architecture.
6. Reorganize the composer tools menu so submenu flows are closer to `InputMenu.svelte`.

## Reference Modules

- `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/ChatPlaceholder.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/Controls/Controls.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/SettingsModal.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/MessageInput/InputMenu.svelte`

## Implementation

### Anonymous Root

- Remove the remaining helper copy from `/`.
- Keep only the wordmark and auth actions.

### Sidebar

- Keep `New chat / Search / Notes / Workspace` as the top utility stack.
- Keep `Chats` ahead of `Projects`.
- Reduce `Projects` and `Pinned` visual weight.
- Keep project creation available, but secondary.

### Chat Home

- Keep the empty state centered on:
  - model selector
  - composer
  - suggestions
- Remove the inline project hint block.
- Simplify the hero model selector so it reads more like a chat home title than a product header.

### Controls

- Keep `Valves / References / System Prompt / Advanced Params`.
- Move `operator mode` into `Valves`.
- Remove direct project switching from the controls panel.
- Show project context as attached reference state instead of a primary editable field.

### Settings

- Reorder tabs so operational surfaces (`Connections`, `Integrations`) sit ahead of personalization.
- Reduce OpenPort-specific copy and use more chat-first wording.
- Keep data controls intact.

### Composer Tools

- Keep Open WebUI-style root actions:
  - upload
  - capture
  - webpage
  - notes
  - knowledge
  - chats
- Move prompts/files behind a `Workspace` submenu.

## Acceptance

- `/` is a minimal auth entry, not a branded landing page.
- Sidebar reads primarily as chat navigation, not workspace administration.
- Empty chat home reads as a single centered chat surface.
- `Controls` reads as a lightweight panel, not a project configuration form.
- `Settings` and tools are closer to Open WebUI’s tab and submenu structure.

## Progress Update (2026-03-16)

- done: Added menu and panel enter/exit state transitions to align closer with Open WebUI interaction cadence.
  - `ChatShell` now keeps `model/account menu` and `controls panel` mounted through close animation windows.
  - `ChatControlsPanel` accepts animation state class for open/closing transitions.
- done: Added staged empty-home entrance sequencing (`model -> composer -> suggestions`) to reduce all-at-once pop-in.
- done: Added per-message bubble entrance timing in conversation flow.
- done: Added motion tokens/keyframes and reduced-motion coverage updates in global CSS for:
  - menu fade/scale in-out
  - controls panel in-out
  - empty-stage staged in
  - message bubble in

## Progress Update (2026-03-16, Minimal Animation Imports)

- done: Adopted minimal-style motion primitives (`transitionEnter/Exit`, container/fade variants, viewport-aware wrapper).
- done: Introduced global `MotionLazy` shell and top `ScrollProgress` bar for authenticated surfaces.
- done: Added Embla-based hero parallax carousel and hooked it into `/` entry flow.
- done: Applied `AnimatePresence + layout spring` list animation to chat/project navigation trees.
- done: Rebalanced global motion speed to medium-slow cadence (`260/380/560ms`) and aligned button micro-interaction timing.
