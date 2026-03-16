# OpenPort Open WebUI UI Final Closure Plan

## Goal

Close the last major UI and interaction gaps between OpenPort and the current Open WebUI application shell, with focus on:

1. Anonymous root becoming a minimal auth entry instead of a landing page
2. Sidebar becoming a lighter navigation surface
3. Chat home becoming a purer centered chat-first screen
4. Controls reading as a chat options panel instead of an admin form
5. Settings and composer tools adopting deeper Open WebUI-like interaction density

## Reference Modules

Primary Open WebUI references used for this wave:

- `/Users/Sebastian/open-webui-main/src/routes/(app)/+page.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/ChatPlaceholder.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/Controls/Controls.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/SettingsModal.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/MessageInput/InputMenu.svelte`

## Gap Summary Before This Wave

- `/` still behaved like a lightweight marketing shell instead of a pure auth entry
- sidebar hierarchy still gave too much visual weight to `Projects`
- chat home still carried too much application chrome and thread context
- controls still exposed too much direct configuration semantics
- settings and tools already existed, but still felt shallower than Open WebUI

## Implementation

### 1. Anonymous Root Simplification

- keep authenticated users on the existing chat-first path
- reduce anonymous `/` to a narrow auth shell with minimal copy and no campaign layout weight
- preserve sign-in / register actions without reintroducing a marketing homepage

### 2. Sidebar Compression

- reduce wordmark, spacing, section density, and account weight
- keep `Projects` as the OpenPort term, but make it feel like an organizational layer
- tighten `New Chat`, utility links, grouped lists, and footer density

### 3. Chat Home Purification

- keep the model selector as the hero identity
- strengthen the centered empty-state composition
- further demote contextual metadata so the screen reads as chat-first, not thread-first
- keep suggestions and composer as the dominant visual center

### 4. Controls Panel Compression

- reduce row spacing, field spacing, and action emphasis
- keep the current OpenPort capability set while making the panel feel closer to Open WebUI’s lighter `Controls`
- keep files, valves, system prompt, context, and advanced params, but reduce overall form density

### 5. Settings / Tools Density

- tighten settings layout and field rhythm
- add explicit toggle-field layout for interface defaults
- widen and tighten the tools menu so it reads more like a context/actions launcher than a raw list

## Completed In This Wave

### Root Entry

- anonymous `/` now uses a compact auth-first shell instead of the previous landing treatment
- navbar glass/background weight was reduced to feel like app entry rather than marketing chrome

### Sidebar

- sidebar grid rows, spacing, type size, and footer density were all reduced
- `Projects`, `Chats`, and `Pinned Models` now read more like organizational sections than management blocks
- account and workspace switcher weight was reduced

### Chat Home

- header rhythm and topbar density were tightened
- empty-state model hero treatment was enlarged and centered
- hero composer height and spacing were reduced to better match Open WebUI’s centered home composition
- empty-state copy hierarchy now favors model identity and composer first

### Controls

- controls spacing, panel padding, file rows, and field density were compressed
- panel intro now reads more like a session/draft context label than a configuration heading

### Settings and Tools

- settings nav/panel spacing and field density were tightened
- toggle fields now use a consistent compact layout
- tools menu width and density were adjusted to better match the Open WebUI input menu feel

## Acceptance Criteria

This wave is complete when:

- anonymous `/` no longer reads as a landing page
- sidebar feels like a navigation rail rather than a workspace admin column
- `/chat` empty state reads primarily as a centered chat home
- controls feel like a companion panel instead of a form-heavy configuration screen
- settings and composer tools feel denser and closer to Open WebUI interaction patterns
