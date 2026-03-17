## OpenPort Projects Phase 3 Enhancement Plan

This document defines the next implementation phase after `Projects` reached functional parity with Open WebUI organization surfaces.

The goal of this phase is not visual parity. The goal is to close the heavier product gaps that still exist between the current `openport` implementation and the broader `Open WebUI` workspace stack:

- real asset storage
- retrieval-backed project knowledge
- realtime multi-device sync
- grant-based sharing and admin controls

### Reference Sources

The implementation in this phase references these local Open WebUI sources:

- `/Users/Sebastian/open-webui-main/src/lib/apis/files/index.ts`
- `/Users/Sebastian/open-webui-main/src/lib/apis/knowledge/index.ts`
- `/Users/Sebastian/open-webui-main/src/lib/components/workspace/common/AccessControl.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar/Folders/FolderModal.svelte`

It also reuses existing `openport` patterns already present in the repo:

- `notes` sharing model
- `notes` realtime collaboration gateway
- workspace-scoped API storage

### Scope

This phase implements four areas.

1. Real asset storage
2. Retrieval-backed project knowledge
3. Workspace realtime project sync
4. Project access grants and admin sharing

### Design Decisions

#### 1. Asset Storage

`Projects` will stop storing background images and uploaded files as metadata-only placeholders.

Implementation:

- add a project asset metadata store in the API backend
- persist binary content on the server filesystem
- expose stable asset URLs through the API
- bind project background images and knowledge uploads to stored assets

Non-goals:

- external object storage
- CDN integration
- signed URL workflows

This is a local/private deployment implementation, but it is true server-backed asset storage.

#### 2. Retrieval-Backed Project Knowledge

`Projects` will stop treating workspace knowledge as a passive attachment list.

Implementation:

- extract text from text-like uploads
- chunk extracted text
- build sparse token vectors for chunks
- store chunk index in the backend
- expose project-scoped retrieval search
- inject top retrieval matches into chat requests as project context

This is not an embedding-model RAG pipeline yet. It is a persistent retrieval layer that is compatible with future embedding upgrades.

#### 3. Realtime Sync

`Projects` will gain workspace realtime sync so multiple tabs/devices see project changes without manual refresh.

Implementation:

- add workspace-scoped project events stream
- emit change events on create/update/move/delete/import/share/upload
- add project presence heartbeat for selected project
- refresh sidebar/chat/workspace views from realtime events

The transport in this phase is SSE because:

- it fits the current lightweight product shell
- it avoids adding another client dependency
- it is sufficient for invalidation and presence

#### 4. Access Grants

`Projects` will gain note-style access grants.

Implementation:

- owner is implicit `admin`
- workspace grant defaults to `write`
- project supports `user`, `workspace`, and `public` principal types
- project supports `read`, `write`, and `admin` permissions
- API enforces read/write/admin checks on project operations
- project modal exposes a share UI

### Planned Data Model Changes

#### Shared Contracts

Add:

- `OpenPortProjectAsset`
- `OpenPortProjectKnowledgeChunk`
- `OpenPortProjectKnowledgeMatch`
- `OpenPortProjectKnowledgeSearchResponse`
- `OpenPortProjectPermission`
- `OpenPortProjectPrincipalType`
- `OpenPortProjectGrant`
- `OpenPortProjectGrantResponse`
- `OpenPortProjectPresence`
- `OpenPortProjectCollaborationState`
- `OpenPortProjectEvent`

Extend:

- `OpenPortProjectMeta`
- `OpenPortProjectData`
- `OpenPortProjectKnowledgeItem`
- `OpenPortProject`

#### API Persistence

Add API-backed storage for:

- project assets metadata
- project knowledge chunks

Binary asset content is stored on disk under the OpenPort product data directory.

### Planned API Endpoints

New or expanded `projects` routes:

- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `POST /projects/:id/move`
- `DELETE /projects/:id?deleteContents=true|false`
- `GET /projects/:id/export`
- `POST /projects/import`
- `GET /projects/:id/access-grants`
- `POST /projects/:id/access-grants`
- `DELETE /projects/:id/access-grants/:grantId`
- `GET /projects/:id/collaboration`
- `POST /projects/:id/collaboration/heartbeat`
- `GET /projects/:id/knowledge/search?q=...`
- `GET /projects/knowledge`
- `POST /projects/knowledge/upload`
- `POST /projects/assets/upload`
- `GET /projects/assets/:assetId/content`
- `GET /projects/events/stream`

### Web Integration Plan

#### Project Modal

Upgrade `ProjectModal` to:

- upload background images to server assets
- upload knowledge files with real file content
- list and manage access grants
- keep Open WebUI-style knowledge attachment flow

#### Chat

Upgrade `Chat` to:

- subscribe to workspace project events
- show project presence
- use selected project retrieval matches as contextual prompt material
- consume server-backed background image URLs

#### Workspace

Upgrade `Workspace` page to:

- show knowledge asset status
- show retrieval index state
- show sharing state

### Delivery Order

1. contracts + storage primitives
2. asset storage + content serving
3. project permissions
4. retrieval index + search API
5. realtime events + presence
6. web integration
7. build and compose verification

### Expected Outcome

After this phase:

- `Projects` remain the OpenPort organizational concept name
- project files and images are real backend assets
- project knowledge is searchable and consumable in chat
- project changes propagate across tabs/devices
- projects support grant-based access and admin controls

The remaining differences after this phase should be limited to:

- external object storage providers
- embedding-model/vector-database RAG
- richer org/group-based enterprise permissions
- collaborative editing beyond presence and invalidation

## Implementation Status

As of 2026-03-15, this phase has been implemented in the current `openport` codebase.

Post-implementation recheck:

- the current `Projects` baseline was rechecked after teammate-side `projects` updates
- the phase plan itself did not need structural changes
- one persistence/runtime gap was found and closed during verification:
  - `accessGrants` are now persisted in `openport_projects.access_grants`
  - retrieval search now normalizes chunk vectors to numeric values before scoring

Delivered areas:

- API-backed `Projects`
  - `apps/api/src/projects/projects.service.ts`
  - `apps/api/src/projects/projects.controller.ts`
  - `apps/api/src/storage/api-state-store.service.ts`
- server-backed project assets
  - `apps/api/src/projects/project-assets.service.ts`
- retrieval-backed project knowledge
  - `apps/api/src/projects/project-knowledge-index.ts`
  - `apps/api/src/projects/projects.service.ts`
  - `apps/api/src/ai/ai.service.ts`
- SSE-based realtime invalidation and presence
  - `apps/api/src/projects/project-events.service.ts`
  - `apps/web/src/components/workspace-sidebar.tsx`
  - `apps/web/src/components/chat-shell.tsx`
- access grants and sharing UI
  - `apps/web/src/components/project-modal.tsx`
  - `apps/api/src/projects/dto/share-project.dto.ts`
- workspace/chat UI consumption of storage + retrieval + collaboration state
  - `apps/web/src/components/chat-controls-panel.tsx`
  - `apps/web/src/app/dashboard/workspace/page.tsx`

### Verification

Verified after implementation:

- `npm --prefix apps/api run build`
- `npm run compose:up`
- `GET /api/projects/:id/knowledge/search?q=latency&limit=3` returns ranked matches
- `POST /api/projects/:id/access-grants` persists grants to postgres

Validation executed in this phase:

- `npm --prefix packages/openport-product-contracts run build`
- `npm --prefix apps/api run build`
- `npm --prefix apps/web run build`
- `npm run compose:build`
- `npm run compose:up`
