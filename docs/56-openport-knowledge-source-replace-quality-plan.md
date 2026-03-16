# OpenPort Knowledge Source Replace And Chunk Quality Plan

## Goal

Push `Workspace > Knowledge` closer to the Open WebUI `KnowledgeBase` operating model by adding source-level replacement and chunk-level quality inspection, instead of keeping the knowledge surface limited to browse/export flows.

## Open WebUI reference

- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`

## Scope

1. Add a source replacement API so a knowledge source can be rewritten in place.
2. Add a modal-based source replacement UI in source/document detail flows.
3. Add chunk quality analysis in chunk detail.
4. Keep current retrieval/index persistence model intact.

## Implementation steps

1. Add a `PATCH /projects/knowledge/:itemId/sources/:sourceId` route.
2. Update `ProjectsService` to persist source replacement:
   - replace source label/content
   - clear asset binding when replacing an asset-backed source with text
   - rebuild preview/index state through existing persistence flow
3. Add `replaceProjectKnowledgeSource()` to the web API client.
4. Add a reusable `WorkspaceKnowledgeSourceReplaceModal`.
5. Wire source replacement into:
   - document detail source list
   - source detail linked document actions
6. Add chunk quality heuristics to chunk detail:
   - words
   - sentences
   - lexical diversity
   - retrieval fit / flags
7. Rebuild web/api and verify Docker runtime.

## Expected result

- Source maintenance is no longer limited to `remove/reset/re-index`.
- Knowledge chunk inspection includes quality signals, not just raw preview text.
- The knowledge surface becomes more operational and less read-only, which closes one of the biggest remaining Workspace parity gaps.
