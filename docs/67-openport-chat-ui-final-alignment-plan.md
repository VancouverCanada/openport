# OpenPort Chat UI Final Alignment Plan

## Goal

Close the remaining UI and interaction gaps between OpenPort chat-first surfaces and the current Open WebUI authenticated app shell, with priority on:

1. Lighter sidebar structure
2. A purer centered chat home
3. Controls as a chat options panel instead of an admin form
4. Settings and composer tools as application-level interaction surfaces

## Open WebUI References

Primary reference modules used for this wave:

- `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/ChatPlaceholder.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/Controls/Controls.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/SettingsModal.svelte`

## Current Gap Summary

Before this wave, OpenPort had already reached chat-first routing parity, but still diverged in four ways:

- sidebar still felt like a product admin shell
- empty chat stage still showed too much product context
- controls still over-exposed project/admin semantics
- settings and composer tools were structurally present but not yet close enough to Open WebUI’s application patterns

## Implementation Plan

### 1. Sidebar Compression

- remove the standalone CTA feel from `New chat`
- reduce section/action weight
- keep `Projects` as the OpenPort term, but make it behave more like a light organizational layer than a management console
- reduce footer/account and workspace switcher visual weight

### 2. Chat Home Parity

- keep model selection at the top of the main stage
- simplify the empty state to model identity + centered composer + suggestions
- move project context out of the hero area and demote it to a lightweight hint
- remove thread summary chrome that makes the screen feel like a detail page

### 3. Controls Panel Parity

- keep `Files / Valves / System Prompt / Advanced Params`
- demote pin/archive to subtle session actions
- move project and tags out of the main valves area into context
- make the panel read as a chat options surface, not as a configuration form

### 4. Settings + Input Tools Depth

- add icon-based settings navigation closer to Open WebUI
- expand settings surface with `Connections` and `Integrations`
- make composer tools feel like an include-context menu rather than a raw attachment list
- improve copy hierarchy and submenu semantics

## Completed in This Wave

### Sidebar

- `New chat` moved into the lightweight sidebar utility rhythm
- removed the large CTA block treatment
- reduced section density and footer/account weight
- reduced `Projects` management emphasis without removing functionality

### Chat Home

- empty state simplified to centered model mark, title, subtitle, composer, and suggestions
- project metadata removed from the main hero area and reduced to a small context hint
- thread summary strip removed from active chat view

### Controls

- top action area reduced to a lighter `Session options` row
- `Project` and `Tags` moved into `Context`
- `Valves` now focuses on model/operator/function controls
- source hints and reset behavior preserved

### Settings and Tools

- settings navigation now includes icons
- added `Connections` and `Integrations` sections
- composer tools menu now uses an include-context structure with per-surface counts and submenu headings

## Acceptance Criteria

This wave is complete when:

- `/chat` reads primarily as a chat application, not a project admin screen
- sidebar no longer centers `Projects` as the visual primary
- controls no longer feel like the main configuration surface
- settings and composer tools reflect Open WebUI-style app interaction patterns more closely than before

