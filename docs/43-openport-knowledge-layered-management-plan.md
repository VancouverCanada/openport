# OpenPort Knowledge Layered Management Plan

## Goal

Continue aligning `Workspace > Knowledge` with the layered management model used by local `open-webui-main`, especially the split between:

- collection-level operations
- document-level inspection
- source-level traceability
- chunk-level retrieval visibility

This iteration deliberately stays inside the existing OpenPort route model and deepens behavior rather than adding another parallel module.

## Open WebUI References

The implementation for this iteration was guided by the local Open WebUI knowledge workspace structure:

- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/Knowledge.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`

The main design ideas reused here are:

- search and filter first
- collection pages that feel like operational knowledge views, not static detail cards
- explicit visibility into the retrieval layer
- fast export/copy loops around the currently visible subset

## Scope

### 1. Document / Source / Chunk view switching

Introduce explicit layered views instead of relying only on stacked sections.

- Collection detail:
  - `Documents`
  - `Sources`
  - `Chunks`
- Document detail:
  - `Document`
  - `Sources`
  - `Chunks`

### 2. View-aware export

Support exporting the currently visible layer so operators can move quickly between inspection and external analysis.

- collection visible documents
- collection visible sources
- collection visible chunk-heavy documents
- document visible content state
- document visible sources
- document visible chunk preview

### 3. View-aware filtering

Make filters match the active layer rather than always speaking in document terms.

- collection search label/placeholder changes per active layer
- source filters apply to source view
- chunk filters apply to chunk view
- document detail adds source kind filtering

## Implementation Notes

### Collection detail

File:

- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/components/workspace-knowledge-collection-detail.tsx`

Changes:

- add `collectionView`
- derive filtered subsets for:
  - documents
  - source ledger
  - chunk coverage
- add `Export visible`
- only render the active layer list

### Document detail

File:

- `/Users/Sebastian/Fidelock-Multiple- Platform/openport/apps/web/src/components/workspace-knowledge-detail.tsx`

Changes:

- add `detailView`
- add `sourceKindFilter`
- add `Export visible`
- render document/source/chunk inspection as separate modes

## Validation

Required validation after implementation:

- `npm run build:web`
- `npm run compose:up`
- `curl http://127.0.0.1:3100/workspace/knowledge`
- `curl http://127.0.0.1:3100/workspace/knowledge/collections/collection_general`

## Result

After this iteration, `Knowledge` is still not a full Open WebUI clone, but it is materially closer to Open WebUI's operational model:

- clearer layer separation
- better retrieval inspection
- faster export loops
- less ambiguity between documents, sources, and chunks
