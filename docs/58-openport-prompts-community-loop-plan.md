# OpenPort Prompts Community Loop Plan

## Goal

Complete the remaining `Prompts publishing/community` loop so OpenPort is closer to Open WebUI's prompt workflow:

- prompt can be version-published
- prompt can be marked as submitted to a community handoff flow
- submission status is persisted and visible in list/editor/menu

## References (Open WebUI)

- `open-webui-main/src/lib/components/workspace/Prompts.svelte`
- `open-webui-main/src/lib/components/workspace/Prompts/PromptMenu.svelte`
- `open-webui-main/src/lib/components/workspace/Prompts/PromptEditor.svelte`

## Scope (Wave 2/5)

1. Extend prompt contract with community submission metadata.
2. Add backend API for community submit/retract.
3. Persist the new fields in file and Postgres state backends.
4. Add frontend list/editor/menu operations for submit/retract and status filtering.
5. Update parity/progress docs and run build verification.

## Data model additions

- `communityStatus: 'none' | 'submitted'`
- `communitySubmittedVersionId: string | null`
- `communitySubmittedAt: string | null`
- `communitySubmissionUrl: string | null`
- `communitySubmissionNote: string`

## API additions

- `POST /workspace/prompts/:id/community/submit`
  - optional `versionId`
  - optional `submissionUrl`
  - optional `note`
- `POST /workspace/prompts/:id/community/retract`

Submit behavior:

- pick target version in this order:
  1. explicit `versionId`
  2. current `publishedVersionId`
  3. current `productionVersionId`
  4. latest saved version
- ensure `publishedVersionId` exists for the submitted version
- persist community metadata

## Progress

- [x] Plan doc created
- [x] Contracts + DTO + API routes updated
- [x] Service logic for submit/retract implemented
- [x] State store (file/postgres) persistence updated
- [x] Web API client updated
- [x] Prompt list/menu/editor UI integrated
- [x] Parity/progress docs updated
- [x] Build verification completed
