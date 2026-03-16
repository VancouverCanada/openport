# OpenPort Workspace Resource ACL Plan (Wave 4)

## Goal

Close the remaining high-value gap between OpenPort Workspace and Open WebUI resource governance by shipping real resource-level ACL for:

- `models`
- `prompts`
- `tools`
- `skills`

## Reference alignment

- Open WebUI workspace resource menus and per-resource governance patterns
- OpenPort existing project/note grant model (`access-grants`) reused as backend baseline

## Implementation scope

1. Contracts and state schema
   - Add `OpenPortWorkspaceResourceGrant` and related principal/permission/resource enums.
   - Extend model/prompt/tool/skill contracts with `accessGrants`.
   - Persist ACL in both file state and Postgres state store.
2. Backend authorization
   - Add grant resolution (`public/workspace/user/group`) with permission levels (`read/write/admin`).
   - Enforce resource permission checks on read/write endpoints.
   - Keep module-level capability gating as the outer guard.
3. Backend access-grants API
   - Add `list/share/revoke` for each workspace resource:
     - `/workspace/models/:id/access-grants`
     - `/workspace/prompts/:id/access-grants`
     - `/workspace/tools/:id/access-grants`
     - `/workspace/skills/:id/access-grants`
4. Frontend wiring
   - Add API wrappers for resource grant operations.
   - Add dedicated resource access pages:
     - `/workspace/models/[id]/access`
     - `/workspace/prompts/[id]/access`
     - `/workspace/tools/[id]/access`
     - `/workspace/skills/[id]/access`
   - Add `Access` entry in resource menus.

## Delivery checklist

| Item | Status | Notes |
| --- | --- | --- |
| Contracts: resource grant schema | done | Added in `openport-product-contracts` |
| State store: file + postgres persistence | done | Added `access_grants` columns + normalization defaults |
| Workspace resource read/write permission enforcement | done | List filtering + per-item read/write/admin checks |
| Access-grants endpoints for models/prompts/tools/skills | done | Controller + service implemented |
| Frontend API wrappers | done | `fetch/share/revokeWorkspaceResource...` added |
| Frontend access pages + menu entry | done | Access routes and menu links implemented |
| Build verification | done | `npm run build:api` and `npm run build:web` passed |

## Notes

- Current safeguard keeps a workspace-level admin grant to prevent accidental lockout.
- This is an intermediate parity step toward fully dynamic RBAC orchestration.
