# OpenPort Projects, Files, and Data Controls Final Plan

## Goal

Close the remaining deep product gaps between OpenPort chat-first surfaces and Open WebUI in three areas:

1. Project organization backed by server data
2. Full file and webpage attachment flows from chat surfaces
3. More complete settings and data-controls operations for chat data and attached assets

This wave keeps OpenPort terminology where intentionally different:

- `Projects` stays the organizational term
- `Connections` and `Workspace` remain product-level surfaces

## Open WebUI References

Primary Open WebUI modules referenced for this wave:

- `/Users/Sebastian/open-webui-main/backend/open_webui/routers/folders.py`
- `/Users/Sebastian/open-webui-main/backend/open_webui/routers/files.py`
- `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/layout/FilesModal.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/MessageInput/InputMenu.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/MessageInput/AttachWebpageModal.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/SettingsModal.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/chat/Settings/DataControls.svelte`

## Current Gap Summary

Before this wave:

- project hierarchy existed, but project metadata and sidebar visibility were still shallow
- chat composer tools could reference context, but files and webpages were not a complete end-to-end asset flow
- chat settings exposed data controls, but `Files` still redirected into workspace instead of behaving like an application-level modal
- chat messages did not persist structured attachment metadata end-to-end

## Implementation Plan

### 1. Project Metadata and Organization Behavior

- expand project meta to support:
  - `description`
  - `icon`
  - `color`
  - `hiddenInSidebar`
- preserve these fields in:
  - product contracts
  - API DTOs
  - API persistence layer
  - client normalization layer
- use the metadata in the sidebar so projects can behave like lightweight organization entries

### 2. File and Webpage Asset Flows

- reuse the existing project asset infrastructure instead of inventing a second upload system
- extend project assets with:
  - `ownerUserId`
  - `sourceUrl`
  - `previewText`
- support application-level asset operations:
  - list assets
  - upload file assets
  - create webpage assets from URL fetches
  - delete assets
- make these operations available from both:
  - chat composer tools
  - settings `Files` modal

### 3. Chat Attachment Persistence

- extend chat message contracts with structured `attachments`
- accept attachments in `POST /ai/sessions/:id/messages`
- persist them in:
  - file-backed state store
  - postgres-backed state store
- render attachment chips inside message bubbles so attached context is visible after send

### 4. Settings and Data Controls Completion

- replace the old `Files` link-out from chat settings with an application-level files modal
- surface file and webpage assets as first-class chat resources
- align the data controls flow more closely with Open WebUI’s modal + data-panel approach while keeping OpenPort’s current workspace model

## Completed in This Wave

### Shared Contracts and Persistence

- chat messages now support structured attachment metadata
- project meta now supports:
  - `description`
  - `icon`
  - `color`
  - `hiddenInSidebar`
- project assets now support:
  - `ownerUserId`
  - `sourceUrl`
  - `previewText`
- persistence was updated in both normalization and postgres storage paths

### Project and Sidebar Behavior

- project create/update forms now support richer project meta
- sidebar now hides projects marked `hiddenInSidebar`
- project tree items render project-specific icon and color when present
- child visibility is based on hidden-aware project filtering

### Files and Webpage Flows

- API now exposes:
  - `GET /projects/assets`
  - `DELETE /projects/assets/:assetId`
  - `POST /projects/assets/web`
- chat composer tools now support:
  - uploading files into chat-scoped assets
  - attaching existing file/webpage assets
  - fetching and attaching webpage snapshots
- chat settings `Data > Files` now opens a dedicated files modal instead of redirecting to workspace

### Chat Attachments

- sent chat messages now persist attachment metadata
- assistant generation uses attachment context without mutating the visible user text into a synthetic payload
- message bubbles now render attachment chips and links

## Acceptance Criteria

This wave is complete when:

- projects can carry richer organization metadata end-to-end
- hidden projects stay out of the sidebar without requiring a second project model
- chat composer can upload files and attach webpage captures without leaving chat
- `Settings > Data > Files` behaves like an application surface, not a redirect
- chat messages retain structured attachment metadata after persistence and reload
