# OpenPort Workspace Closure Wave 3 Plan

## Goal

Close the remaining high-value UX gap in Workspace parity with a real multi-workspace switch flow:

1. expose workspace switching directly in the left sidebar,
2. persist selected workspace in the client session,
3. reset workspace-scoped local caches on switch,
4. hard-refresh routing context to avoid stale thread/project state.

## Open WebUI alignment intent

- Open WebUI is optimized around a single active work context with immediate UI refresh.
- This wave applies the same operating model in OpenPort by making active workspace an explicit shell-level control.

## Implementation steps

1. Add a session-level helper to switch `workspaceId` safely.
2. Extend sidebar data load with `/workspaces`.
3. Add workspace selector UI in sidebar footer.
4. On selection change:
   - write session workspace id,
   - clear local project/knowledge caches,
   - emit workspace update event,
   - route back to `/chat` and refresh.

## Progress

| Task | Status | Notes |
| --- | --- | --- |
| Session workspace switch helper | done | `switchSessionWorkspace` added in `openport-api.ts` |
| Sidebar workspaces data load | done | `fetchWorkspaces` now loaded in `WorkspaceSidebar` |
| Sidebar workspace selector UI | done | footer selector added with current workspace binding |
| Workspace switch runtime flow | done | cache reset + event emit + route refresh wired |
| Build verification | done | `npm run build:web` + `npm run build:api` passed |
| Product health verification | done | `npm run health:product` passed (`reference/api/web`) |
