# OpenPort Settings/Data Controls Parity Plan

## Goal

Close the next Open WebUI parity gap by turning OpenPort chat settings from a lightweight modal into a real data-controls surface. The target is the same product layer that Open WebUI exposes through:

- `src/lib/components/chat/SettingsModal.svelte`
- `src/lib/components/chat/Settings/DataControls.svelte`
- `src/lib/components/layout/ArchivedChatsModal.svelte`

This phase does not attempt full Open WebUI file storage parity. It focuses on the high-value chat data controls that materially change how the application is operated:

- import chats
- export chats
- archive all chats
- delete all chats
- archived chats entry
- raw persisted session inspection
- workspace file surface entry

## Current Gap

Before this phase, OpenPort already had:

- chat persistence in API-backed storage
- archived chat routing in `/chat?view=archived`
- session-level archive/pin/tag settings
- a searchable settings modal shell

But the `Data` tab was still thin. It only exposed:

- archived chat view link
- raw sessions feed link

Compared with Open WebUI `DataControls.svelte`, the missing behaviors were:

- explicit import/export flow
- bulk archive action
- bulk delete action
- data-focused summaries
- modal-level destructive confirmations

## Implementation Plan

### 1. Product contracts

Add chat import/export response shapes to shared contracts so API and web stay typed:

- `OpenPortChatSessionsExportResponse`
- `OpenPortChatSessionsImportResponse`

### 2. API parity slice

Extend `apps/api/src/ai` with the missing bulk operations:

- `GET /ai/sessions/export`
- `POST /ai/sessions/import`
- `POST /ai/sessions/archive-all`
- `DELETE /ai/sessions`
- `DELETE /ai/sessions/:id`

The implementation should keep using the existing durable store abstraction so both file and Postgres backends remain supported.

### 3. Import normalization

Import should accept exported OpenPort chat session payloads and normalize them into valid persisted sessions:

- preserve messages, settings, archive state, pin state, tags
- rebind imported sessions to the current user
- avoid ID collisions by remapping duplicates

### 4. Settings modal data controls

Upgrade `chat-settings-modal.tsx` `Data` tab into a real operational surface:

- show active and archived counts
- import JSON export
- export JSON snapshot
- archive all chats
- delete all chats
- open archived chat view
- open workspace files surface
- open raw session feed

All destructive actions should go through the shared confirmation dialog.

### 5. Styling and UX parity

Keep the implementation aligned with the Open WebUI information architecture:

- action rows instead of large panels
- small data summary stats
- compact copy and one action per row
- inline feedback after actions

## Acceptance Criteria

This phase is complete when:

1. chat export downloads a JSON snapshot from the current persisted backend
2. chat import restores sessions from that JSON file
3. archive-all moves all active sessions into archived state
4. delete-all removes all persisted sessions
5. the `Data` tab shows current counts for active vs archived chats
6. API and web builds pass
7. Docker stack rebuilds healthy

## Implementation Notes

- Reuse the existing API state store instead of creating a second persistence path.
- Keep the OpenPort naming (`Projects`, `Workspace`) while borrowing Open WebUI structure and action grouping.
- Prefer capability parity over literal UI cloning.
