# OpenPort Prompt Publishing Parity Plan

## Goal

Push `Workspace > Prompts` closer to the Open WebUI prompt publishing workflow by introducing a persisted publishing state instead of relying only on export/copy/share helpers.

## References

- `open-webui-main/src/lib/components/workspace/Prompts/PromptEditor.svelte`
- `open-webui-main/src/lib/components/workspace/Prompts/PromptMenu.svelte`
- `open-webui-main/src/lib/components/workspace/Prompts/PromptHistoryMenu.svelte`

## Scope

1. Extend the prompt resource model with publishing fields.
2. Add backend `publish / unpublish` actions.
3. Surface publishing state in the prompt list.
4. Add a publishing section to the prompt editor.
5. Allow publishing a selected history version from the history menu.

## Data model

- `publishedVersionId: string | null`
- `publishedAt: string | null`

Publishing is version-backed:
- if a version is explicitly selected, publish that version
- otherwise publish the production version
- if no production version exists, publish the latest available version

## Expected outcome

- Prompt list shows which prompts are published.
- Prompt list menu exposes `Publish / Unpublish`.
- Prompt editor exposes current publishing state.
- Prompt history menu can publish a historical version directly.
- Publishing state is durable in file-backed and Postgres-backed API state.
