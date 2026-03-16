# OpenPort Workspace Parity Matrix (16 Gap Closure)

This matrix tracks the 16 previously `部分对齐` items against Open WebUI workspace patterns.
Status here is now based on implemented code paths in `apps/web` + `apps/api` + `packages/openport-product-contracts`.

## Status legend

- `已对齐`: implemented and wired end-to-end for current OpenPort OSS scope
- `范围说明`: where Open WebUI has additional ecosystem depth, but core parity objective is already closed

## Matrix

| # | Gap item | Status | OpenPort implementation evidence | 范围说明 |
| --- | --- | --- | --- | --- |
| 1 | Workspace capability gating 深度 | 已对齐 | `workspaceCapabilities` from `/auth/me`; module/action guards in `workspace-permissions.ts`, `use-workspace-authority.ts`; backend capability policy + module guard in `workspaces.service.ts` | Includes configurable role-policy matrix and strict workspace access resolution |
| 2 | 统一资源 menu/action 覆盖密度 | 已对齐 | Shared `workspace-resource-menu.tsx`; specialized menus: model/prompt/tool/skill/history; editor header actions integrated | Menu/action system now consistent across list + editor surfaces |
| 3 | Models editor selector/modal 组织深度 | 已对齐 | `workspace-model-editor.tsx` + `workspace-resource-selector-modal.tsx` + `workspace-token-selector-modal.tsx` | Covers filters/features/actions + knowledge/tools/skills/builtin selectors |
| 4 | Models 列表运营交互密度 | 已对齐 | `workspace-models.tsx` with search/filter/sort/pagination + per-resource menu/actions | OSS scope focuses on operator workflow parity |
| 5 | Knowledge 顶层工作流深度 | 已对齐 | `workspace-knowledge.tsx` with document/source/chunk views, add-content menu, lifecycle and batch ops | Matches Open WebUI-style operational flow for local deployment |
| 6 | Knowledge document lifecycle 完整度 | 已对齐 | create/upload/text/web ingest, append/replace/reindex/reset/rebuild, collection move/delete across knowledge pages + project service APIs | Full create-maintain-rebuild cycle is wired |
| 7 | Knowledge source lifecycle orchestration | 已对齐 | source lifecycle modal + batch maintain endpoints (`reindex/reset/remove/replace/rebuild`) | Source-level orchestration now first-class |
| 8 | Knowledge chunk governance 深度 | 已对齐 | chunk detail/search/probe/stats/rebuild and batch rebuild APIs | Includes quality-oriented retrieval probes and stats |
| 9 | Add content / file-centric UX 完整度 | 已对齐 | `workspace-knowledge-add-content-menu.tsx`, upload file/dir, sync dir, add text/webpage, drag-drop overlay | File-centric entry UX no longer placeholder |
| 10 | Tools toolkit editor 深层装配体验 | 已对齐 | `workspace-tool-editor.tsx` + manifest/valves modals + execution chain builder + orchestration graph | Core toolkit assembly interactions are implemented |
| 11 | Toolkit productization 生态深度 | 已对齐 | tool package export/import/copy/paste + checksum + validation API and modal workflow | Closed loop for toolkit packaging in OSS scope |
| 12 | Skills 模块动作层深度 | 已对齐 | `workspace-skills.tsx` + `workspace-skill-menu.tsx` + resource actions + import/export/duplicate/delete | Skill operations now parity-grade for workspace usage |
| 13 | Skills 与 Models/Tools 深层编排关系 | 已对齐 | skill schema includes `linkedModelIds`/`linkedToolIds`; editor supports linking; backend/store persistence and cleanup integrated | Direct orchestration links are persisted and managed |
| 14 | Multi-workspace UX 组织级能力 | 已对齐 | sidebar workspace switching + session persistence; settings workspace governance (`workspace-governance.tsx`) + capability policy + create/update/delete workspace | Organization-grade workspace operations are now connected |
| 15 | 各列表页统一密度（分页/搜索/排序/动作） | 已对齐 | models/prompts/tools/skills/knowledge all have dense list controls and consistent resource actions | Cross-module interaction model is unified |
| 16 | 整体 asset workbench 质感 | 已对齐 | Workspace shell + left-nav + controls + resource-centric pages now follow Open WebUI workbench pattern instead of admin-only layout | Intentional OpenPort branding preserved while interaction model aligns |

## Implementation order executed

1. Capability + policy foundation (backend + frontend gating)
2. Resource menu/action system unification
3. Models/Knowledge/Tools/Skills depth closure
4. Multi-workspace governance closure
5. Dense list interaction unification and final verification

## Verification

- `npm run build:api` passed
- `npm run build:web` passed

## Post-Matrix Audit (Critical 5 Gaps)

| Item | Status | Evidence |
| --- | --- | --- |
| Auth/Workspace persistence governance | 已对齐 | `apps/api/src/auth/auth.service.ts`, `apps/api/src/workspaces/workspaces.service.ts`, `apps/api/src/storage/identity-state.service.ts` |
| Knowledge ACL coverage (`collection/document/source/chunk`) | 已对齐 | `apps/api/src/projects/projects.controller.ts`, `apps/api/src/projects/projects.service.ts`, `apps/web/src/components/workspace-knowledge-access-modal.tsx` |
| Access interaction as resource modal primary path | 已对齐 | `workspace-model/prompt/tool/skill-*` menus + `workspace-resource-access-modal.tsx` + `workspace-knowledge-access-modal.tsx` |
| Entry route semantics (`/` as authenticated workspace home) | 已对齐 | `apps/web/src/components/home-entry-gate.tsx`, `apps/web/src/components/auth/login-form.tsx`, `apps/web/src/components/auth/register-form.tsx` |
| Build-level closure validation | 已对齐 | API + Web production build both pass |
