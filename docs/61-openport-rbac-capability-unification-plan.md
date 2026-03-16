# OpenPort Workspace RBAC + Capability Unification Plan

## Goal

Close the current high-value parity gaps with Open WebUI in one convergent wave:

1. Move from coarse role-only checks to capability-driven module actions.
2. Enforce backend action guards (read/manage) via workspace capability matrix.
3. Unify menu/action orchestration across `Models / Prompts / Tools / Skills`.
4. Deepen `Tools` workflow with modalized package import (targeted import + force-enable).

## Open WebUI references

- `open-webui-main/src/routes/(app)/workspace/+layout.svelte`
- `open-webui-main/src/lib/components/workspace/PromptMenu.svelte`
- `open-webui-main/src/lib/components/workspace/Tools/ToolMenu.svelte`
- `open-webui-main/src/lib/components/workspace/Tools/ToolkitEditor.svelte`

## Scope

### A) Capability-driven RBAC contract

- Extend `OpenPortCurrentUserResponse.permissions` with `workspaceCapabilities`.
- Add per-module action capability shape:
  - `read / manage / import / export / publish / share / validate`

### B) Backend enforcement

- In `WorkspacesService`:
  - compute role -> capability matrix (`owner/admin`, `member`, `viewer`)
  - derive module visibility permissions from capability `read`
  - enforce `assertWorkspaceModuleAccess(..., mode)` from capabilities
- In `AuthService`:
  - return `workspaceCapabilities` in `/auth/me`

### C) Frontend authority + menu unification

- Add capability helpers in `workspace-permissions.ts`:
  - `getWorkspaceCapabilities`
  - `canWorkspaceModuleAction`
- Expose `canModuleAction` in `useWorkspaceAuthority`.
- Apply action-level gating in resource pages:
  - `Models / Prompts / Tools / Skills`
- Add dedicated menu components:
  - `WorkspaceModelMenu`
  - `WorkspaceSkillMenu`
  - (Tool menu already dedicated)

### D) Tools modal depth

- Add `WorkspaceToolPackageModal`:
  - package JSON import textarea
  - optional target tool selection
  - `forceEnable` toggle
  - clipboard paste shortcut
- Integrate modal in `WorkspaceTools`:
  - global import package action
  - per-tool “Import package” action targeting current tool

## Execution checklist

| Item | Status | Notes |
| --- | --- | --- |
| Contracts: workspace capabilities schema | done | `OpenPortWorkspaceResourceCapabilities` added |
| API: role -> capability matrix and module guard enforcement | done | `WorkspacesService` + `AuthService` updated |
| Web: capability helper layer and hook exposure | done | `workspace-permissions` + `use-workspace-authority` updated |
| Web: action-level gating for Models/Prompts/Tools/Skills | done | top actions and per-item actions now capability-driven |
| Web: dedicated model/skill menus | done | `workspace-model-menu.tsx`, `workspace-skill-menu.tsx` |
| Web: tools package import modal workflow | done | `workspace-tool-package-modal.tsx` integrated |
| Build verification (`build:api`, `build:web`) | done | both passed |
| Matrix/progress docs synchronized | done | parity matrix + progress doc updated in same wave |
