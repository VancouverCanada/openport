# OpenPort Knowledge Batch Source Maintenance And Chunk Probe Plan

## Goal

Close the remaining high-value `Knowledge` parity gaps against Open WebUI `KnowledgeBase` by adding:

1. source-level **batch maintenance** actions, and
2. chunk-level **retrieval hit probe** analysis.

## Open WebUI references

- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge/Knowledge.svelte`

## Scope

### Source operations

- Keep existing single-item operations (`reindex/reset/remove/replace`).
- Add a source-level batch endpoint so linked documents are maintained through one backend action instead of front-end loops.
- Add source-level batch replace flow via modal.

### Chunk operations

- Add a chunk search/probe endpoint on knowledge item scope.
- Add a chunk detail probe panel that shows ranked chunk matches for a query and highlights the current chunk.

## Implementation steps

1. Add source batch maintenance DTO and controller route.
2. Implement service method for batch actions:
   - `reindex`
   - `reset`
   - `remove`
   - `replace`
3. Add chunk probe route and service search method for item chunks.
4. Extend web API client with:
   - `maintainProjectKnowledgeSourceBatch()`
   - `searchProjectKnowledgeChunks()`
5. Add `WorkspaceKnowledgeSourceBatchReplaceModal`.
6. Wire source detail to use backend batch actions (replace/reindex/reset/remove).
7. Add retrieval probe panel in chunk detail.
8. Rebuild API/Web and verify Docker runtime + route/API behavior.

## Expected result

- Source maintenance moves from client-side item loops to backend-driven batch execution.
- Chunk detail supports retrieval-oriented query probing with ranked hits.
- Knowledge operations shift further from inspection-only to operational maintenance.

## Implementation status (2026-03-16)

- Status: `done` (Wave 1/5 for Knowledge deep operations)
- Completed:
  1. Added source batch maintain API:
     - `POST /api/projects/knowledge/sources/:sourceId/batch`
     - actions: `reindex | reset | remove | replace | rebuild`
  2. Added chunk retrieval probe API:
     - `GET /api/projects/knowledge/:itemId/chunks/search?q=...&limit=...`
  3. Added frontend source batch replace modal:
     - `WorkspaceKnowledgeSourceBatchReplaceModal`
  4. Switched source detail page batch actions from client loops to backend batch endpoint.
  5. Added chunk detail retrieval probe panel and ranked hit list.
  6. Updated contracts and web API client for both new endpoints.
  7. Added `POST /api/projects/knowledge/:itemId/rebuild` and `POST /api/projects/knowledge/batch/rebuild`.
  8. Added `GET /api/projects/knowledge/chunks/stats` and wired dashboard stats cards in `WorkspaceKnowledge`.

## Runtime verification

- Docker runtime:
  - `docker compose -f compose/docker-compose.yml ps` shows `api/web/postgres/reference-server` all `healthy`.
- Route checks:
  - `GET http://127.0.0.1:3100/workspace/knowledge/sources` -> `200`
  - `GET http://127.0.0.1:3100/workspace/knowledge/chunks` -> `200`
- API end-to-end check (with `x-openport-user: user_demo`, `x-openport-workspace: ws_user_demo`):
  1. create knowledge text item
  2. batch replace source
  3. run chunk search probe
  4. verified result:
     - `batchAffectedCount: 1`
     - source label updated to `Batch Replaced Source`
     - `searchMatchCount: 1`
     - top snippet contains replacement token
