# OpenPort Tools Package Closure Plan

## Goal

Close the remaining high-value `Workspace > Tools` parity gap by adding a package-level workflow close to Open WebUI's toolkit asset handling:

1. Export tool as portable package.
2. Import package as new tool or into existing target tool.
3. Keep server-side validation and deterministic package checksum.
4. Expose package actions through a dedicated tool menu.

## Open WebUI references

- `open-webui-main/src/lib/components/workspace/Tools/ToolkitEditor.svelte`
- `open-webui-main/src/lib/components/workspace/Tools/ToolMenu.svelte`
- `open-webui-main/src/lib/components/workspace/Tools.svelte`

## Scope

### Backend

- `GET /workspace/tools/:id/package`
- `POST /workspace/tools/package/import`
- Package payload includes `metadata`, `tool`, `validation`.
- Checksum generated from package core payload (sha256).
- Import supports:
  - create new tool (preferred source tool id when available)
  - update existing tool via `targetToolId`
  - `forceEnable` override

### Web client

- Add API client functions for tool package export/import.
- Export new package contract types for component usage.

### UI

- Add `WorkspaceToolMenu` (tool-specific action menu).
- Add package actions:
  - Export package
  - Copy package payload
  - Paste package from clipboard
  - Import package file (auto-detect package payload)
- Keep legacy JSON list import/export compatible.

## Execution checklist

| Item | Status | Notes |
| --- | --- | --- |
| API package export/import routes fully implemented in service | done | `workspace-resources.service.ts` now includes `exportToolPackage` + `importToolPackage` |
| API package normalization/validation/checksum | done | package parser + validation report + sha256 checksum |
| Web API client functions for package workflow | done | `fetchWorkspaceToolPackage` + `importWorkspaceToolPackage` |
| Tools list switched to dedicated tool menu | done | new `workspace-tool-menu.tsx` integrated |
| Tools list package import/export UX | done | file/clipboard package import and per-item package export/copy |
| Build verification (`build:api`, `build:web`) | done | both commands passed on 2026-03-15 local run |
| Parity/progress docs synchronization | done | parity matrix + progress doc updated in this wave |
