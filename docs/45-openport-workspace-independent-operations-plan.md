# OpenPort Workspace Independent Operations Plan

## Goal

Continue reducing the gap between OpenPort `Workspace` and local `open-webui-main` by turning high-value resource views into more independent operational flows.

This iteration focuses on:

- top-level `Knowledge` operations becoming route-backed flows instead of only in-page toggles
- stronger prompt sharing packages
- stronger tool runtime payload export loops

## Open WebUI References

Implementation direction for this iteration continues to reference:

- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/Knowledge.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/Prompts.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/Tools/ToolkitEditor.svelte`

The main pattern being reused is that resource operations should feel like explicit workflows, not hidden secondary actions.

## Scope

### 1. Knowledge route-backed operation views

Create route-backed top-level views:

- `/workspace/knowledge`
- `/workspace/knowledge/collections`
- `/workspace/knowledge/sources`
- `/workspace/knowledge/chunks`

These all reuse the same core component but behave as distinct operator entry points.

### 2. Prompt community bundle flow

Add an explicit downloadable community bundle for the currently visible prompt set, separate from plain JSON export.

### 3. Tool runtime bundle flow

Add stronger runtime-oriented export loops:

- per-tool runtime payload copy
- visible runtime bundle download

## Implementation Notes

### Knowledge

Files:

- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/components/workspace-knowledge.tsx`
- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/app/workspace/knowledge/page.tsx`
- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/app/workspace/knowledge/collections/page.tsx`
- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/app/workspace/knowledge/sources/page.tsx`
- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/app/workspace/knowledge/chunks/page.tsx`

Changes:

- `WorkspaceKnowledge` now accepts `initialView`
- the knowledge header uses route-backed view entry buttons
- each knowledge layer can now be deep-linked directly

### Prompts

File:

- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/components/workspace-prompts.tsx`

Changes:

- add `Community bundle` download for visible items

### Tools

File:

- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/components/workspace-tools.tsx`

Changes:

- add per-item runtime payload copy
- add visible runtime bundle download

## Validation

Required validation:

- `npm run build:web`
- `npm run compose:up`
- `curl http://127.0.0.1:3100/workspace/knowledge`
- `curl http://127.0.0.1:3100/workspace/knowledge/collections`
- `curl http://127.0.0.1:3100/workspace/knowledge/sources`
- `curl http://127.0.0.1:3100/workspace/knowledge/chunks`

## Expected Outcome

After this iteration:

- `Knowledge` becomes easier to operate as separate workflows
- `Prompts` become easier to move into a community-style handoff path
- `Tools` become easier to export as runnable payload packs
