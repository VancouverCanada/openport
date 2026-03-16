# OpenPort Workspace Critical Parity Closure (2026-03-16)

## Scope

Close the 5 high-impact parity gaps identified in latest audit:

1. Auth/Workspace persistence
2. Knowledge ACL coverage (`collection/document/source/chunk`)
3. Access interaction parity (resource modal as primary UX)
4. Entry routing semantics (`/` as authenticated workspace entry)
5. Build-level verification for this wave

## Implementation status

| Gap | Status | Implementation |
| --- | --- | --- |
| Auth/Workspace was memory-only | done | `IdentityStateService` now supports postgres persistence backend and follows `OPENPORT_API_STATE_BACKEND` with postgres-first auto-detection (`OPENPORT_DATABASE_URL` present => postgres). |
| Knowledge ACL missing source/chunk line | done | Added independent source/chunk grant persistence (`openport_project_knowledge_source_grants`, `openport_project_knowledge_chunk_grants`) and rewired service read/share/revoke away from item grant projection. |
| Access still page-first | done | Workspace resources now open Access via in-resource modal (`WorkspaceResourceAccessModal` / `WorkspaceKnowledgeAccessModal`) in list+editor+knowledge detail surfaces, and legacy `/workspace/*/[id]/access` routes were removed. |
| Entry route semantics different from Open WebUI | done | Auth success and home session gate now land on `/` workspace shell (chat workbench), no forced `/chat` redirect from login/register/home gate. |
| No closure verification | done | `apps/api` and `apps/web` production builds pass after closure changes. |

## API changes in this wave

- `GET/POST/DELETE /projects/knowledge/collections/:collectionId/access-grants`
- `GET/POST/DELETE /projects/knowledge/:itemId/access-grants`
- `GET/POST/DELETE /projects/knowledge/sources/:sourceId/access-grants`
- `GET/POST/DELETE /projects/knowledge/chunks/:chunkId/access-grants`

## Frontend changes in this wave

- `WorkspaceKnowledgeAccessModal` supports `item/collection/source/chunk`.
- Knowledge source detail and chunk detail now expose Access action and modal.
- Home/auth entry flow aligned to `/` as authenticated start.
- Removed legacy `/workspace/*/[id]/access` compatibility routes; Access is modal-only in resource context.
- Removed `/settings/access` page and Settings Access tab; settings now use `/settings/workspaces` as canonical governance entry.

## Verification

- `npm --prefix apps/api run build` ✅
- `bash scripts/with-modern-node.sh npm --prefix apps/web run build` ✅

## Notes

- Source/chunk ACL is now independently persisted and managed as first-class resource grants.
- `ApiStateStoreService` and `IdentityStateService` are both postgres-first when database config is available, with file storage kept as explicit fallback path.
