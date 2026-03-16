# OpenPort Workspace Operations Parity Plan

## Goal

Continue moving `Workspace` toward Open WebUI's real operational behavior instead of stopping at route parity.

This iteration focuses on three areas that still materially differ from local `open-webui-main`:

- `Knowledge` should expose layered management at the top level, not only inside deep detail pages
- `Prompts` should support a stronger share/community workflow
- `Tools` should behave more like a toolkit editor with stronger import/export and payload preview loops

## Open WebUI References

The implementation for this iteration was guided by local Open WebUI modules:

- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/Knowledge.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/Prompts.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/Tools/ToolkitEditor.svelte`

The main patterns reused here are:

- filtered list operations as first-class workflow
- easy export/share loops around the currently visible subset
- structured preview blocks in editors before save
- knowledge views that distinguish collections, documents, sources, and retrieval chunks

## Scope

### 1. Knowledge top-level layered management

Upgrade `/workspace/knowledge` from a single mixed list to layered views:

- `Documents`
- `Collections`
- `Sources`
- `Chunks`

Each layer should reuse the existing OpenPort resource data and support:

- active view toggle
- view-aware search text
- visible subset export

### 2. Prompts share/community workflow

Strengthen prompt operations around Open WebUI-style sharing:

- copy visible commands
- copy per-item community payload
- preserve existing visible subset sharing
- expose community payload preview in the editor

### 3. Tools toolkit workflow

Strengthen toolkit operations without introducing a new backend model:

- list filters for `scope` and `tag`
- copy visible manifests
- editor import from clipboard
- editor copy toolkit payload
- runtime example payload preview

## Implementation Notes

### Knowledge

File:

- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/components/workspace-knowledge.tsx`

Changes:

- add `knowledgeView`
- add source ledger aggregation
- add chunk coverage aggregation
- add `Export visible`
- render view-specific resource lists

### Prompts

Files:

- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/components/workspace-prompts.tsx`
- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/components/workspace-prompt-editor.tsx`

Changes:

- batch command copy
- per-item community payload copy
- editor payload preview

### Tools

Files:

- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/components/workspace-tools.tsx`
- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/components/workspace-tool-editor.tsx`

Changes:

- `scope` and `tag` filters
- visible manifest copy
- clipboard import
- toolkit payload copy
- runtime example preview

## Validation

Required validation:

- `npm run build:web`
- `npm run compose:up`
- `curl http://127.0.0.1:3100/workspace/knowledge`
- `curl http://127.0.0.1:3100/workspace/prompts`
- `curl http://127.0.0.1:3100/workspace/tools`

## Expected Outcome

After this iteration, `Workspace` still will not be a byte-for-byte Open WebUI clone, but the operator loops will be much closer:

- easier knowledge inspection by layer
- easier prompt sharing and handoff
- stronger toolkit editing and transfer workflow
