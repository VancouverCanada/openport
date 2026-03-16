# OpenPort Search Stage 2-3 Implementation Plan

## Scope

This document narrows the broader search parity plan in [docs/22-openport-search-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/22-openport-search-parity-plan.md).

This phase implements only:

1. operator autocomplete and search syntax UX
2. richer highlight rendering, preview behavior, and result loading UX

This phase explicitly does **not** implement project persistence or server-native `project:` filtering. That backend ownership is handled separately.

## Product Direction

Search remains:

- a pure search surface
- a keyboard-first navigation layer
- a preview-first workflow for chats and notes

Search does **not** become:

- a command palette
- a create-action launcher
- a second primary navigation system

## Stage 2: Operator UX

### Operators kept active

- `project:`
- `type:`

### UX work in this phase

- inline operator suggestions while typing
- keyboard accept via `Tab` or `Enter`
- clearer filter hint copy
- recent search history when the input is empty

### Deliberate non-goals

- `tag:`
- `archived:`
- `pinned:`

Those are intentionally deferred until the backend result model and note/chat search metadata are expanded.

## Stage 3: Preview, Highlighting, Loading

### Highlighting

- merge backend highlight ranges with lightweight client-side term matching
- support repeated matches in both title and excerpt
- apply highlight rendering in results and preview content

### Preview

- chat preview should favor messages that contain the current query terms
- note preview should load the full note record and show richer context:
  - content preview
  - tags
  - pinned / archived state

### Loading UX

- keep paginated backend search
- remove action pseudo-results
- auto-load more when scrolling near the bottom

## Acceptance Criteria

- empty search shows recent searches instead of action items
- `project:` and `type:` suggestions remain keyboard-usable
- search results highlight repeated terms
- chat preview favors matching messages when available
- note preview renders more than the list excerpt
- additional pages load automatically while scrolling

## Verification

- `npm run build`
- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`
- manual check:
  - open search with `Cmd/Ctrl + K`
  - test `project:` autocomplete
  - test `type:` autocomplete
  - verify recent searches when input is empty
  - verify note preview detail
  - verify chat preview on matched content
  - verify auto-pagination on longer result sets
