# OpenPort Prompt Menu Parity Plan

## Goal

Bring `Prompts` closer to the local Open WebUI `PromptMenu.svelte` and `PromptHistoryMenu.svelte` interaction model by moving list and version actions into dedicated prompt-specific menus instead of ad hoc inline buttons.

## References

- `open-webui-main/src/lib/components/workspace/Prompts/PromptMenu.svelte`
- `open-webui-main/src/lib/components/workspace/Prompts/PromptHistoryMenu.svelte`
- `open-webui-main/src/lib/components/workspace/Prompts/PromptEditor.svelte`

## Scope

1. Add a prompt-specific resource menu wrapper for list cards.
2. Add a prompt history menu wrapper for version cards.
3. Replace inline version action links in the editor with the new menu.
4. Keep existing OpenPort prompt actions and payload/export flows, but group them into Open WebUI-style menus.

## Implementation notes

- Reuse the shared `WorkspaceResourceMenu` as the underlying primitive.
- Keep prompt-specific labels and action grouping in dedicated wrappers so later parity work can evolve independently from generic resource menus.
- Preserve current OpenPort functionality:
  - copy command
  - copy content
  - copy community payload
  - export
  - duplicate
  - share to community
  - restore version
  - set production version
  - delete non-production version

## Expected outcome

- Prompt list cards expose a dedicated `WorkspacePromptMenu`.
- Prompt version history exposes a dedicated `WorkspacePromptHistoryMenu`.
- Prompt workflow moves one step closer to Open WebUI's menu-oriented asset interaction model.
