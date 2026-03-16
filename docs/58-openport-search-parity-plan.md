# OpenPort Search Parity Plan

## Goal

Close the remaining high-value `search parity` gap against the local `open-webui-main` implementation by upgrading the current search modal from a chat/note finder into a broader command-palette style workspace search surface.

## Open WebUI References

Primary local references used for this pass:

- `src/lib/components/layout/SearchModal.svelte`
- `src/lib/components/layout/Sidebar/SearchInput.svelte`
- `src/lib/components/layout/Sidebar.svelte`

## Current Gap

Before this pass, OpenPort search already had:

- recent searches
- recommendations
- chat/note search
- preview panel
- keyboard navigation

But it still lacked the higher-value Open WebUI style parity points:

- unified resource search in one modal
- action-first command palette behavior
- richer empty-state and sectioned result categories
- better preview coverage beyond chats and notes

## Implementation Scope

This pass upgrades the existing modal instead of creating a second search surface.

### 1. Shared search semantics

- extend local search parsing to support:
  - `type:model`
  - `type:prompt`
  - `type:tool`
  - `type:skill`
  - `type:knowledge`
  - `type:action`
- add `>` command mode for quick actions

### 2. Unified result surface

- keep server-backed chat/note search
- add client-aggregated workspace resources:
  - models
  - prompts
  - tools
  - skills
  - knowledge
- section results by category, closer to Open WebUI's action-first search structure

### 3. Action palette

- add quick actions for:
  - new chat
  - archived chats
  - pinned chats
  - notes
  - workspace
  - models
  - knowledge
  - prompts
  - tools
  - skills

### 4. Preview parity

- keep existing chat/note preview
- add lightweight preview cards for:
  - models
  - prompts
  - tools
  - skills
  - knowledge
  - actions

## Files

- `apps/web/src/lib/workspace-search.ts`
- `apps/web/src/components/workspace-search-modal.tsx`
- `apps/web/src/components/workspace-search-input.tsx`
- `apps/web/src/app/globals.css`

## Acceptance

- `Cmd/Ctrl+K` opens one search surface
- `>` enters action mode
- searching returns chats, notes, models, prompts, tools, skills, and knowledge
- selecting any result opens the correct route
- preview panel works for every major result category
- `npm run build:web` passes
- Docker product stack remains healthy
