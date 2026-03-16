# OpenPort Tools Modal Editor Parity Plan

## Goal

Move `Workspace > Tools` closer to the Open WebUI `ToolkitEditor` interaction model by taking heavy `manifest` and `valves` editing out of the main editor surface and into dedicated modal flows.

## Open WebUI reference

- `open-webui-main/src/lib/components/workspace/Tools/ToolkitEditor.svelte`

## Scope

1. Keep the main tool editor focused on resource identity and runtime summary.
2. Move manifest editing into a dedicated modal workflow.
3. Move valves and valve schema editing into a dedicated modal workflow.
4. Preserve current OpenPort fields:
   - `manifest`
   - `valves`
   - `valveSchema`
   - `examples`
5. Avoid changing backend contracts for this batch.

## Implementation plan

1. Add a manifest modal component.
2. Add a valves modal component.
3. Replace inline manifest and valves blocks in `WorkspaceToolEditor` with modal launchers and summaries.
4. Add modal-specific layout styles in `globals.css`.
5. Rebuild `apps/web` and verify Docker runtime.

## Expected result

- `WorkspaceToolEditor` becomes lighter and closer to Open WebUI’s modal-first toolkit editing flow.
- Manifest and valves/schema editing are still fully available, but no longer dominate the page.
- This closes the parity gap around missing modalized tool editing, while keeping current OpenPort resource semantics intact.
