# OpenPort 产品化实施进度

本文件记录 `docs/14-openport-productization-plan.md` 的实际执行进展。

更新规则：

- 每完成一个实际仓库改动，就在本文件追加状态。
- 只记录已经落地到仓库的事项，不记录纯讨论。
- 所有状态使用：`todo` / `in_progress` / `done` / `blocked`。

## 当前阶段

- 当前阶段：Phase 8 - 开源治理与版本边界
- 开始日期：2026-03-14
- 当前目标：
  - 把 `openport` 正式收敛为 `openport-oss`
  - 固化 `AGPLv3 + 商标政策 + OSS / Cloud` 的治理边界
  - 保持本地部署开源版与私有云端版的实现边界清晰

## 阶段总览

| Phase | 名称 | 状态 | 说明 |
| --- | --- | --- | --- |
| 0 | 骨架搭建与边界冻结 | done | 建立目录、文档、迁移边界 |
| 1 | Core 抽包与持久化接口 | in_progress | 提炼 `openport-core` 与 store boundary |
| 2 | 产品 API 初始化 | in_progress | 引入 NestJS API 应用 |
| 3 | Web 应用初始化 | in_progress | 引入 Next.js dashboard/auth/web shell |
| 4 | 认证与工作区 | todo | register/login/session/workspace |
| 5 | OpenPort 控制台 | todo | integrations/drafts/audit/monitor |
| 6 | AI 工作台 | todo | chat/session/file/draft/stream |
| 7 | Docker 化与发布 | done | compose/env/bootstrap/health 已验收通过 |
| 8 | 开源治理与版本边界 | in_progress | AGPL、商标政策、OSS/Cloud 分版策略 |

## 2026-03-15 补充进展

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立 Workspace parity matrix 文档 | done | 已新增 `docs/49-openport-workspace-parity-matrix.md`，收敛 Open WebUI 对齐项、状态和顺序 |
| 新增 `/workspace/functions/create` parity route | done | 已新增 alias route，当前对齐为重定向到 `tools/create` |
| 增加强化的 Workspace manage-path gating | done | 已新增 `isWorkspaceManagePath` 与 `canManageWorkspace`，并接入 `WorkspacePermissionGate` |
| 新增 Workspace authority hook | done | 已新增 `useWorkspaceAuthority`，供资源页按真实角色收起管理动作 |
| 新增共享 Workspace resource menu | done | 已新增 `workspace-resource-menu.tsx`，参考 Open WebUI 的 `PromptMenu / SkillMenu / ToolMenu / ModelMenu` |
| Models 资源页切到 menu/action system | done | per-item actions 已统一进共享菜单 |
| Prompts 资源页切到 menu/action system | done | per-item actions 已统一进共享菜单 |
| Tools 资源页切到 menu/action system | done | per-item actions 已统一进共享菜单 |
| Skills 资源页切到 menu/action system | done | per-item actions 已统一进共享菜单，并补 duplicate/export |
| 建立 Models editor 深化方案文档 | done | 已新增 `docs/50-openport-model-editor-depth-plan.md`，收敛 Open WebUI `ModelEditor` 缺口 |
| 扩展 Workspace model 契约与持久化字段 | done | 已新增 `defaultFilterIds / actionIds / defaultFeatureIds / builtinToolIds / promptSuggestions`，并接通 DTO/service/store |
| WorkspaceModelEditor 补齐 Open WebUI 式 section | done | 已新增 `Actions / Default filters / Default features / Builtin tools / Prompt suggestions` |
| WorkspaceModels 列表补模型装配摘要 | done | 已补 builtin tools/actions/default filters/default features/suggestions 摘要，并纳入搜索与导入导出 |
| 建立 Knowledge lifecycle operations 方案文档 | done | 已新增 `docs/51-openport-knowledge-lifecycle-operations-plan.md` |
| 建立 Knowledge source maintenance 方案文档 | done | 已新增 `docs/52-openport-knowledge-source-maintenance-plan.md` |
| 建立 Prompt menu parity 方案文档 | done | 已新增 `docs/53-openport-prompt-menu-parity-plan.md` |
| 建立 Prompt publishing parity 方案文档 | done | 已新增 `docs/54-openport-prompt-publishing-parity-plan.md` |
| 后端新增 Knowledge replace/reset 接口 | done | 已新增 `PATCH /projects/knowledge/:itemId/content` 与 `POST /projects/knowledge/:itemId/reset` |
| Knowledge detail 接入 Replace content / Reset index | done | `WorkspaceKnowledgeDetail` 已新增完整文档生命周期操作 |
| Knowledge source detail 接入批量与单条 Reset | done | `WorkspaceKnowledgeSourceDetail` 已支持 `Reset linked` 与 per-document reset |
| 后端新增 source remove 接口 | done | 已新增 `DELETE /projects/knowledge/:itemId/sources/:sourceId` |
| Knowledge detail 改为返回真实 sources | done | `ProjectsService.getKnowledge` 不再硬编码单条 source，而是返回持久化 source 集 |
| Knowledge source detail 接入批量与单条 Remove | done | `WorkspaceKnowledgeSourceDetail` 已支持 `Remove linked` 与 per-document remove |
| Prompts 列表切到专用 PromptMenu | done | 已新增 `workspace-prompt-menu.tsx`，并替换列表页通用菜单拼装 |
| Prompt version history 切到专用 PromptHistoryMenu | done | 已新增 `workspace-prompt-history-menu.tsx`，并替换编辑器里的 inline version actions |
| Prompt 发布态持久化字段与 API | done | 已新增 `publishedVersionId / publishedAt`，并补 `POST /workspace/prompts/:id/publish` 与 `POST /workspace/prompts/:id/unpublish` |
| Prompts 列表补发布状态与筛选 | done | 已新增 `Published` summary、publication filter 与 per-item `Publish / Unpublish` |
| Prompt 编辑器补发布管理区 | done | 已新增 publishing section，可发布目标版本、取消发布并查看发布时间 |
| 建立 Prompts community loop 方案文档 | done | 已新增 `docs/58-openport-prompts-community-loop-plan.md` |
| Prompt community 提交流程 API | done | 已新增 `POST /workspace/prompts/:id/community/submit` 与 `POST /workspace/prompts/:id/community/retract` |
| Prompt community 状态持久化 | done | Prompt 新增 `communityStatus / communitySubmittedVersionId / communitySubmittedAt / communitySubmissionUrl / communitySubmissionNote`，并完成 file/postgres 持久化 |
| Prompt list/editor/history 接入 community 闭环 | done | 已新增提交/撤回社区操作、community filter/summary、版本级提交动作与 editor 状态区 |
| 建立 Knowledge batch/probe 方案文档 | done | 已新增 `docs/57-openport-knowledge-batch-probe-parity-plan.md` |
| Knowledge source 批量维护后端接口 | done | 已新增 `POST /projects/knowledge/sources/:sourceId/batch`，支持 `reindex/reset/remove/replace` |
| Knowledge chunk retrieval probe 接口 | done | 已新增 `GET /projects/knowledge/:itemId/chunks/search`，返回 item 内 chunk 命中与 score |
| Knowledge source detail 接入后端批量动作 | done | 已把 `Re-index linked / Reset linked / Remove linked` 从前端循环改为后端 batch；并新增 `Replace linked` 批量替换 |
| Knowledge chunk detail 接入 retrieval probe | done | 已新增 query probe 区、命中列表、分数展示与跳转 |
| Knowledge 批量/source-chunk 深操作 Docker 验收 | done | 已通过 `compose:up`、页面路由 200、以及 create->batch-replace->chunk-search 端到端校验 |

## 2026-03-16 收口进展（Knowledge / Tools / Global）

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立本轮收口方案文档 | done | 已新增 `docs/59-openport-knowledge-tools-closure-plan.md`，固化 4 条收口线与验收顺序 |
| 扩展 Knowledge chunking 契约 | done | 新增 `OpenPortKnowledgeChunkingOptions`、batch rebuild/chunk stats 契约，并扩展 chunk search summary |
| 后端新增单条/批量 rebuild 与 chunk stats 接口 | done | 已新增 `POST /projects/knowledge/:itemId/rebuild`、`POST /projects/knowledge/batch/rebuild`、`GET /projects/knowledge/chunks/stats` |
| source batch lifecycle 增加 `rebuild` | done | `POST /projects/knowledge/sources/:sourceId/batch` 现支持 `reindex/reset/remove/replace/rebuild` 全动作 |
| chunk 深操作接入前端 | done | `WorkspaceKnowledge` 已补批量 rebuild modal、source lifecycle 菜单动作与 chunk 质量统计摘要 |
| source/chunk detail 接入 rebuild 深操作 | done | `WorkspaceKnowledgeSourceDetail` 与 `WorkspaceKnowledgeChunkDetail` 已补 document rebuild 流程 |
| Tools 完整校验回路 | done | 已新增 `/workspace/tools/validate`，并在 `WorkspaceToolEditor` 接入保存前校验、校验报告与 schema defaults |
| Tools package 收口方案文档 | done | 已新增 `docs/60-openport-tools-package-closure-plan.md`，固化 package 导入/导出闭环目标与步骤 |
| Tools package API 导入/导出闭环 | done | 已补 `GET /workspace/tools/:id/package` 与 `POST /workspace/tools/package/import` 的 service 实现（含 checksum + validation） |
| Tools 列表专用菜单与 package 操作 | done | 已新增 `workspace-tool-menu.tsx`，并接入 `Export package / Copy package / Paste package / file package import` |
| Tools package 构建验收 | done | 已通过 `npm run build:api` 与 `npm run build:web` |
| RBAC capability 收口方案文档 | done | 已新增 `docs/61-openport-rbac-capability-unification-plan.md`，收敛 capability 驱动 RBAC 与菜单统一方案 |
| `/auth/me` 回传 workspace capabilities | done | `OpenPortCurrentUserResponse.permissions` 已新增 `workspaceCapabilities` 并由后端实际返回 |
| Workspace 后端 capability guard | done | `WorkspacesService` 已从 role-only 升级到 capability matrix，并在 `assertWorkspaceModuleAccess` 做 read/manage 硬校验 |
| 前端 action-level capability gating | done | `workspace-permissions.ts` 与 `useWorkspaceAuthority` 已支持 `canModuleAction`，并接入 `Models/Prompts/Tools/Skills` 操作入口 |
| Models/Skills 专用菜单收口 | done | 已新增 `workspace-model-menu.tsx` 与 `workspace-skill-menu.tsx`，统一资源菜单层 |
| Tools package 导入 modal 深化 | done | 已新增 `workspace-tool-package-modal.tsx`，支持目标工具导入、force-enable 与剪贴板粘贴 |
| RBAC/capability 收口构建验收 | done | 已通过 `npm run build:api` 与 `npm run build:web` |
| capability gating 统一 | done | 已新增 `canManageWorkspaceModule` 并接入 `Models/Knowledge/Prompts/Tools/Skills` 以及 knowledge source/chunk detail 写操作 |
| resource menu 统一行为收口 | done | `WorkspaceResourceMenu` 现对 disabled action 保持可见并禁用，不再直接隐藏 |
| 本轮编译验收 | done | `npm run build:api` 与 `npm run build:web` 均已通过 |
| 本轮 Docker API 验收 | done | 已在 compose 运行态验证 `chunk stats`、`batch rebuild`、`tools validate` 三个新接口返回正常 |
| 本轮关键页面路由验收 | done | 已验证 `GET /workspace/knowledge/sources` 与 `GET /workspace/knowledge/chunks` 均返回 `200` |

## 2026-03-16 收口进展（Workspace Wave 2）

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立 Workspace Wave 2 收口文档 | done | 已新增 `docs/60-openport-workspace-closure-wave2-plan.md` |
| 移除 `/workspace/access` 路由 | done | 已删除 `apps/web/src/app/workspace/access/page.tsx`，保留 `/settings/access` 作为唯一访问管理入口 |
| `/workspace/functions/create` 改为真实页面 | done | 已从重定向改为直接渲染 `WorkspaceToolEditor` 的 function 模式 |
| `WorkspaceToolEditor` 增加 function 语义 | done | 新增 `resourceKind`，标题、提示文案与创建/更新提示按 function/tool 区分 |
| Knowledge 顶层补 quick content 流 | done | `WorkspaceKnowledge` 已新增 `Upload file` 快速上传和 `Add text` modal 快速录入 |
| Knowledge source detail 菜单系统统一 | done | linked collections/documents 的动作已切到 `WorkspaceResourceMenu`，减少内联按钮堆叠 |
| 后端模块权限校验实装 | done | `WorkspacesService` 新增 `assertWorkspaceModuleAccess`，并接入 `WorkspaceResourcesService` 与 `ProjectsService(knowledge)` |
| RBAC 运行态验收（owner/member 对比） | done | 已验证 owner 可访问，member 对 `workspace/models` 与 `projects/knowledge` 返回 `403` |
| 路由收口验收 | done | 已验证 `/workspace/functions/create=200`、`/workspace/access=404`、`/settings/access=200` |

## 2026-03-16 收口进展（Workspace Wave 3）

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立 Workspace Wave 3 收口文档 | done | 已新增 `docs/61-openport-workspace-closure-wave3-plan.md` |
| 会话 workspace 切换能力 | done | `openport-api.ts` 已新增 `switchSessionWorkspace` |
| 左侧导航 workspace selector | done | `WorkspaceSidebar` 已接入 `fetchWorkspaces` 并渲染切换器 |
| workspace 切换收口流程 | done | 已接通 `session workspaceId 更新 + 项目/知识缓存清空 + workspace 事件广播 + 路由刷新` |
| 本轮编译验收 | done | 已通过 `npm run build:web` 与 `npm run build:api` |
| 本轮运行态健康验收 | done | 已通过 `npm run health:product`（reference/api/web） |

## 2026-03-16 收口进展（Workspace Wave 4 - Resource ACL）

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立 Wave 4 资源 ACL 方案文档 | done | 已新增 `docs/62-openport-workspace-resource-acl-plan.md` |
| 资源 ACL 契约扩展 | done | 已新增 `OpenPortWorkspaceResourceGrant` 及 principal/permission/resource 类型，并为 `models/prompts/tools/skills` 补 `accessGrants` |
| API 状态存储持久化 ACL | done | File/Postgres 均已接通 `access_grants` 读写与默认归一化（workspace admin safeguard） |
| 资源级权限判定落地 | done | `WorkspaceResourcesService` 已对 `models/prompts/tools/skills` 接入 read/write/admin 判定与列表过滤 |
| 资源 access-grants API | done | 已补四大模块 `list/share/revoke` 接口 |
| 前端资源 ACL API 封装 | done | `openport-api.ts` 已新增 `fetch/share/revokeWorkspaceResource...` |
| 前端 Access 页面与路由 | done | 已新增 `/workspace/{module}/[id]/access` 页面（models/prompts/tools/skills） |
| 资源菜单接入 Access 入口 | done | Models/Prompts/Tools/Skills 菜单均已接入 `Access` 跳转 |
| 本轮编译验收 | done | `npm run build:api` 与 `npm run build:web` 均已通过 |

## 2026-03-16 收口进展（Workspace Wave 5 - Depth Closure）

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立 Wave 5 深化方案文档 | done | 已新增 `docs/63-openport-workspace-depth-wave5-plan.md` |
| Knowledge batch maintain API | done | 已新增 `POST /projects/knowledge/batch/maintain`，支持 `reindex/reset/rebuild/move_collection/delete` |
| Knowledge documents 批量生命周期 UI | done | `WorkspaceKnowledge` 已新增文档选择、批量动作条与批量 Move collection modal |
| Models selector-style editor | done | `WorkspaceModelEditor` 已改为结构化 token selector（filters/default filters/actions/default features）+ suggested tokens |
| Tools model bindings orchestration | done | `WorkspaceToolEditor` 已新增 model `Link/Builtin` 编排，并在保存后同步到模型 `toolIds/builtinToolIds` |
| 本轮编译验收 | done | `npm run build:api` 与 `npm run build:web` 均已通过 |

## 2026-03-16 收口进展（Workspace Wave 6 - Selector/Knowledge/Toolkit）

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立 Wave 6 深化方案文档 | done | 已新增 `docs/64-openport-workspace-depth-wave6-plan.md` |
| Models modal selector 组件 | done | 已新增 `workspace-token-selector-modal.tsx`，用于统一 token 选择流程 |
| Models editor modalized selector 接线 | done | `WorkspaceModelEditor` 的 filters/default filters/actions/default features 已接入 modal selector workflow |
| Knowledge webpage ingest API | done | 已新增 `POST /projects/knowledge/web`，支持 URL 抓取并落地为知识项 |
| Knowledge Add content menu | done | 已新增 `workspace-knowledge-add-content-menu.tsx`，接入 Upload files/Upload directory/Sync directory/Add webpage/Add text content |
| Knowledge directory upload/sync workflow | done | `WorkspaceKnowledge` 已接入目录导入 modal，并在 sync 模式复用 batch maintain 删除后重导 |
| Tools orchestration graph 视图 | done | `WorkspaceToolEditor` 已新增 toolkit orchestration graph，展示 integration->tool->model route 链路 |
| 本轮编译验收 | done | `npm run build:api` 与 `npm run build:web` 均已通过 |

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立 Knowledge reindex operations 方案文档 | done | 已新增 `docs/48-openport-knowledge-reindex-operations-plan.md` |
| 后端新增 knowledge reindex 接口 | done | 已新增 `POST /projects/knowledge/:itemId/reindex`，复用 `persistKnowledgeItem` 重建 chunks |
| document detail 接入 Re-index | done | `WorkspaceKnowledgeDetail` 已新增真实 `Re-index` 操作 |
| source detail 接入批量与单条 Re-index | done | `WorkspaceKnowledgeSourceDetail` 已新增 `Re-index linked` 和 per-document `Re-index` |
| 建立 Knowledge chunk resource 方案文档 | done | 已新增 `docs/47-openport-knowledge-chunk-resource-plan.md` |
| 顶层 Knowledge chunks 改为真实 chunk ledger | done | `WorkspaceKnowledge` 的 chunks 视图已按真实 chunk 列表渲染和导出 |
| Collection chunks 改为真实 chunk ledger | done | `WorkspaceKnowledgeCollectionDetail` 的 chunks 视图已按真实 chunk 列表渲染和导出 |
| 新增 chunk 独立详情页 | done | 已新增 `WorkspaceKnowledgeChunkDetail`，`/workspace/knowledge/chunks/[id]` 优先解析 chunk 资源 |
| 建立 Knowledge route parity 方案文档 | done | 已新增 `docs/46-openport-knowledge-route-parity-plan.md` |
| collection detail 改为 route-backed Documents / Sources / Chunks | done | `WorkspaceKnowledgeCollectionDetail` 已支持 `initialView` 并切到真实路由 |
| 新增 collection sources / chunks 独立路由 | done | 已新增 `/workspace/knowledge/collections/[id]/sources` 与 `/workspace/knowledge/collections/[id]/chunks` |
| 建立共享 UI 抽取方案文档 | done | 已新增 `docs/37-openport-shared-ui-extraction-plan.md` |
| 提取 `PageHeader` 共享组件 | done | 已新增 `apps/web/src/components/ui/page-header.tsx` 并替换 workspace/auth/dashboard 头部结构 |
| 提取 `Field` 共享组件 | done | 已新增 `apps/web/src/components/ui/field.tsx` 并替换资源页、编辑页、access 表单字段 |
| 提取 `ResourceCard` 共享组件 | done | 已新增 `apps/web/src/components/ui/resource-card.tsx` 并替换 workspace 资源列表、detail 卡片、access 卡片 |
| 提取 `ModalShell` 共享组件 | done | 已新增 `apps/web/src/components/ui/modal-shell.tsx` 并替换 project/confirm/shortcuts modal 外壳 |
| 提取 `Tag` 共享组件 | done | 已新增 `apps/web/src/components/ui/tag.tsx` 并替换 chat/workspace/knowledge 中的胶囊标签 |
| 提取 `FeedbackBanner` 共享组件 | done | 已新增 `apps/web/src/components/ui/feedback-banner.tsx` 并替换 auth/dashboard/chat 错误提示 |
| 提取 `ControlsSection` 共享组件 | done | 已新增 `apps/web/src/components/ui/controls-section.tsx` 并替换 chat controls 的折叠 section |
| 提取 `SidebarSection` 共享组件 | done | 已新增 `apps/web/src/components/ui/sidebar-section.tsx` 并替换 sidebar 中 `Projects / Chats` 分组头 |
| 提取 `MessageBubble` 共享组件 | done | 已新增 `apps/web/src/components/ui/message-bubble.tsx` 并替换 chat 主流和 search preview 消息结构 |
| 全面替换主路径 UI 原语 | done | 已覆盖 landing/auth/chat/sidebar/modals/workspace resources/editors/access/knowledge collection detail |
| 共享 UI 抽取后的前后端验证 | done | 已通过 `npm run build:web`、`npm run build:api`、`npm run compose:up`，Docker 四容器 healthy |

## 2026-03-16 收口进展（Workspace Wave 7 - Selector/Lifecycle/Execution Chain）

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立 Wave 7 收口方案文档 | done | 已新增 `docs/65-openport-workspace-depth-wave7-plan.md` |
| Models 统一 access-aware 资源 selector | done | 已新增 `workspace-resource-selector-modal.tsx` 并接入 `WorkspaceModelEditor` 的 `knowledge/tools/skills/builtin` |
| Knowledge 分页/排序收口 | done | `WorkspaceKnowledge` 已新增 documents/sources/chunks 的排序、分页、page size 控制 |
| Knowledge source lifecycle 面板 | done | 已新增 `workspace-knowledge-source-lifecycle-modal.tsx`，接入 `reindex/reset/rebuild/remove/replace` |
| Tools 执行链契约扩展 | done | `@openport/product-contracts` 已新增 `executionChain` 与 step 类型 |
| Tools 执行链后端持久化 | done | API DTO/service/state store（file + postgres）已接入 `executionChain` 读写与校验 |
| Tools 执行链编辑器 | done | `WorkspaceToolEditor` 已新增 chain builder（mode/when/condition/outputKey）与 graph 展示 |
| Tools 列表与导入导出兼容 | done | `WorkspaceTools` duplicate/import/runtime payload 已包含 `executionChain` |
| 本轮编译验收 | done | `npm run build:api`、`npm run build:web` 均已通过 |

## 2026-03-16 收口进展（Workspace 16-Gap Single-Pass Closure）

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立 16 项一次性收口方案文档 | done | 已新增 `docs/66-openport-workspace-16-gap-closure-plan.md` |
| Workspace 严格访问解析与能力收敛 | done | `WorkspacesService` 新增 `resolveWorkspaceForUser`；`getWorkspaceMemberRole/getWorkspaceResourceCapabilities` 改为真实成员校验，不再对未知 workspace 隐式放行 |
| Workspace 生命周期管理 API | done | 新增 `PATCH /workspaces/:id` 与 `DELETE /workspaces/:id`；补 `UpdateWorkspaceDto` |
| Settings Workspaces 治理页深化 | done | `WorkspaceGovernance` 已补 workspace rename/delete、members/invites 概览与统一治理动作 |
| 前端 workspace API 封装补齐 | done | `openport-api.ts` 新增 `updateWorkspace` / `deleteWorkspace` |
| 契约补齐 workspace update/delete 响应 | done | `@openport/product-contracts` 已新增 `OpenPortWorkspaceUpdateResponse` / `OpenPortWorkspaceDeleteResponse` |
| 16 项 parity matrix 收口更新 | done | `docs/49-openport-workspace-parity-matrix.md` 已切为 16 项对照矩阵并标记已对齐 |
| 本轮编译验收 | done | `npm run build:api` 与 `npm run build:web` 均已通过 |

## 2026-03-16 收口进展（Critical 5-Gap Closure）

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立 Critical 5-gap 收口文档 | done | 已新增 `docs/68-openport-workspace-critical-parity-closure.md` |
| Auth/Workspace 持久化治理收口 | done | `AuthService` + `WorkspacesService` 均已接入 `IdentityStateService` 启动加载与写回持久化 |
| Knowledge ACL 覆盖扩展到 source/chunk | done | 已新增 source/chunk access-grants API，并接入前端 API 与 modal |
| Knowledge source/chunk 访问控制 UI | done | `WorkspaceKnowledgeSourceDetail` 与 `WorkspaceKnowledgeChunkDetail` 已新增 Access modal 入口 |
| 资源 Access 独立路由降级 | done | `/workspace/{models,prompts,tools,skills}/[id]/access` 已改为重定向回资源页，避免 page-first access 流 |
| 入口语义对齐 `/` | done | `HomeEntryGate`、`LoginForm`、`RegisterForm` 已统一认证后进入 `/` |
| 本轮编译验收 | done | `npm --prefix apps/api run build` 与 `bash scripts/with-modern-node.sh npm --prefix apps/web run build` 均已通过 |

## Phase 0 任务清单

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 建立产品化方案文档 | done | `docs/14-openport-productization-plan.md` |
| 建立实施进度文档 | done | 本文件 |
| 建立 `apps/api` 目录骨架 | done | 已创建占位说明文件 |
| 建立 `apps/web` 目录骨架 | done | 已创建占位说明文件 |
| 建立 `packages/openport-core` 迁移占位 | done | 已创建占位说明文件 |
| 建立 `packages/openport-product-contracts` 共享契约包 | done | 已新增 package/tsconfig/index/README |
| README 补充新文档索引 | done | 已加入 `docs/14` 与 `docs/15` |
| 明确白名单 / 黑名单抽取边界 | done | 已写入 `docs/14` |
| 建立共享 TypeScript 基线配置 | done | 已新增 `tsconfig.base.json` |
| 建立 core 抽包迁移清单 | done | 已新增 `docs/16-openport-core-extraction-map.md` |
| 验证现有构建未受结构改造影响 | done | `npm run build` 已通过 |
| 建立 `packages/openport-core` 独立包配置 | done | 已新增 package.json / tsconfig / index.ts |
| 第一批纯逻辑文件抽包到 `openport-core` | done | 已迁入 types/errors/utils/policy/store/auth 等 |
| 验证 `openport-core` 可独立编译 | done | `npx tsc -p packages/openport-core/tsconfig.json` 已通过 |
| 第二轮核心运行时主体抽包到 `openport-core` | done | 已迁入 domain/tool-registry/agent-engine/admin-engine |
| 第三轮 runtime 与 adapters 抽包到 `openport-core` | done | 已迁入 runtime/postgres/prisma adapters |
| 建立 core 优先的构建脚本 | done | 已新增 `build:core` / `build:all` |
| 验证新构建脚本可用 | done | `npm run build:core` / `npm run build:all` 已通过 |
| 根目录 `src/` 第一批兼容层切换 | done | 已切换 types/errors/utils/policy/store/auth 等文件到 `openport-core/dist` |
| 根目录 `src/` 第二批兼容层切换 | done | 已切换 domain/runtime/tool-registry/agent-engine/admin-engine/index 与 adapters |
| 根目录脚本默认先编译 core | done | `build` / `dev` / `test` / `test:watch` 已切到 core-first |
| 验证兼容层切换后根包构建 | done | `npm run build` 已通过 |
| 验证兼容层切换后测试 | blocked | 当前本机 Node 为 `v14.21.3`，无法运行 Vitest 3 |
| 初始化 `apps/api` NestJS 工程骨架 | done | 已新增 package/tsconfig/main/app/openport/health/module shell |
| 验证 `apps/api` 编译 | blocked | 当前机器 Node 14，且未安装 app 级依赖，待 Node 20+ 环境继续 |
| `apps/api` 认证模块壳层 | done | 已新增 register/login/refresh/logout/me DTO/controller/service |
| `apps/api` 工作区模块壳层 | done | 已新增 workspace list/create/members/invites controller/service |
| `apps/api` RBAC 模块壳层 | done | 已新增 role-templates / me controller/service |
| `apps/api` OpenPort 管理台模块壳层 | done | 已新增 bootstrap/integrations controller/service |
| `apps/api` AI 会话模块壳层 | done | 已新增 session/message controller/service |
| `apps/api` Nest 装饰器与 DTO 依赖基线 | done | 已补 `experimentalDecorators`、`emitDecoratorMetadata`、`class-validator` 等 |
| 初始化 `apps/web` Next.js 工程骨架 | done | 已新增 package/tsconfig/next.config/app router/global css |
| `apps/web` auth 页面壳层 | done | 已新增 login/register 页面 |
| `apps/web` dashboard 与 integrations 页面壳层 | done | 已新增 dashboard 首页与 integrations 页面 |
| `apps/web` chat 工作台壳层 | done | 已新增 Cilila-style chat shell 页面与组件 |
| `apps/web` API client 与 session 存储 | done | 已新增 API base/header/session/fetch 封装 |
| `apps/web` auth 页面接通 API 契约 | done | login/register 已接到 `/api/auth/*` |
| `apps/web` dashboard / integrations 接通 API 契约 | done | 已接到 `/api/openport-admin/*` 与 `/api/workspaces` |
| `apps/web` chat 接通 API 契约 | done | 已接到 `/api/ai/sessions*` |
| 初始化 `apps/reference-server` 工程骨架 | done | 已建立 standalone Fastify reference runtime 目录 |
| 根目录多应用脚本补全 | done | 已新增 dev/build/start for api/web/reference 与 compose 脚本 |
| 根级 `.env.example` | done | 已新增产品化环境变量模板 |
| Docker / Compose 骨架 | done | 已新增 compose 与 api/web/reference Dockerfile |
| 根目录 legacy compatibility layer | done | `src/app.ts` / `src/reference-server.ts` 已降级为兼容入口 |
| `apps/api` 启动期 env 校验 | done | 已新增运行时环境解析与 postgres 必填校验 |
| `apps/reference-server` 启动期 env 校验 | done | 已新增运行时环境解析与 postgres 必填校验 |
| `apps/web` 健康检查路由 | done | 已新增 `/api/health` route |
| Docker 健康检查指令 | done | 三个 Dockerfile 已补 `HEALTHCHECK` |
| 统一运行规范文档 | done | 已新增 `docs/17-openport-runtime-validation.md` |
| 产品预检脚本 | done | 已新增 `scripts/check-product-readiness.mjs` 与根脚本入口 |
| Compose `.env` 路径修正 | done | `compose` 现在读取根目录 `.env` |
| 验证失败指引文档 | done | 已新增 `docs/18-openport-validation-failure-guide.md` |
| `apps/api` 与 `apps/web` 共享产品契约抽取 | done | 已引入 `@openport/product-contracts` 并替换 auth/workspace/admin/chat 类型 |
| 验证 `openport-product-contracts` 可独立编译 | done | `npx tsc -p packages/openport-product-contracts/tsconfig.json` 已通过 |
| 根目录脚本纳入 contracts 构建顺序 | done | `build` / `build:api` / `build:web` / `dev:api` / `dev:web` 已先编译 contracts |
| 产品验收执行器 | done | 已新增 `scripts/run-product-acceptance.mjs` 与 `acceptance:*` 根脚本 |
| Node 20+ 产品应用编译验收模式 | done | 已新增 `acceptance:apps`，收敛 reference/api/web 编译链 |
| GitHub Actions 产品验证工作流 | done | 已新增 `.github/workflows/product-validation.yml` |
| 产品环境引导脚本 | done | 已新增 `env:product`、`.nvmrc`、`.node-version` |
| Compose 配置预检入口 | done | 已新增 `compose:config` 并让 `compose:up` 自动执行 `env:product` |
| Compose 健康门控依赖链 | done | `postgres` / `api` / `reference-server` / `web` 已按健康状态串联启动 |
| Docker daemon 预检入口 | done | 已新增 `docker:preflight`，在 `acceptance:compose` 前明确检查 daemon 可达性 |
| Compose 镜像构建验收入口 | done | 已新增 `compose:build` 与 `acceptance:images` |
| GitHub Actions Compose 构建工作流 | done | 已新增 `.github/workflows/compose-build-validation.yml` |
| 一键产品栈起停入口 | done | 已新增 `start:product` / `status:product` / `stop:product` |
| 验证 `docker:preflight` | done | 已在修正本机 Docker Desktop 配置后通过 |
| 验证 `compose:config` | done | 已验证 Docker Compose 编排可被正常解析 |
| 验证 `acceptance:apps` | done | 已在 Node 22 环境下完整通过 preflight/build/reference/api/web 编译链 |
| 验证 `acceptance:images` | done | 已在 Node 22 + Docker daemon 环境下通过镜像构建验收 |
| 验证 `acceptance:services` | done | 已在 Node 22 环境下通过三应用健康检查 |
| 验证 `acceptance:full` | done | 已在 Node 22 环境下通过 `preflight + build + health` |
| 验证 `start:product` | done | 已验证默认 Node 14 环境下可自动切 Node 22、自动选端口并成功启动 |
| 验证 `status:product` | done | 已验证可正确读取当前产品栈运行态、端口与日志路径 |
| 验证 `health:product` | done | 已验证会自动读取运行态端口并通过 `reference/api/web` 健康检查 |
| 验证 `stop:product` | done | 已验证可正确终止受管产品栈并清理运行时状态文件 |
| 默认环境直接启动可用 | done | 已验证在默认 shell 仍为 Node 14 时可直接执行 `npm run start:product` 并使用产品界面 |
| 验证 `acceptance:compose` | done | 已在 Node 22 + Docker daemon 环境下通过 `compose:up + health:product` |
| 验证 `acceptance:local` 失败边界 | blocked | 已验证在 Node 14 环境下准确失败于 `preflight:product` 的 Node 版本检查 |
| 验证 `apps/web` 编译 | done | 已在 Node 22 环境下完成 `next build` |
| 根许可切换到 `AGPL-3.0-or-later` | done | 已更新根 `LICENSE` 与 `package.json` |
| 建立商标政策文件 | done | 已新增 `TRADEMARK_POLICY.md` |
| 建立 OSS / Cloud 分版方案文档 | done | 已新增 `docs/20-openport-oss-vs-cloud-edition-plan.md` |
| README 与发布文档同步新治理边界 | done | 已更新 README、release notes、模板 README |
| 首页视觉风格重构 | done | 已按 Accentrust 官网的极简结构语言重写 `apps/web` 首页 |
| 一键启动超时诊断增强 | done | 已延长 `start:product` 健康等待窗口并输出逐项失败信息 |
| `reference-server` 动态端口接线修正 | done | 已让 runtime 同时识别 `REFERENCE_PORT / REFERENCE_HOST` |
| 端口占用场景下重验 `start:product` | done | 已验证在 `3000/4000/8080` 被占时仍可成功回退启动 |
| 官网字体接入 Web 根布局 | done | 已把 Accentrust 官网本地字体完整接入 `apps/web` |
| 首页条件入口接入 session 判断 | done | 已根据本地 session 动态切换 `Login/Register` 与 `Dashboard/AI Workspace` |
| 首页改为文本优先入口 | done | 已去掉首页解释卡片与分栏，收敛为单栏文本入口 |
| 首页取消外层包裹卡片 | done | 已移除首页大面板边框、圆角和阴影容器 |
| 首页切为真正导航栏结构 | done | 已拆除 `landing-shell`，改为页面级导航栏与独立内容区 |
| 首页背景改为纯白 | done | 已移除首页背景纹理与渐变，仅保留纯白底色 |
| 导航栏去除点状标记 | done | 已去掉品牌名前的黑点装饰，副标题改为纯文字 |
| 导航栏品牌位改为文字 logo | done | 已新增文字 logo 组件并切到 `DIN` 优先字体栈 |
| 本地 `DIN` 字体接入品牌位 | done | 已从系统字体目录复制 `DIN` 并接入 `next/font/local` |
| Notes 完整整合方案文档 | done | 已新增 `docs/21-openport-notes-integration-plan.md` |
| Notes 实时协作方案文档 | done | 已新增 `docs/23-openport-notes-realtime-collaboration-plan.md` |
| `apps/api` Notes 模块骨架 | in_progress | 已新增 notes controller/service/module 与 DTO，待接入 app module 并完成前端 API 化 |
| `apps/web` Notes 真实 API 化 | in_progress | 将从 local storage 切到 `apps/api /notes*`，并保留现有页面结构 |
| `apps/api` Notes realtime gateway | done | 已新增 `Socket.IO + Yjs` 协作网关与文档服务 |
| `apps/web` Notes realtime client | done | 已新增 React 侧 `Yjs + socket.io-client` note 协作绑定 |
| Notes realtime Docker 验收 | done | 已验证双客户端同步与 API 内容回写 |

## 实施日志

### 2026-03-15

- `done`：新增 `docs/38-openport-workspace-final-parity-plan.md`，把 `Access` 降级出 `Workspace`、`Knowledge` document-centric 补强、以及 `Prompts / Tools` 资源工作流补强收敛为独立方案。
- `done`：新增独立 `Settings` 区域，加入 `/settings` 与 `/settings/access` 路由，并复用现有 `WorkspaceAppShell` 形成与聊天主界面一致的应用壳层。
- `done`：`/workspace/access` 现已降级为兼容跳转到 `/settings/access`；聊天页头像菜单里的 `Settings` 和 `Open Settings` 快捷键也已统一切到新路由。
- `done`：`Workspace` 权限路径映射已去除 `/workspace/access`，`/workspace` 入口现在只在 `Models / Knowledge / Prompts / Tools / Skills` 五个真实模块之间跳转，不再把 `Access` 当成 Workspace 主模块的一部分。
- `done`：`Access` 页面标题与定位已调整为 `Settings / Access`，并在无权限时明确显示 denied 状态，而不是继续伪装成 Workspace 主模块。
- `done`：`Knowledge item detail` 已补文档级搜索、命中摘要和统计信息（characters / words / lines / matches），继续向 Open WebUI `KnowledgeBase` 的 document-centric 交互靠拢。
- `done`：`Knowledge collection detail` 已补 indexed/type summary，强化 collection -> documents 的运营视图。
- `done`：`Prompts` 列表页已补 `Duplicate / Copy / Export` 资源操作，形成更完整的 prompt workflow，而不只停留在 CRUD + version history。
- `done`：`Tools` 列表页已补 `Duplicate / Copy manifest / Export` 资源操作，继续向 Open WebUI `ToolkitEditor` 的资产管理体验收敛。
- `done`：新增 `docs/37-openport-workspace-rbac-gap-closure-plan.md`，把 Workspace 真 RBAC、Access 成员角色管理、Models `skillIds` 关联和 Knowledge 文档式筛选的实施方案固化为独立规范。
- `done`：`apps/api` 的 `auth/me` 现已不再静态全开；`AuthService` 改为基于 `WorkspacesService` 的真实 workspace member role 输出 `workspaceRole` 与 `permissions.workspace`。
- `done`：`WorkspacesService` 已新增真实 role 解析与权限映射，并补充成员角色更新接口；`workspaces` API 现支持 `PATCH /workspaces/:id/members/:memberId`。
- `done`：为便于真实 RBAC 验收，`workspaces` API 还新增了 `POST /workspaces/:id/members`，可直接把用户加入目标 workspace，再配合角色更新与 `auth/me` 做权限验证。
- `done`：`Workspace` 前端权限壳层已切到真实权限行为：`WorkspaceModuleNav` 不再在失败时显示全部 tab，`WorkspacePermissionGate` 失败时回退到 `/chat`，`/workspace` 入口会根据 `auth/me` 返回的首个可访问模块重定向。
- `done`：`Access` 页面已升级为真正的设置入口，补齐成员列表、角色修改、邀请列表与创建邀请，同时保留 groups 管理。
- `done`：`OpenPortWorkspaceModel` 已扩展 `skillIds`，并完成 file/postgres 双后端持久化、API DTO、前端 model editor 与列表页显示的一体化接线。
- `done`：`Knowledge` 列表与 collection detail 已补 query 搜索，支持按名称、预览、正文内容和来源文本进行 document-centric 筛选。

### 2026-03-14

- `done`：完成 `docs/14-openport-productization-plan.md`，形成完整产品化实施方案。
- `done`：在 `docs/14` 中补充 Figena 抽取白名单 / 黑名单，明确避免商业机密泄露。
- `done`：新增 `docs/21-openport-openwebui-chat-parity-plan.md`，把对齐 Open WebUI 的 Chat 功能层实施方案固化为分阶段规范，覆盖侧栏分组、command palette 与会话级 controls。
- `done`：新增 `docs/22-openport-chat-persistence-plan.md`，把 Chat 后端持久化方案固化为独立规范，明确参考 Open WebUI 后端聊天模型和 OpenPort 当前 JSON state store 过渡策略。
- `done`：新增 `docs/25-openport-chat-home-parity-plan.md`，把 chat-first 首页、`/chat` 主路由、兼容入口和空态对齐方案固化为独立规范。
- `done`：已登录访问 `/` 时现在直接进入 `/chat`，未登录仍保留当前产品入口页；同时新增 `/chat` 作为 OpenPort 主聊天入口。
- `done`：`/dashboard/chat` 已降级为兼容跳转入口，并保留查询参数，避免旧链接与搜索结果失效。
- `done`：登录、注册、首页已登录态入口，以及后端 search 结果中的 chat href 已统一切换到 `/chat`。
- `done`：`ChatShell` 已重构为更接近 Open WebUI 的 chat-first 首页：右侧 controls 默认关闭、空会话与空线程统一成居中空态、顶部说明区收敛为轻量模型行。
- `done`：侧栏 `Projects` 区和 chat 主区样式已进一步收轻，减少后台管理台感，强化聊天应用主界面感。
- `done`：新增 `docs/26-openport-workspace-parity-plan.md`，把 `Workspace` 从说明页升级为真实工作区入口的方案固化为独立规范。
- `done`：`Workspace` 页面现已接入真实数据源 `bootstrap / integrations / projects / knowledge / chat sessions`，不再只是静态说明页。
- `done`：`Workspace` 现已按 `Models / Knowledge / Tools / Projects` 四块重组，作为更接近 Open WebUI 的工作区入口页。
- `done`：`Workspace` Hero 已补齐 `Open chat / Open notes / Open connections` quick actions，形成从聊天主界面进入配置与资产层的闭环。
- `done`：新增 `docs/27-openport-workspace-module-parity-plan.md`，把 `Workspace` 从概览页重构为 Open WebUI 风格模块入口的方案固化为独立规范。
- `done`：新增顶级 `/workspace` 路由与 `WorkspaceModuleNav`，按 Open WebUI 的结构拆出 `/workspace/models`、`/workspace/knowledge`、`/workspace/prompts`、`/workspace/tools` 四个子页。
- `done`：`/workspace` 现在自动重定向到 `/workspace/models`；旧的 `/dashboard/workspace` 已降级为兼容跳转到 `/workspace`，当前 overview 停留页已删除。
- `done`：`Workspace` 相关入口已统一切换到新模块路由：侧栏 `Workspace`、快捷键 `Open settings`、聊天页头像菜单里的 `Settings / Playground` 均已指向 `/workspace*`。
- `done`：四个 Workspace 子页已优先复用现有 OpenPort API 数据实现，而不是静态占位：
  - `Models`：来自 chat session 的 `modelRoute` 与 runtime modules
  - `Knowledge`：来自 `/projects/knowledge` 与项目挂载关系
  - `Prompts`：来自项目级 `systemPrompt`
  - `Tools`：来自 `/openport-admin/integrations` 与 runtime modules
- `done`：AI 工作区左侧 `Chats` 现在按时间区间做真实分组与折叠，采用 `Today / Yesterday / Previous 7 days / Previous 30 days / Earlier` 结构，并保持 `Projects` 作为 OpenPort 的唯一组织层命名。
- `done`：`Search` 已升级为更接近 Open WebUI 的 command palette，支持 `>` 动作模式、动作搜索结果、搜索预览与 notes/chat/action 混合浏览。
- `done`：`Chat Controls` 已从本地 `localStorage` 配置切到 API-backed 会话设置，`model route / operator mode / function calling / system prompt / advanced params` 现在跟随真实 chat session 持久化。
- `done`：侧栏 `New chat` 和聊天页新建会话入口已经统一使用服务端默认会话设置创建 session，避免侧栏与主聊天区出现两套会话初始化逻辑。
- `done`：`apps/api` 的 `ApiStateStoreService` 已升级为双后端持久层：本机默认 file store，Docker/产品路径支持 Postgres-backed chat persistence。
- `done`：`AiService` 现在通过 `ApiStateStoreService` 读写会话状态，chat sessions / messages / settings 不再依赖进程内 `Map`。
- `done`：Docker Compose 为 `api` 服务新增 `openport-api-data` volume，并显式接入 `OPENPORT_API_STATE_FILE`；同时 Docker 默认启用 `OPENPORT_API_STATE_BACKEND=postgres`。
- `done`：已完成持久化验收：通过 API 创建带 settings 的 chat session、重启 `compose-api-1`、再次读取 `/api/ai/sessions`，确认 session 与 settings 仍存在；同时已在容器内确认持久化状态落点可读。
- `done`：已完成 Postgres 持久化验收：在 Docker 默认 `OPENPORT_API_STATE_BACKEND=postgres` 模式下创建 `user_pg_demo` 会话，直接在 `postgres` 容器查询 `openport_chat_sessions` 表确认记录存在；重启 `compose-api-1` 后再次读取 `/api/ai/sessions`，确认会话仍由数据库恢复。
- `done`：新增 `docs/31-openport-platform-foundation-parity-plan.md`，把 `Projects` 之后仍落后于 Open WebUI 的平台层差距收敛为四块：storage provider、retrieval provider、projects realtime collaboration、group/admin sharing。
- `in_progress`：开始实施平台层 parity phase：优先复用现有 `Notes` realtime 架构、`Projects` service/store 骨架，并参考 Open WebUI `storage/provider.py`、`retrieval/vector/factory.py`、`socket/main.py`、`AccessControl.svelte` 的设计。
- `done`：创建本进度文档，后续所有实施步骤在此持续记录。
- `done`：创建 `apps/api/README.md`、`apps/web/README.md`、`packages/openport-core/README.md`，建立非侵入式目录骨架。
- `done`：创建 `packages/openport-product-contracts/README.md`、`package.json`、`tsconfig.json` 与 `src/index.ts`，建立共享产品契约包。
- `done`：更新 `README.md` 文档索引，加入进度文档入口。
- `done`：新增 `tsconfig.base.json`，将根目录 `tsconfig.json` 调整为可扩展结构。
- `done`：新增 `docs/16-openport-core-extraction-map.md`，明确 `src/` 到 `packages/openport-core/` 的迁移顺序。
- `done`：执行 `npm run build`，确认当前骨架调整未破坏现有构建。
- `done`：为 `packages/openport-core/` 新增独立 `package.json`、`tsconfig.json` 与 `src/index.ts`。
- `done`：完成第一批 core 文件复制到 `packages/openport-core/src/`：
  - `types.ts`
  - `error-codes.ts`
  - `errors.ts`
  - `utils.ts`
  - `ip-policy.ts`
  - `policy.ts`
  - `rate-limit.ts`
  - `audit.ts`
  - `store.ts`
  - `auth.ts`
- `done`：执行 `npx tsc -p packages/openport-core/tsconfig.json`，确认新 core 包可以独立编译。
- `done`：再次执行 `npm run build`，确认根目录现有构建仍然通过。
- `done`：完成第二轮 core 文件复制到 `packages/openport-core/src/`：
  - `domain.ts`
  - `tool-registry.ts`
  - `agent-engine.ts`
  - `admin-engine.ts`
- `done`：再次执行 `npx tsc -p packages/openport-core/tsconfig.json`，确认第二轮迁移后新 core 包继续可编译。
- `done`：再次执行 `npm run build`，确认根目录构建继续通过。
- `done`：完成第三轮 core 文件复制到 `packages/openport-core/src/`：
  - `runtime.ts`
  - `adapters/postgres-domain-adapter.ts`
  - `adapters/prisma-domain-adapter.ts`
- `done`：更新 `packages/openport-core/src/index.ts`，导出 runtime 与 adapters。
- `done`：更新 `packages/openport-core/package.json`，补充 `pg` 依赖声明。
- `done`：再次执行 `npx tsc -p packages/openport-core/tsconfig.json`，确认第三轮迁移后新 core 包继续可编译。
- `done`：再次执行 `npm run build`，确认根目录构建继续通过。
- `done`：更新根目录 `package.json`，新增 `build:core` 与 `build:all`，为后续兼容层切换准备构建顺序。
- `done`：执行 `npm run build:core` 与 `npm run build:all`，确认新的构建顺序脚本可用。
- `done`：完成根目录 `src/` 第一批兼容层切换：
  - `types.ts`
  - `error-codes.ts`
  - `errors.ts`
  - `utils.ts`
  - `ip-policy.ts`
  - `policy.ts`
  - `rate-limit.ts`
  - `audit.ts`
  - `store.ts`
  - `auth.ts`
- `done`：完成根目录 `src/` 第二批兼容层切换：
  - `domain.ts`
  - `tool-registry.ts`
  - `agent-engine.ts`
  - `admin-engine.ts`
  - `runtime.ts`
  - `index.ts`
  - `adapters/postgres-domain-adapter.ts`
  - `adapters/prisma-domain-adapter.ts`
- `done`：更新根目录 `package.json`，让 `build` / `dev` / `test` / `test:watch` 默认先执行 `build:core`。
- `done`：执行 `npm run build`，确认根目录兼容层切换后仍可成功构建。
- `blocked`：执行 `npm test` 时失败，阻塞不在业务代码，而在本机运行环境：
  - 当前 `node -v` 为 `v14.21.3`
  - `vitest@3` 使用 `??=` 语法，Node 14 无法解析

### 2026-03-15

- `done`：新增 [docs/25-openport-project-folders-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/25-openport-project-folders-parity-plan.md)，固化 `Projects -> Open WebUI Folders` 的完整实施方案，并明确当前代码基线已因同事提交更新为 `session.settings.projectId` 驱动的 chat 归档模型。
- `done`：参考 `open-webui-main` 的 `Sidebar/Folders.svelte`、`RecursiveFolder.svelte` 与 `folders` API 结构，把 `openport` 的 `Projects` 从平铺列表升级为树形层级模型，补齐 `parentId / isExpanded / updatedAt`，并对旧的本地存储格式做向后兼容迁移。
- `done`：在 `apps/web/src/lib/chat-workspace.ts` 中新增 folder-like `project` 能力：子项目创建、重命名、递归删除、父子移动、展开状态持久化、递归作用域 chat 查询与层级 option 输出。
- `done`：新增 [apps/web/src/components/project-tree-item.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-tree-item.tsx)，把左侧 `Projects` 区改成递归树组件，支持：
  - 展开/折叠
  - 子项目创建
  - 重命名
  - 删除
  - project 拖放嵌套
  - chat 拖放归档到 project
- `done`：更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)，使 `Projects` 与 `Chats` 的结构更接近 Open WebUI：
  - `Projects` 负责树形组织与已归档 chats
  - `Chats` 区只保留未归档 chats
  - `All chats` 可作为根级 drop target，把 project 移回根或把 chat 取消归档
- `done`：更新 [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)，让右侧 `Controls` 里的 `Project` 选择器支持层级项目选项。
- `done`：更新 [apps/web/src/lib/workspace-search.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/workspace-search.ts)，使 `project:` 搜索过滤按项目作用域递归命中子项目内 chats。
- `done`：更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)，补齐树形导航、层级缩进、内联子项目创建、拖放反馈和项目内 chat 条目样式。
- `done`：执行 `npm run build:web`，确认 `Projects` 树迁移后的 Next.js 前端构建通过。
- `done`：执行 `npm run compose:up`，确认 Docker 产品栈在现有镜像基础上运行正常，并验证 `compose-web-1 / compose-api-1 / compose-reference-server-1 / compose-postgres-1` 全部处于 `healthy`。
- `blocked`：再次触发 `npm run compose:up --build` 时，`apps/api` 的全量 TypeScript 编译暴露出与本次前端迁移无关的既有问题：
  - `apps/api/src/ai/ai.controller.ts` 返回类型声明过窄
  - `apps/api/src/search/search.service.ts` 对 `listChatSessions` 的 Promise 使用不正确
  - `apps/api/src/storage/api-state-store.service.ts` 缺少 `pg` 类型声明
  当前运行中的 Docker 容器仍保持 `healthy`，但后续若要做完全 clean rebuild，需要单独收掉这组 API 既有编译问题。
- `done`：根据最新代码基线更新 `Projects` 实现边界，不再把 `project.chatIds` 作为唯一真值；chat 与 project 的真实绑定已通过 API-backed `session.settings.projectId` 驱动，本地 `chatIds` 仅保留为兼容索引与搜索辅助。
- `done`：新增 [apps/web/src/components/project-menu.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-menu.tsx)，为每个 project row 补齐 Open WebUI 风格的 ellipsis dropdown menu，统一提供 `Create Project / Edit / Export / Delete`。
- `done`：新增 [apps/web/src/components/project-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-modal.tsx)，把 project 的创建与编辑收敛成统一 modal，并补齐本地 project metadata：
  - `backgroundImageUrl`
  - `systemPrompt`
  - `files`
- `done`：新增 [apps/web/src/components/confirm-dialog.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/confirm-dialog.tsx)，替代原生 `window.confirm`，用于 project 删除确认流。
- `done`：更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)，把顶层 project 创建从 inline input 改为 modal，补齐：
  - create/edit project modal flow
  - delete confirm flow
  - export flow
  - clear project assignment on delete
- `done`：更新 [docs/25-openport-project-folders-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/25-openport-project-folders-parity-plan.md)，把 `Projects -> Folders` parity 方案扩展为第二阶段完整清单，明确需要一次性收掉的 7 个缺口：
  - API-backed projects
  - workspace knowledge binding
  - import
  - background consumption
  - destructive delete contents
  - loading/toast/permission-aware UX
  - 多端共享基础
- `done`：扩展 [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)，新增 `OpenPortProject / OpenPortProjectKnowledgeItem / OpenPortProjectExportBundle / OpenPortDeleteProjectResponse` 等共享类型，固定 web/api 间的 project 契约。
- `done`：扩展 [apps/api/src/storage/api-state-store.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/storage/api-state-store.service.ts)，将产品状态从仅有 chat sessions 升级为：
  - `chatSessionsByUser`
  - `projectsByWorkspace`
  - `knowledgeItemsByWorkspace`
  同时为 postgres backend 新增 `openport_projects` 与 `openport_project_knowledge_items` 持久化表。
- `done`：新增 [apps/api/src/storage/storage.module.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/storage/storage.module.ts)，把 `ApiStateStoreService` 提升为共享模块，避免 `AI / Projects` 多实例 file-cache 分叉。
- `done`：新增 `apps/api` Projects 模块：
  - [projects.module.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.module.ts)
  - [projects.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.controller.ts)
  - [projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
  并补齐 API：
  - `GET /projects`
  - `POST /projects`
  - `GET /projects/:id`
  - `PATCH /projects/:id`
  - `POST /projects/:id/move`
  - `GET /projects/:id/export`
  - `POST /projects/import`
  - `DELETE /projects/:id?deleteContents=true|false`
  - `GET /projects/knowledge`
  - `POST /projects/knowledge/upload`
- `done`：把 `Projects` 的删除流从“清 assignment”升级为真正的 destructive flow：当 `deleteContents=true` 时，`ProjectsService` 会删除 subtree chats；当不勾选时，仅清理其 `projectId`。
- `done`：把 `Projects` 的导出/导入补成完整闭环：export 返回 `project + descendants + chats` JSON bundle；import 会重映射 project/chat ids，并把 project files 转成 workspace knowledge items。
- `done`：更新 [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)，新增 web 侧 project/knowledge/import/export/delete API client。
- `done`：更新 [apps/web/src/lib/chat-workspace.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-workspace.ts)，将其角色收敛为 API 数据缓存与纯 helper，并新增 project knowledge cache。
- `done`：更新 [apps/web/src/components/project-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-modal.tsx)，把 `Knowledge / Files` 从本地壳层升级为真实 workspace knowledge 流：
  - modal 打开时拉取 `/projects/knowledge`
  - 上传文件调用 `/projects/knowledge/upload`
  - 勾选知识项会生成带 `knowledgeItemId` 的 project files 绑定
- `done`：更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)，让 `Projects` mutation 全部改为 API-first：
  - create / edit
  - move
  - delete
  - export
  - import
  - drag-drop JSON import
  - create chat 继承 project defaults 后刷新 API-backed project cache
- `done`：更新 [apps/web/src/components/project-tree-item.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-tree-item.tsx)，支持把 JSON bundle 直接 drop 到某个 project 节点进行 parent-scoped import。
- `done`：更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)，让 `Chat` 主画布开始真实消费 project metadata：
  - `backgroundImageUrl` 进入聊天主舞台背景
  - `project.data.files` 进入 header / empty state 文案
- `done`：更新 [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)，右侧 controls 新增 project context 区，显示当前 project 与 attached knowledge item 数量。
- `done`：新增 toast 基础设施：
  - [apps/web/src/lib/toast.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/toast.ts)
  - [apps/web/src/components/workspace-toast-region.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-toast-region.tsx)
  并接入 `WorkspaceAppShell`，补齐 success/error feedback。
- `done`：更新 [apps/web/src/app/dashboard/workspace/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/workspace/page.tsx)，把 Workspace 从说明页升级为真正的 knowledge 库与 project attachment 概览页。
- `done`：执行 `npm --prefix packages/openport-product-contracts run build`，确认共享 contracts 构建通过。
- `done`：执行 `npm --prefix apps/api run build`，确认新的 Projects API 与 storage 扩展可编译。
- `done`：执行 `npm --prefix apps/web run build`，确认 Web 前端在 API-backed Projects 改造后继续通过。
- `done`：执行 `npm run compose:build`，确认 `api/web/reference-server` 镜像均可重新构建。
- `done`：执行 `npm run compose:up`，确认 Docker 产品栈重建后 `compose-api-1 / compose-web-1 / compose-reference-server-1 / compose-postgres-1` 全部 `healthy`。
- `done`：完成 API smoke 验证：
  - `GET /api/projects`
  - `POST /api/projects/knowledge/upload`
  - `POST /api/projects`
  - `GET /api/projects/:id/export`
  - `DELETE /api/projects/:id?deleteContents=true`
  - `POST /api/projects/import`
  均已验证可用；其中 `deleteContents=true` 已确认会真实删除 subtree chat。
  - project defaults 接入新建 chat
- `done`：更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)，让空态/主聊天区的新建会话也继承 project 级 system prompt。
- `done`：再次执行 `npm run build:web`，确认 modal/menu/confirm/project metadata 接入后前端构建继续通过。
- `done`：执行 `docker compose -f compose/docker-compose.yml build web` 与 `docker compose -f compose/docker-compose.yml up -d web`，确认只重建前端镜像即可让 `3100` 运行最新 `Projects` 交互，同时保持 `compose-web/api/reference-server/postgres` 全部 `healthy`。
  - 仓库 `package.json` 已声明 `engines.node >=20`
- `done`：新增 `docs/21-openport-notes-integration-plan.md`，正式定义 Notes 与 OpenPort 的资源模型、权限模型、协作分层和实施阶段。
- `done`：在 `packages/openport-product-contracts/src/index.ts` 中新增 notes 相关契约：
  - `OpenPortNote`
  - `OpenPortNoteGrant`
  - `OpenPortNoteVersion`
  - `OpenPortNoteAssistantResponse`
  - `OpenPortNoteCollaborationState`
- `done`：在 `apps/api/src/notes/` 下新增 Notes 模块第一版实现：
  - controller
  - service
  - module
  - create/update/share/restore/assistant/collaboration DTO
- `done`：Notes 模块第一版已覆盖：
  - CRUD
  - duplicate
  - version restore
  - access grants
  - assistant reply
  - presence heartbeat
- `done`：为现有服务补充 Notes 所需的公共能力：
  - `AuthService.getOrCreateUser`
  - `WorkspacesService.assertWorkspaceAccess`
- `in_progress`：将 `apps/web` Notes 前端从 local storage 切到真实 API，后续结果继续在本文件更新。
- `done`：将 `apps/api/src/app.module.ts` 接入 `NotesModule`，让 notes 成为正式产品模块。
- `done`：扩展 `apps/web/src/lib/openport-api.ts`，新增 notes 请求能力：
  - `fetchNotes`
  - `fetchNote`
  - `createOpenPortNote`
  - `updateOpenPortNote`
  - `deleteOpenPortNote`
  - `duplicateOpenPortNote`
  - `restoreOpenPortNoteVersion`
  - `shareOpenPortNote`
  - `revokeOpenPortNoteGrant`
  - `askOpenPortNoteAssistant`
  - `fetchOpenPortNoteCollaboration`
  - `heartbeatOpenPortNoteCollaboration`
- `done`：重写 `apps/web/src/lib/notes-workspace.ts`，保留 notes 前端事件与统计工具，移除 local storage 作为主数据源。
- `done`：`/dashboard/notes` 已切到真实 API：
  - 列表读取
  - 创建
  - 置顶
  - 复制
  - 删除
- `done`：`/dashboard/notes/[id]` 已切到真实 API：
  - 自动保存
  - 版本恢复
  - assistant
- `done`：新增 `docs/23-openport-notes-realtime-collaboration-plan.md`，把 Open WebUI 同架构版 notes 实时协作方案固化为正式实施文档。
- `done`：`apps/api` 新增 notes 实时协作层：
  - `NotesRealtimeService`
  - `NotesCollaborationGateway`
  - 事件协议对齐 `ydoc:document:join/state/update/leave` 与 `ydoc:awareness:update`
- `done`：`apps/api` 已通过 `Socket.IO + Yjs` 为 `note:{id}` 维护协作文档，并在 debounce 后把共享文档内容回写到 note `contentMd`。
- `done`：`apps/web` 新增 `notes-realtime.ts`，在 React 侧接入 `socket.io-client + Yjs`，让 note 编辑器从 heartbeat/presence 升级为真正的实时内容协作。
- `done`：`apps/web` 新增运行时 socket base 解析路由 `/api/openport/runtime`，避免 Docker 与本地端口环境下把 websocket 目标写死在编译产物里。
- `done`：执行 `npm run build:api`，Notes realtime gateway 相关后端代码通过编译。
- `done`：执行 `npm run build:web`，Notes realtime client 与页面代码通过编译。
- `done`：执行 `npm run compose:up`，Docker 产品栈重建成功，`api / web / reference / postgres` 四个容器均为 healthy。
- `done`：执行双客户端协作验收：两个 socket 客户端加入同一 note 后，内容实时同步成功，随后 `GET /api/notes/:id` 已返回回写后的最新 `contentMd`。
  - access grants
  - collaboration presence heartbeat
- `done`：`/dashboard/notes/new` 已切到真实 API，改为服务端创建 note 后跳转详情页。
- `done`：`workspace search` 继续保留现有结构，并由 `/api/search` 搜出 notes 结果。
- `done`：修正 Notes controller 的 DTO 导入方式，恢复 Nest validation 元数据与请求校验。
- `done`：修正 demo user 与 workspace seed 的默认 ID 对齐：
  - `AuthService` 默认 workspace 改为 `ws_${userId}`
  - 前端无 session fallback workspace 改为 `ws_user_demo`
- `done`：执行 `npm run build:web`，Next.js 生产构建通过。
- `done`：执行 `npm run build:api`，Nest API 编译通过。
- `done`：执行 `npm run compose:up`，Docker 产品栈重新构建并全部 healthy。
- `done`：实际验证 notes API：
  - `POST /api/notes` 返回 note
  - `GET /api/search?q=API&type=note` 返回 notes 搜索结果
- `done`：初始化 `apps/api` 实际工程骨架，新增：
  - `apps/api/package.json`
  - `apps/api/tsconfig.json`
  - `apps/api/tsconfig.build.json`
  - `apps/api/src/main.ts`
  - `apps/api/src/app.module.ts`
  - `apps/api/src/health/*`
  - `apps/api/src/openport/*`
  - `apps/api/src/auth/auth.module.ts`
  - `apps/api/src/workspaces/workspaces.module.ts`
  - `apps/api/src/openport-admin/openport-admin.module.ts`
  - `apps/api/src/ai/ai.module.ts`
- `done`：将 `apps/api/README.md` 从占位说明更新为实际工程说明。
- `blocked`：本轮未执行 `apps/api` 编译验证：
  - 当前机器 `node -v` 为 `v14.21.3`
  - `apps/api/package.json` 目标环境为 `node >=20`
  - 尚未在 `apps/api/` 安装 NestJS 依赖
- `done`：在 `apps/api` 中新增通用请求上下文工具 `src/common/request-context.ts`，统一解析 bearer token、用户头和工作区头。
- `done`：完成 `apps/api` 认证模块壳层：
  - `src/auth/auth.controller.ts`
  - `src/auth/auth.service.ts`
  - `src/auth/dto/register.dto.ts`
  - `src/auth/dto/login.dto.ts`
  - `src/auth/dto/refresh.dto.ts`
- `done`：完成 `apps/api` 工作区模块壳层：
  - `src/workspaces/workspaces.controller.ts`
  - `src/workspaces/workspaces.service.ts`
  - `src/workspaces/dto/create-workspace.dto.ts`
  - `src/workspaces/dto/invite-member.dto.ts`
- `done`：完成 `apps/api` RBAC 模块壳层：
  - `src/rbac/rbac.controller.ts`
  - `src/rbac/rbac.service.ts`
  - `src/rbac/rbac.module.ts`
- `done`：完成 `apps/api` OpenPort 管理台壳层：
  - `src/openport-admin/openport-admin.controller.ts`
  - `src/openport-admin/openport-admin.service.ts`
- `done`：完成 `apps/api` AI 会话壳层：
  - `src/ai/ai.controller.ts`
  - `src/ai/ai.service.ts`
  - `src/ai/dto/create-chat-session.dto.ts`
  - `src/ai/dto/post-message.dto.ts`
- `done`：补齐 `apps/api` TypeScript / DTO 基线：
  - `apps/api/tsconfig.json` 开启装饰器元数据
  - `apps/api/package.json` 新增 `class-validator` 与 `class-transformer`
- `blocked`：上述 API 壳层尚未执行本地编译验证：
  - 当前机器 `node -v` 为 `v14.21.3`
  - `apps/api` 目标环境为 `node >=20`
  - 当前仓库未安装 `apps/api` 依赖
- `done`：初始化 `apps/web` 实际工程骨架，新增：
  - `apps/web/package.json`
  - `apps/web/tsconfig.json`
  - `apps/web/next.config.mjs`
  - `apps/web/next-env.d.ts`
  - `apps/web/src/app/layout.tsx`
  - `apps/web/src/app/globals.css`
- `done`：完成 `apps/web` auth 页面壳层：
  - `src/app/auth/login/page.tsx`
  - `src/app/auth/register/page.tsx`
- `done`：完成 `apps/web` dashboard 壳层：
  - `src/app/dashboard/layout.tsx`
  - `src/app/dashboard/page.tsx`
  - `src/app/dashboard/integrations/page.tsx`
- `done`：完成 `apps/web` AI chat 壳层：
  - `src/app/dashboard/chat/page.tsx`
  - `src/components/chat-shell.tsx`
  - `src/components/side-nav.tsx`
- `done`：完成 `apps/web` 视觉基线，新增统一 CSS token、背景、动效和响应式布局。
- `done`：新增 `apps/web/src/lib/openport-api.ts`，统一封装：
  - API base URL 解析
  - auth / workspace / bootstrap / integrations / ai sessions 请求
  - 本地 session 存取
- `done`：将 `apps/web` 登录与注册页接到真实 API 契约：
  - `src/components/auth/login-form.tsx`
  - `src/components/auth/register-form.tsx`
  - 调用 `/api/auth/login` 与 `/api/auth/register`
- `done`：将 `apps/web` dashboard 数据读取接到真实 API 契约：
  - `src/components/dashboard-summary.tsx`
  - 调用 `/api/openport-admin/bootstrap`
  - 调用 `/api/auth/me`
  - 调用 `/api/workspaces`
- `done`：将 `apps/web` integrations 页接到真实 API 契约：
  - `src/components/integrations-console.tsx`
  - 调用 `/api/openport-admin/bootstrap`
  - 调用 `/api/openport-admin/integrations`
- `done`：将 `apps/web` chat shell 接到真实 API 契约：
  - `src/components/chat-shell.tsx`
  - 调用 `/api/ai/sessions`
  - 调用 `/api/ai/sessions/:id`
  - 调用 `/api/ai/sessions/:id/messages`
- `done`：再次执行 `npm run build`，确认 `apps/web` 契约接通后根目录现有构建仍未受影响。
- `done`：初始化 `apps/reference-server` 独立工程骨架，新增：
  - `apps/reference-server/package.json`
  - `apps/reference-server/tsconfig.json`
  - `apps/reference-server/src/app.ts`
  - `apps/reference-server/src/main.ts`
  - `apps/reference-server/README.md`
- `done`：在 `apps/reference-server` 中复制 reference runtime 路由壳层，并改为依赖 `@openport/core`。
- `done`：更新根目录 `package.json`，新增：
  - `build:reference`
  - `build:api`
  - `build:web`
  - `dev:reference`
  - `dev:api`
  - `dev:web`
  - `start:reference`
  - `start:api`
  - `start:web`
  - `compose:up`
  - `compose:down`
- `done`：新增根级 [.env.example](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.env.example)，统一声明 web / api / reference / postgres 的基础环境变量。
- `done`：新增 Docker / Compose 产品化骨架：
  - [compose/docker-compose.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/compose/docker-compose.yml)
  - [docker/reference-server.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/reference-server.Dockerfile)
  - [docker/api.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/api.Dockerfile)
  - [docker/web.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/web.Dockerfile)
- `done`：更新 [README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)，补充 product apps、多应用脚本与 Docker skeleton 说明。
- `done`：再次执行 `npm run build`，确认新增 env / compose / docker / scripts 后根目录现有构建仍未受影响。
- `done`：把根目录 reference runtime 兼容层显式拆分为 legacy 入口：
  - [src/legacy-app.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/src/legacy-app.ts)
  - [src/legacy-reference-server.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/src/legacy-reference-server.ts)
  - [src/app.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/src/app.ts) 现在只做兼容导出
  - [src/reference-server.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/src/reference-server.ts) 现在只做兼容入口
- `done`：再次执行 `npm run build`，确认 legacy compatibility layer 拆分后根目录构建继续通过。
- `done`：为 `apps/api` 新增运行时环境校验：
  - [apps/api/src/config/runtime-env.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/config/runtime-env.ts)
  - 启动时验证 `PORT`
  - 当 `OPENPORT_DOMAIN_ADAPTER=postgres` 时验证 `OPENPORT_DATABASE_URL`
- `done`：为 `apps/reference-server` 新增运行时环境校验：
  - [apps/reference-server/src/runtime-env.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/reference-server/src/runtime-env.ts)
- `done`：更新 [apps/api/src/main.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/main.ts) 与 [apps/reference-server/src/main.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/reference-server/src/main.ts)，在启动日志中明确 domain adapter。
- `done`：更新 [apps/api/src/health/health.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/health/health.controller.ts)，暴露更明确的 phase / adapter 健康状态。
- `done`：新增 [apps/web/src/lib/runtime-env.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/runtime-env.ts)，统一解析 `NEXT_PUBLIC_OPENPORT_API_BASE_URL`。
- `done`：新增 [apps/web/src/app/api/health/route.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/api/health/route.ts) 作为 web 容器健康探针。
- `done`：更新以下 Dockerfile，补充 `HEALTHCHECK`：
  - [docker/reference-server.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/reference-server.Dockerfile)
  - [docker/api.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/api.Dockerfile)
  - [docker/web.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/web.Dockerfile)
- `done`：更新 [README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)，补充运行时健康检查端点说明。
- `done`：再次执行 `npm run build`，确认 env / health / Docker HEALTHCHECK 调整后根目录构建继续通过。
- `done`：新增统一运行规范文档 [docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md)，收敛：
  - 多应用启动矩阵
  - 健康检查端点
  - Node / env / compose 验证顺序
  - 当前真实阻塞
- `done`：新增产品预检脚本 [scripts/check-product-readiness.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/check-product-readiness.mjs)，并在根包中加入 `npm run preflight:product`。
- `done`：修正 [compose/docker-compose.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/compose/docker-compose.yml) 的 env 文件来源，当前统一读取根目录 `.env`。
- `done`：新增失败排查文档 [docs/18-openport-validation-failure-guide.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/18-openport-validation-failure-guide.md)，明确：
  - Node 版本失败
  - `.env` 缺失或缺 key
  - api / web / reference-server 启动失败的优先排查顺序
  - compose 失败和健康检查失败排查顺序
- `done`：增强 [scripts/check-product-readiness.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/check-product-readiness.mjs)：
  - 检查 `docs/18-openport-validation-failure-guide.md`
  - 在存在 `.env` 时校验关键 env key
  - 当 `OPENPORT_DOMAIN_ADAPTER=postgres` 时校验 `OPENPORT_DATABASE_URL`
- `done`：更新 [docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md) 与 [README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)，明确 `.env` 与 compose 的实际关系。
- `blocked`：执行 `npm run preflight:product` 的结果如下：
  - 结构文件检查通过
  - `.env` 缺失给出 warning
  - Docker 安装迹象检测通过
  - 唯一硬失败为当前运行环境 `node -v = v14.21.3`，低于产品化子应用要求的 `>=20`
- `done`：再次执行 `npm run build`，确认新增预检脚本与运行规范文档后根目录构建继续通过。
- `blocked`：本轮未执行 `apps/reference-server` 编译验证：
  - 当前机器 `node -v` 为 `v14.21.3`
  - `apps/reference-server/package.json` 目标环境为 `node >=20`
  - 当前仓库未安装 `apps/reference-server` 依赖
- `blocked`：本轮未执行 Docker / Compose 骨架验证：
  - 当前环境未安装和验证各子应用依赖
  - 当前轮未执行 `docker compose` 构建
- `done`：再次执行 `npm run build`，确认新增 `apps/api` / `apps/web` 后根目录现有构建未受影响。
- `blocked`：本轮未执行 `apps/web` 编译验证：
  - 当前机器 `node -v` 为 `v14.21.3`
  - `apps/web/package.json` 目标环境为 `node >=20`
  - 当前仓库未安装 `apps/web` 依赖
- `in_progress`：下一步进入 Node 20+ / Docker 验证准备，开始收敛真实运行、健康检查和发布路径。
- `in_progress`：下一步把验证前置条件继续收敛到可执行清单，并开始为 Node 20+ / Docker 真验证清障。
- `in_progress`：下一步继续为真实 Node 20+ / Docker 验收清障，优先补每个应用的安装/启动/验收命令清单。
- `done`：新增共享产品契约包：
  - [packages/openport-product-contracts/README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/README.md)
  - [packages/openport-product-contracts/package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/package.json)
  - [packages/openport-product-contracts/tsconfig.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/tsconfig.json)
  - [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)
- `done`：将 `apps/api` 的 auth / workspace / rbac / admin / ai / health 返回体切换到 `@openport/product-contracts`：
  - [apps/api/src/auth/auth.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/auth/auth.service.ts)
  - [apps/api/src/workspaces/workspaces.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/workspaces/workspaces.service.ts)
  - [apps/api/src/rbac/rbac.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/rbac/rbac.service.ts)
  - [apps/api/src/openport-admin/openport-admin.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/openport-admin/openport-admin.service.ts)
  - [apps/api/src/ai/ai.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/ai.service.ts)
  - [apps/api/src/health/health.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/health/health.controller.ts)
- `done`：将 `apps/web` API client 与 dashboard / integrations 读取切换到共享产品契约：
  - [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - [apps/web/src/components/dashboard-summary.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/dashboard-summary.tsx)
  - [apps/web/src/components/integrations-console.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/integrations-console.tsx)
- `done`：更新根级脚本和说明文档，让 `contracts` 成为产品化构建前置：
  - [package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/package.json)
  - [README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)
  - [docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md)
  - [docs/19-openport-app-acceptance-checklist.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/19-openport-app-acceptance-checklist.md)
- `done`：执行 `npx tsc -p packages/openport-product-contracts/tsconfig.json`，确认共享契约包可独立编译。
- `done`：执行 `npm run build`，确认根包在引入 `build:contracts` 后继续通过。
- `done`：新增产品验收执行器 [scripts/run-product-acceptance.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/run-product-acceptance.mjs)，支持：
  - `local`
  - `services`
  - `full`
  - `compose`
- `done`：更新 [package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/package.json)、[README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)、[docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md)、[docs/18-openport-validation-failure-guide.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/18-openport-validation-failure-guide.md)、[docs/19-openport-app-acceptance-checklist.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/19-openport-app-acceptance-checklist.md)，把 `acceptance:*` 与健康重试参数纳入统一规范。
- `done`：增强 [scripts/check-product-readiness.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/check-product-readiness.mjs)，将以下产物纳入预检：
  - `packages/openport-product-contracts/package.json`
  - `docs/19-openport-app-acceptance-checklist.md`
  - `scripts/run-product-acceptance.mjs`
- `done`：再次执行 `npm run build`，确认新增验收执行器与预检增强后根目录构建继续通过。
- `blocked`：执行 `npm run acceptance:local`，结果符合预期：
  - 验收执行器可正常进入 `preflight` step
  - 失败点准确落在 `Node runtime v14.21.3 is below required version >=20`
  - `.env` 缺失继续只是 warning，不是新的实现回归
  - 当前尚不能在本机继续进入 `build + health` 的真实产品验收
- `done`：扩展 [scripts/run-product-acceptance.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/run-product-acceptance.mjs)，新增 `apps` 模式，统一执行：
  - `preflight:product`
  - `build`
  - `build:reference`
  - `build:api`
  - `build:web`
- `done`：更新 [package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/package.json)、[README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)、[docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md)、[docs/18-openport-validation-failure-guide.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/18-openport-validation-failure-guide.md)、[docs/19-openport-app-acceptance-checklist.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/19-openport-app-acceptance-checklist.md)，把 `acceptance:apps` 作为 Node 20+ 编译验收入口写入规范。
- `done`：新增 GitHub Actions 工作流 [\.github/workflows/product-validation.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.github/workflows/product-validation.yml)，在 Node 20 环境执行：
  - `npm ci`
  - `npm run install:product`
  - `cp .env.example .env`
  - `npm run acceptance:apps`
- `done`：再次执行 `npm run build`，确认新增 `acceptance:apps` 与 CI workflow 后根目录构建继续通过。
- `blocked`：执行 `npm run acceptance:apps`，结果符合预期：
  - 验收执行器正确进入 `apps` 模式
  - 当前仍在 `preflight` 的 Node 版本检查处停止
  - 尚未进入 `build:reference` / `build:api` / `build:web`
  - 说明当前阻塞仍然只来自本机 `Node v14.21.3`
- `done`：新增 Node 版本声明文件：
  - [\.nvmrc](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.nvmrc)
  - [\.node-version](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.node-version)
  - 明确产品化目标环境为 Node 20
- `done`：新增产品环境引导脚本 [scripts/prepare-product-env.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/prepare-product-env.mjs)，并在根包新增 `npm run env:product`：
  - `.env` 缺失时按 `.env.example` 创建
  - `.env` 已存在时补齐缺失 key
- `done`：修正 Docker 构建链缺口：
  - [docker/api.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/api.Dockerfile)
  - [docker/web.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/web.Dockerfile)
  - 两者现在都会复制并构建 `packages/openport-product-contracts`
  - 避免 `apps/api` / `apps/web` 在 Docker 镜像内因 `file:../../packages/openport-product-contracts` 缺失而构建失败
- `done`：更新 [scripts/check-product-readiness.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/check-product-readiness.mjs)、[README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)、[docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md)、[docs/18-openport-validation-failure-guide.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/18-openport-validation-failure-guide.md)、[docs/19-openport-app-acceptance-checklist.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/19-openport-app-acceptance-checklist.md)、[\.github/workflows/product-validation.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.github/workflows/product-validation.yml)，统一切到 `npm run env:product`。
- `done`：再次执行 `npm run build`，确认 `.nvmrc` / `.node-version` / `env:product` / Dockerfile 修正后根目录构建继续通过。
- `done`：执行 `node scripts/prepare-product-env.mjs --dry-run`，结果符合预期：
  - 当前环境会提示 `would create .env from .env.example`
  - 说明环境引导脚本可在不写入本地 `.env` 的情况下先做检查
- `blocked`：再次执行 `npm run acceptance:apps`，结果仍符合预期：
  - 继续准确失败在 `preflight:product` 的 Node 版本检查
  - 预检 warning 已更新为建议执行 `npm run env:product`
  - 当前仍未进入真正的 Node 20+ 产品编译验收阶段
- `done`：更新 [compose/docker-compose.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/compose/docker-compose.yml)，移除已废弃的 `version` 字段，避免 `docker compose config` 产生警告。
- `done`：更新 [package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/package.json) 与 [scripts/run-product-acceptance.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/run-product-acceptance.mjs)：
  - 新增 `npm run compose:config`
  - `npm run compose:up` 现在会自动执行 `npm run env:product`
  - `acceptance:compose` 现在会先执行 `env`
- `done`：增强 [scripts/check-product-readiness.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/check-product-readiness.mjs)，把以下产物纳入预检：
  - [\.nvmrc](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.nvmrc)
  - [\.node-version](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.node-version)
  - [scripts/prepare-product-env.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/prepare-product-env.mjs)
- `done`：再次更新 [README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)、[docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md)、[docs/18-openport-validation-failure-guide.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/18-openport-validation-failure-guide.md)、[docs/19-openport-app-acceptance-checklist.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/19-openport-app-acceptance-checklist.md)，把 `compose:config` 与自动 `.env` 处理纳入验收规范。
- `done`：执行 `npm run compose:config`，结果符合预期：
  - 自动创建了本地 [\.env](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.env)
  - `docker compose` 已能成功解析当前编排
  - `api` / `web` / `reference-server` / `postgres` 四个服务都进入了解析后的配置输出
- `blocked`：执行 `npm run acceptance:compose`，结果符合预期：
  - `env` step 正常通过
  - `preflight` 已不再因为缺少 `.env` 给 warning
  - 当前唯一硬阻塞仍是 `Node runtime v14.21.3 is below required version >=20`
- `done`：增强 [compose/docker-compose.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/compose/docker-compose.yml) 的启动依赖链：
  - `postgres` 新增 `pg_isready` 健康检查
  - `api` / `reference-server` 改为依赖健康的 `postgres`
  - `web` 改为依赖健康的 `api`
- `done`：再次更新 [README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)、[docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md)、[docs/18-openport-validation-failure-guide.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/18-openport-validation-failure-guide.md)、[docs/19-openport-app-acceptance-checklist.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/19-openport-app-acceptance-checklist.md)，明确 compose 已切到 health-gated 启动。
- `done`：再次执行 `npm run compose:config`，确认当前 compose 输出中已经出现：
  - `postgres.healthcheck`
  - `api.depends_on.postgres.condition = service_healthy`
  - `reference-server.depends_on.postgres.condition = service_healthy`
  - `web.depends_on.api.condition = service_healthy`
- `done`：再次执行 `npm run build`，确认新增 compose 健康门控后根目录构建继续通过。
- `done`：新增 [\.dockerignore](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.dockerignore)，避免 `node_modules`、`dist`、`.env`、日志等无关产物进入 Docker 构建上下文。
- `done`：新增 Docker daemon 预检脚本 [scripts/check-docker-daemon.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/check-docker-daemon.mjs)，并在 [package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/package.json) 中加入 `npm run docker:preflight`。
- `done`：更新 [scripts/run-product-acceptance.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/run-product-acceptance.mjs)、[scripts/check-product-readiness.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/check-product-readiness.mjs)、[README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)、[docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md)、[docs/18-openport-validation-failure-guide.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/18-openport-validation-failure-guide.md)、[docs/19-openport-app-acceptance-checklist.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/19-openport-app-acceptance-checklist.md)，把 `docker:preflight` 纳入 compose 验收链。
- `blocked`：执行 `npm run docker:preflight`，结果明确为：
  - Docker CLI 已安装
  - 当前 Docker daemon 不可达
  - 提示需要启动 Docker Desktop 或修复当前 Docker context
- `done`：再次执行 `npm run build`，确认新增 `.dockerignore` 与 Docker 预检脚本后根目录构建继续通过。
- `blocked`：再次执行 `npm run acceptance:compose`，当前仍然先停在 `preflight:product` 的 Node 版本检查，因此还未走到新的 `docker:preflight` step；说明下一层真实阻塞顺序是：
  - 第一层：Node 20+
  - 第二层：Docker daemon 可达性
- `done`：新增 `compose` 镜像构建验收入口：
  - [package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/package.json) 新增 `npm run compose:build`
  - [scripts/run-product-acceptance.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/run-product-acceptance.mjs) 新增 `acceptance:images`
- `done`：新增 GitHub Actions 工作流 [\.github/workflows/compose-build-validation.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.github/workflows/compose-build-validation.yml)，在 Node 20 + Docker 环境执行：
  - `npm ci`
  - `npm run env:product`
  - `npm run docker:preflight`
  - `npm run acceptance:images`
- `done`：再次更新 [README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)、[docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md)、[docs/18-openport-validation-failure-guide.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/18-openport-validation-failure-guide.md)、[docs/19-openport-app-acceptance-checklist.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/19-openport-app-acceptance-checklist.md)，把 `compose:build`、`acceptance:images` 和新 workflow 写入规范。
- `done`：再次执行 `npm run build`，确认新增 `compose:build` / `acceptance:images` / compose-build workflow 后根目录构建继续通过。
- `blocked`：执行 `npm run acceptance:images`，结果符合预期：
  - 当前仍先停在 `preflight:product` 的 Node 版本检查
  - 尚未进入 `docker:preflight`、`compose:config`、`compose:build`
  - 说明本机继续推进镜像构建验收前仍需先满足 Node 20+
- `done`：确认本机可用 Node 22 路径：
  - `/Users/Sebastian/.nvm/versions/node/v22.20.0/bin/node`
  - `node -v` 为 `v22.20.0`
  - `npm -v` 为 `11.6.2`
- `done`：在 Node 22 环境执行 `npm run install:product`，完成：
  - `packages/openport-product-contracts`
  - `packages/openport-core`
  - `apps/reference-server`
  - `apps/api`
  - `apps/web`
  的真实依赖安装。
- `done`：首次在 Node 22 环境执行 `npm run acceptance:apps`，暴露并修复了两个真实编译问题：
  - [apps/api/src/rbac/rbac.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/rbac/rbac.service.ts)
    - 修正 `readonly` 角色模板与共享契约 `OpenPortRoleTemplate[]` 的不兼容
  - [apps/web/tsconfig.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/tsconfig.json)、[apps/web/next-env.d.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/next-env.d.ts)、[apps/web/next.config.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/next.config.mjs)
    - 修正 Next App Router 的 TS 基线
    - 修正 `turbopack.root`
    - 消除 `next/server` 解析失败和 `JSX.Element` 类型报错
- `done`：更新以下 `apps/web` 页面与组件，移除显式 `JSX.Element` 返回类型，改为让 TS 自动推断：
  - [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - [apps/web/src/app/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/layout.tsx)
  - [apps/web/src/app/auth/login/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/auth/login/page.tsx)
  - [apps/web/src/app/auth/register/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/auth/register/page.tsx)
  - [apps/web/src/app/dashboard/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/layout.tsx)
  - [apps/web/src/app/dashboard/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/page.tsx)
  - [apps/web/src/app/dashboard/integrations/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/integrations/page.tsx)
  - [apps/web/src/app/dashboard/chat/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/chat/page.tsx)
  - [apps/web/src/components/auth/login-form.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/auth/login-form.tsx)
  - [apps/web/src/components/auth/register-form.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/auth/register-form.tsx)
  - [apps/web/src/components/dashboard-summary.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/dashboard-summary.tsx)
  - [apps/web/src/components/integrations-console.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/integrations-console.tsx)
  - [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - [apps/web/src/components/side-nav.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/side-nav.tsx)
- `done`：在 Node 22 环境执行 `npm run build:web`，当前已稳定通过。
- `done`：在 Node 22 环境再次执行 `npm run acceptance:apps`，当前结果为完整通过：
  - `preflight:product` 通过
  - 根 `build` 通过
  - `build:reference` 通过
  - `build:api` 通过
  - `build:web` 通过
- `blocked`：在 Node 22 环境执行 `npm run acceptance:images`，当前已不再卡在 Node 版本，而是准确停在 `docker:preflight`：
  - 说明应用编译链已经打通
  - 剩余真实阻塞收敛为 Docker daemon 可达性
- `done`：在 Node 22 环境尝试启动三应用做运行态验收时，发现默认端口冲突：
  - `3000` 与 `4000` 被 [Figena-Web](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web) 的现有进程占用
  - 未对这些现有进程做任何终止操作
  - 改用临时端口继续验收：
    - `reference-server`: `8080`
    - `api`: `4100`
    - `web`: `3100`
- `done`：在 Node 22 环境执行 `npm run acceptance:services`，并通过覆盖以下健康检查地址完成三应用运行态验收：
  - `OPENPORT_REFERENCE_HEALTH_URL=http://127.0.0.1:8080/healthz`
  - `OPENPORT_API_HEALTH_URL=http://127.0.0.1:4100/api/health`
  - `OPENPORT_WEB_HEALTH_URL=http://127.0.0.1:3100/api/health`
  - 结果为 `reference/api/web` 三个健康检查全部通过
- `done`：在 Node 22 环境执行 `npm run acceptance:full`，并使用同一组健康检查覆盖变量，结果为完整通过：
  - `preflight:product` 通过
  - 根 `build` 通过
  - `health:product` 通过
- `done`：运行态验收完成后，已停止本轮由我启动的 `reference/api/web` 进程，避免继续占用临时端口。
- `done`：新增 [scripts/with-modern-node.sh](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/with-modern-node.sh)，并将以下根脚本统一切到“默认环境自动切 Node 20+”模式：
  - 安装链：`install:contracts`、`install:core`、`install:reference`、`install:api`、`install:web`
  - 构建链：`build:api`、`build:web`
  - 启动链：`dev:*`、`start:*`
  - 验收链：`preflight:product`、`acceptance:*`、`health:*`、`docker:preflight`
- `done`：新增受管产品栈脚本：
  - [scripts/start-product-stack.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/start-product-stack.mjs)
  - [scripts/status-product-stack.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/status-product-stack.mjs)
  - [scripts/stop-product-stack.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/stop-product-stack.mjs)
  并在 [package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/package.json) 中加入：
  - `npm run start:product`
  - `npm run status:product`
  - `npm run stop:product`
- `done`：增强 [scripts/check-product-health.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/check-product-health.mjs)，使 `health:product` 能优先读取 [\.openport-product/runtime.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.openport-product/runtime.json) 的动态端口，而不是写死 `3000/4000/8080`。
- `done`：更新 [README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)、[docs/17-openport-runtime-validation.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/17-openport-runtime-validation.md)、[docs/18-openport-validation-failure-guide.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/18-openport-validation-failure-guide.md)、[docs/19-openport-app-acceptance-checklist.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/19-openport-app-acceptance-checklist.md)，加入受管产品栈的启动、状态、健康检查与停止命令。
- `done`：在默认 shell 仍为 `Node v14.21.3` 的环境下执行 `npm run start:product`，验证结果：
  - 会自动切换到本机可用的 Node 22
  - 会自动避开 [Figena-Web](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web) 已占用的 `3000/4000`
  - 当前成功选择并启动：
    - `reference-server`: `http://127.0.0.1:8080`
    - `api`: `http://127.0.0.1:4100/api`
    - `web`: `http://127.0.0.1:3100`
  - 运行日志目录为 [\.openport-product/logs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.openport-product/logs)
- `done`：执行 `npm run status:product`，当前确认三应用进程均为存活状态：
  - `reference` PID `52810`
  - `api` PID `52811`
  - `web` PID `52812`
- `done`：执行 `npm run health:product`，当前确认以下健康检查全部通过：
  - `http://127.0.0.1:8080/healthz`
  - `http://127.0.0.1:4100/api/health`
  - `http://127.0.0.1:3100/api/health`
- `done`：执行 `npm run stop:product` 后再次重启受管产品栈，确认停止与再启动流程都稳定可用。
- `done`：当前仓库已经达到“可直接启动和使用”的目标：
  - 启动命令：`npm run start:product`
  - 查看状态：`npm run status:product`
  - 健康检查：`npm run health:product`
  - 停止服务：`npm run stop:product`
  - 默认访问入口：`http://127.0.0.1:3100`
- `done`：定位并修正本机 Docker Desktop 的真实运行问题：
  - 后台日志显示 `DataFolder` 仍指向旧用户目录 `/Users/kenneth/...`
  - 已修正本机 [settings-store.json](/Users/Sebastian/Library/Group%20Containers/group.com.docker/settings-store.json) 中的 `DataFolder`
  - 重新启动 Docker Desktop 后，`npm run docker:preflight` 已通过
- `done`：为 Docker Compose 引入独立的宿主机端口变量，避免与 [Figena-Web](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web) 及本地受管产品栈冲突：
  - 更新 [compose/docker-compose.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/compose/docker-compose.yml)
  - 更新 [\.env.example](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.env.example) 与 [\.env](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.env)
  - 当前 Compose 宿主机端口固定为：
    - `reference-server`: `8080`
    - `api`: `4100`
    - `web`: `3100`
    - `postgres`: `5432`
- `done`：增强 [scripts/check-product-health.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/check-product-health.mjs)，使其在无 managed runtime 文件时也能自动读取根目录 `.env` 的 host port 配置。
- `done`：补齐 Docker 镜像构建缺口：
  - [packages/openport-core/package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-core/package.json) 新增 `typescript`、`@types/node`、`@types/pg`
  - [packages/openport-product-contracts/package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/package.json) 新增 `typescript`、`@types/node`
  - [docker/api.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/api.Dockerfile)、[docker/web.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/web.Dockerfile)、[docker/reference-server.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/reference-server.Dockerfile) 已补 `tsconfig.base.json`
- `done`：执行 `npm run acceptance:images`，当前结果为完整通过：
  - `docker:preflight` 通过
  - `compose:config` 通过
  - `compose:build` 通过
- `done`：首次执行 `npm run acceptance:compose` 时，定位到 `web` 容器继承了根 `.env` 的 `PORT=4000`，导致 `next start` 监听容器内 `4000` 而不是设计值 `3000`。
- `done`：修正 [compose/docker-compose.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/compose/docker-compose.yml) 中 `web` 服务的显式 `PORT: 3000`，然后重新执行 `npm run compose:down` 与 `npm run acceptance:compose`。
- `done`：重新执行 `npm run acceptance:compose`，当前结果为完整通过：
  - `docker compose up -d --build` 通过
  - `reference`: `http://127.0.0.1:8080/healthz` 通过
  - `api`: `http://127.0.0.1:4100/api/health` 通过
  - `web`: `http://127.0.0.1:3100/api/health` 通过
- `done`：当前 Docker Compose 产品栈处于可用状态：
  - `compose-reference-server-1` healthy
  - `compose-api-1` healthy
  - `compose-web-1` healthy
  - `compose-postgres-1` healthy
- `done`：将根许可从 `MIT` 正式切换为 `AGPL-3.0-or-later`：
  - 更新根 [LICENSE](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/LICENSE)
  - 更新根 [package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/package.json)
- `done`：新增 [TRADEMARK_POLICY.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/TRADEMARK_POLICY.md)，把代码许可与品牌使用权边界分离。
- `done`：新增 [docs/20-openport-oss-vs-cloud-edition-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/20-openport-oss-vs-cloud-edition-plan.md)，正式定义 `openport-oss` 与 `openport-cloud` 的分版策略。
- `done`：更新治理相关公开文档，移除遗留 `MIT` 表述并同步新边界：
  - [README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/README.md)
  - [docs/releases/v0.1.0.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/releases/v0.1.0.md)
  - [templates/openport-adapter-public-template/README.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/templates/openport-adapter-public-template/README.md)
  - [docs/14-openport-productization-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/14-openport-productization-plan.md)
- `done`：重写 `apps/web` 首页视觉：
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 风格目标改为更接近 Accentrust 官网的高留白、细边框、单色基调和极简文案
- `done`：执行 `npm run build:web`，确认首页重构后 `apps/web` 仍可成功编译。
- `done`：把 Accentrust 官网字体接入 `apps/web`：
  - 新增 [apps/web/src/app/fonts.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/fonts.ts)
  - 更新 [apps/web/src/app/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/layout.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 拷入 `Fira Code` 与 `DM Serif Display` 到 `apps/web/public/fonts/`
- `done`：新增 [apps/web/src/components/landing-entry-actions.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/landing-entry-actions.tsx)，让首页根据本地 session 动态切换入口：
  - 未登录：`Login / Register`
  - 已登录：`Open Dashboard / Open AI Workspace`
- `done`：将首页从卡片说明页收敛为文本优先入口页：
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/components/landing-entry-actions.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/landing-entry-actions.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 去掉 `System map` 与右侧卡片，改为短标题、条件入口和轻量辅助文本
- `done`：进一步移除首页外层大卡片容器：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 去掉 `landing-shell` 的边框、圆角、阴影和背景包裹，只保留页面级排版与分隔线
- `done`：将首页顶部改为真正导航栏结构：
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 顶部改为全宽 `landing-navbar`，正文改为独立 `landing-content` 容器，不再形成大块居中包裹
- `done`：将首页背景改为纯白：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 移除 `landing-page` 的纹理叠层与渐变背景
- `done`：收敛导航栏品牌区：
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 去掉品牌名前的黑点装饰，`Self-hosted control surface` 改为纯文字副标题
- `done`：将导航栏品牌位改为文字 logo 组件：
  - 新增 [apps/web/src/components/landing-wordmark.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/landing-wordmark.tsx)
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 品牌文字切到 `DIN Alternate / DIN Condensed / Bahnschrift` 优先字体栈
- `done`：把系统 `DIN` 字体本地化到项目中：
  - 复制 `DIN Alternate Bold.ttf` 与 `DIN Condensed Bold.ttf` 到 `apps/web/public/fonts/din/`
  - 更新 [apps/web/src/app/fonts.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/fonts.ts)
  - 更新 [apps/web/src/app/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/layout.tsx)
  - 让文字 logo 优先使用本地 `--font-din`
- `done`：增强 [scripts/start-product-stack.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/scripts/start-product-stack.mjs)：
  - 健康等待窗口从 `20s` 提高到 `45s`
  - 超时时会输出 `reference/api/web` 三个端点各自最后一次检查结果，便于定位端口冲突或慢启动问题
- `done`：修正 [apps/reference-server/src/runtime-env.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/reference-server/src/runtime-env.ts)，让受管启动时传入的 `REFERENCE_PORT / REFERENCE_HOST` 能被真正读取，避免 `8080` 被占时 reference 健康检查永远打空。
- `done`：执行 `npm run build:reference && npm run start:product`，确认修复后在端口占用场景下可正常启动：
  - `web`: `http://127.0.0.1:3101`
  - `api`: `http://127.0.0.1:4101/api`
  - `reference`: `http://127.0.0.1:8180`
- `done`：收敛治理文案语气，保留必要边界但不在 README 和分版文档中过度强调品牌与商业边界。

## 下一步

下一批落地动作：

1. 把公开发布前的 `LICENSE`、`TRADEMARK_POLICY.md`、`docs/20` 纳入 release checklist 和仓库首页说明。
2. 在后续功能开发中继续按 `openport-oss` / `openport-cloud` 边界收敛模块归属，避免商业云端实现进入公开仓库。
3. 如需继续对外发布，再补数据库 schema/migration、真实认证持久化和生产 secrets 管理。

### 2026-03-14 Home UI Follow-up

- `done`：移除导航栏品牌副标题：
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 品牌区现在仅保留 `OpenPort` 文字 logo
- `done`：移除首页多余说明文案：
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/components/landing-entry-actions.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/landing-entry-actions.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 去掉 `OpenPort OSS`、登录提示句和 `Login required`
- `done`：移除页面网格背景：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 去掉全局 `body::before` 网格纹理和 `gridFloat` 动画，`body` 背景统一为纯白
- `done`：放大并细调导航栏文字 logo：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 提升 `OpenPort` 文字 logo 的字号、权重和字距，让品牌位在导航栏里更清晰
- `done`：移除首页底部辅助信息块：
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 去掉 `After sign-in / API / Mode` 三行说明和对应样式，让首页只保留标题、短说明和入口动作
- `done`：将首页导航栏改为毛玻璃效果：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 去掉偏实白的导航底色，改为更轻的透明层和更强的 blur/saturate
- `done`：将导航栏文字 logo 切到 `Cal Sans` 并继续放大：
  - 复制系统字体 `~/Library/Fonts/CalSans-Regular.ttf` 到 `apps/web/public/fonts/cal-sans/`
  - 更新 [apps/web/src/app/fonts.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/fonts.ts)
  - 更新 [apps/web/src/app/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/layout.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 导航栏品牌位改为本地 `Cal Sans` 并提升字号、收紧字距
- `done`：为首页补充轻量页脚信息：
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 新增 `OpenPort / Accentrust` 版权信息与 `AGPLv3` 开源许可说明
- `done`：将登录页与注册页切到新的公共风格：
  - 新增 [apps/web/src/components/public-navbar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/public-navbar.tsx)
  - 新增 [apps/web/src/components/public-footer.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/public-footer.tsx)
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/app/auth/login/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/auth/login/page.tsx)
  - 更新 [apps/web/src/app/auth/register/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/auth/register/page.tsx)
  - 更新 [apps/web/src/components/auth/login-form.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/auth/login-form.tsx)
  - 更新 [apps/web/src/components/auth/register-form.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/auth/register-form.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 登录与注册页面现在复用首页 navbar/footer，去掉旧的实现说明文案，并切到更轻的表单样式
- `done`：将全站主字体切到 `Noto Sans`，不影响 logo：
  - 从 [Noto_Sans.zip](/Users/Sebastian/Documents/Noto_Sans.zip) 解出常用字重到 `apps/web/public/fonts/noto-sans/`
  - 更新 [apps/web/src/app/fonts.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/fonts.ts)
  - 更新 [apps/web/src/app/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/layout.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 正文主字体切到 `Noto Sans`，导航按钮等代码风格文字继续使用 mono，logo 继续使用 `Cal Sans`
- `done`：统一认证表单 placeholder 文案为输入指令式：
  - 更新 [apps/web/src/components/auth/login-form.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/auth/login-form.tsx)
  - 更新 [apps/web/src/components/auth/register-form.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/auth/register-form.tsx)
  - 将示例型 placeholder 改为 `Type your ...` 风格，减少产品命名和示例数据干扰
- `done`：将导航与表单按钮字体也切回 `Noto Sans`：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 去掉按钮和导航链接对 code-like 字体的显式覆盖，保持 logo 继续独立使用 `Cal Sans`
- `done`：为首页插入整宽 hero 图片：
  - 复制 [pexels-poppy-gitsham-2150777280-36113085-1920.jpg](/Users/Sebastian/Documents/pexels-poppy-gitsham-2150777280-36113085-1920.jpg) 到 `apps/web/public/images/openport-hero.jpg`
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 在 `OpenPort for local deployment.` 上方加入页宽图片，并保持移动端自适应
- `done`：继续收敛登录与注册表单细节：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 压低字段 label 的字号、字距和字重
  - 收紧输入框的圆角和内边距，让表单更贴近首页的克制风格
- `done`：放宽首页标题区文本宽度：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 放宽 `OpenPort for local deployment.` 的标题行宽，并同步增加说明文案宽度
- `done`：将首页标题收敛到更稳定的双行排版：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 继续放宽标题容器，并微调字号与字距，减少偏窄堆叠感
- `done`：将首页主文案从说明式改为更品牌化的语气：
  - 更新 [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
  - 首页主文案改为更品牌化但保持原创的语气
  - 避免直接贴近参考站点的现成表述
- `done`：将公共导航栏固定在页面顶部：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - `landing-navbar` 改为 `position: fixed`
  - 同步为首页与认证页补足顶部留白，避免内容被固定导航覆盖
- `done`：移除页脚顶部的分割线：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 页脚现在只保留版权与许可文字，不再用 `border-top` 分隔
- `done`：修复 Docker 注册登录请求的 CORS 预检失败：
  - 更新 [apps/api/src/main.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/main.ts)
  - 为 Fastify/Nest API 显式开启 CORS
  - 允许 `OPTIONS` 预检和前端使用的 `Content-Type / Authorization / x-openport-*` 请求头
- `done`：修正 Docker 前端默认 API 地址为 `127.0.0.1`：
  - 更新 [compose/docker-compose.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/compose/docker-compose.yml)
  - 更新 [\.env.example](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.env.example)
  - 避免浏览器在 `localhost` 解析上出现主机不一致或 IPv6 差异，继续触发 `Failed to fetch`
- `done`：将前端 API 调用切到同源代理：
  - 更新 [apps/web/next.config.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/next.config.mjs)
  - 更新 [apps/web/src/lib/runtime-env.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/runtime-env.ts)
  - 前端统一请求 `/api/openport/...`，由 Next 服务器侧转发到真实 API
  - 避免浏览器直接跨域访问 `4100`，从根上消除 CORS / host 解析差异
- `done`：修正 Docker `web` 容器内部代理目标：
  - 更新 [apps/web/next.config.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/next.config.mjs)
  - 更新 [compose/docker-compose.yml](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/compose/docker-compose.yml)
  - 更新 [\.env.example](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/.env.example)
  - Next 同源代理在容器内改为走 `http://api:4000/api`，不再错误地指向容器自己的 `127.0.0.1:4100`
- `done`：将同源代理从 build-time rewrite 改为 runtime route handler：
  - 更新 [apps/web/next.config.mjs](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/next.config.mjs)
  - 新增 [apps/web/src/app/api/openport/[...path]/route.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/api/openport/[...path]/route.ts)
  - 代理目标在运行时读取 `OPENPORT_INTERNAL_API_BASE_URL`
  - 避免 Docker 构建期把错误的主机地址静态烘焙进 rewrite 目标
- `done`：修复 Docker `web` 镜像缺失本地字体与图片资源的问题：
  - 更新 [docker/web.Dockerfile](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docker/web.Dockerfile)
  - 构建阶段补充复制 `apps/web/public/`
  - 解决 Next.js 在容器内找不到 `fonts/` 和 `images/` 资源导致的 `Font file not found`
- `done`：将 `/dashboard` 从旧 sidebar/card UI 切到新的文本优先工作区壳层：
  - 新增 [apps/web/src/components/dashboard-side-nav.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/dashboard-side-nav.tsx)
  - 更新 [apps/web/src/app/dashboard/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/layout.tsx)
  - 更新 [apps/web/src/app/dashboard/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/page.tsx)
  - 更新 [apps/web/src/components/dashboard-summary.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/dashboard-summary.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 旧的左侧边栏和大卡片概览改为新的工作区壳层、轻量区段标题和分隔式数据列表
- `done`：将登录后的默认入口改为 `AI Workspace`：
  - 更新 [apps/web/src/components/auth/login-form.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/auth/login-form.tsx)
  - 更新 [apps/web/src/components/auth/register-form.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/auth/register-form.tsx)
  - 更新 [apps/web/src/components/landing-entry-actions.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/landing-entry-actions.tsx)
  - 登录和注册成功后统一跳转 `/dashboard/chat`
  - 首页已登录态主入口改为 `Open AI Workspace`
- `done`：将工作区命名收敛为 `Status / Connections / Chat`：
  - 更新 [apps/web/src/components/dashboard-side-nav.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/dashboard-side-nav.tsx)
  - 更新 [apps/web/src/components/landing-entry-actions.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/landing-entry-actions.tsx)
  - 更新 [apps/web/src/components/auth/login-form.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/auth/login-form.tsx)
  - 更新 [apps/web/src/components/auth/register-form.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/auth/register-form.tsx)
  - 更新 [apps/web/src/app/dashboard/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/page.tsx)
  - 更新 [apps/web/src/app/dashboard/integrations/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/integrations/page.tsx)
  - 更新 [apps/web/src/app/dashboard/chat/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/chat/page.tsx)
  - 更新 [apps/web/src/components/integrations-console.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/integrations-console.tsx)
  - 更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
- `done`：将 `Connections` 和 `Chat` 内页也对齐到新的文本优先工作区 UI：
  - 更新 [apps/web/src/app/dashboard/integrations/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/integrations/page.tsx)
  - 更新 [apps/web/src/app/dashboard/chat/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/chat/page.tsx)
  - 更新 [apps/web/src/components/integrations-console.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/integrations-console.tsx)
  - 更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 旧的 `card / panel-header / thread-card` 结构改为分隔式列表、轻量消息区和新的工作区网格
- `done`：将工作区页面导航改为左侧纯文字导航：
  - 新增 [apps/web/src/components/dashboard-side-nav.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/dashboard-side-nav.tsx)
  - 更新 [apps/web/src/app/dashboard/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/layout.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 顶部工作区按钮组移除，改为左侧 `Status / Connections / Chat` 纯文字导航
- `done`：进一步收敛工作区顶部导航：
  - 更新 [apps/web/src/app/dashboard/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/layout.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 移除 dashboard 顶部导航的 `Home` 按钮
  - 移除 dashboard 顶部导航底部分割线
- `done`：将 dashboard 工作区进一步重构为 Open WebUI 风格的应用壳层：
  - 新增 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - 新增 [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - 更新 [apps/web/src/app/dashboard/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/layout.tsx)
  - 更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - 更新 [apps/web/src/app/dashboard/chat/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/chat/page.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - dashboard 从“页面集合”进一步收敛成“应用壳层”
  - `Chat` 改为左侧应用侧栏、中央聊天主画布、右侧 controls rail 的三栏结构
  - `Status / Connections` 继续保留，但已经运行在同一个 app shell 内
- `done`：引入 `minimal-next-js-main` 同源的 `@iconify/react` 图标包，并按 Open WebUI 的典型位置接入图标：
  - 更新 [apps/web/package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/package.json)
  - 更新 [apps/web/package-lock.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/package-lock.json)
  - 新增 [apps/web/src/components/iconify.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/iconify.tsx)
  - 更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - 更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - 更新 [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 侧边栏已按 Open WebUI 的使用习惯为 `New chat`、主导航和 recent chats 加入图标
  - 聊天主画布已为模型标题、空态 badge、suggestions 和 composer action 加入图标
  - 右侧 `Controls` 面板已为标题、section heading 和参数行加入图标
  - 已执行 `npm --prefix apps/web install`、`npm run build:web`、`npm run compose:up` 并确认 Docker 四个容器健康
- `done`：继续按 Open WebUI 的信息架构收敛工作区，而不是只保留“有聊天页的产品”：
  - 更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - 更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - 更新 [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 左侧侧栏已扩展为 `New chat / Search / Notes / Workspace / Chats` 结构
  - `Search` 已接到真实的 chat history 过滤
  - `Notes` 已落为本地快速笔记侧栏模块并持久化到 `localStorage`
  - `Workspace` 已降级为包含 `Status / Connections` 的折叠式分组，不再和 `Chat` 处于同一层级
  - 中间聊天区已改成更接近 Open WebUI 的居中空态模型标题和一体化 composer card
  - 右侧 controls rail 已改成 `Valves / System Prompt / Advanced Params` 三段折叠式结构
  - 已再次执行 `npm run build:web`、`npm run compose:up` 并确认 Docker 四个容器健康
- `done`：进一步参考 Open WebUI 的 `selectedFolder / folder data / per-chat controls` 思路，把本地 `Projects + per-thread settings` 接成一套真实状态：
  - 新增 [apps/web/src/lib/chat-workspace.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-workspace.ts)
  - 更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - 更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - 更新 [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 左侧新增本地 `Projects` 分组，可创建 project，并通过 query + local storage 对 chats 做 project 级归档
  - 新建 chat 时会继承当前 project 上下文，已有 chat 也可在 controls 面板里切换 project
  - 右侧 controls 已不再只是静态占位，`Project / Model route / Operator mode / Function calling / System Prompt / Advanced Params` 都已持久化到本地
  - 工作区状态变更会通过浏览器事件同步 sidebar 与 controls，而不是各自维护孤立状态
  - 已再次执行 `npm run build:web`、`npm run compose:up`，并确认 Docker 四个容器 healthy
- `done`：将 `Notes / Workspace` 从侧栏内嵌块收回为真正的产品页面入口，并继续收紧左侧导航的目录感：
  - 更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 新增 [apps/web/src/app/dashboard/notes/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/notes/page.tsx)
  - 新增 [apps/web/src/app/dashboard/workspace/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/workspace/page.tsx)
  - `Notes` 和 `Workspace` 现在是独立路由，不再伪装成 sidebar 内嵌输入区
  - 左侧导航字号、行高、间距和 section heading 已继续压缩，整体更接近 Open WebUI 的轻量目录结构
  - `Projects` 仍保留为 OpenPort 自有命名，但不再和 `Folders` 混用
  - 已再次执行 `npm run build:web`、`npm run compose:up`，并确认 Docker 四个容器 healthy
- `done`：对齐聊天区右上角交互，补齐更接近 Open WebUI 的 status / controls / account cluster：
  - 更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - 更新 [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 右上角已改为 runtime status icon、controls toggle 和 account avatar 的紧凑图标组
  - account avatar 已补齐 dropdown menu，含 `Settings / Archived Chats / Playground / Admin Panel / Documentation / Releases / Keyboard shortcuts / Sign Out`
  - controls rail 已补齐 close button，不再只能通过外部点击切换
- `done`：统一产品 UI 的文字基线到 `15px`，并将分组标题固定到 `12px`：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - `html` 根字号已统一为 `15px`
  - 左侧导航、聊天菜单等主要界面文字已统一到 `1rem`
  - `Projects / Chats` 等分组标题已固定为 `0.8rem`，即 `12px`
- `done`：继续收紧右侧 `Controls` 面板的参数层级：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 参数名称与参数行标签已统一锁定为 `12px`
- `done`：参考 Open WebUI 的 notes 主链路，在 OpenPort 内落地本地可用的完整 notes workspace：
  - 新增 [apps/web/src/lib/notes-workspace.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/notes-workspace.ts)
  - 新增 [apps/web/src/lib/workspace-notes.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/workspace-notes.ts)
  - 新增 [apps/web/src/components/notes/notes-workspace.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/notes-workspace.tsx)
  - 新增 [apps/web/src/components/notes/note-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/note-editor.tsx)
  - 更新 [apps/web/src/app/dashboard/notes/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/notes/page.tsx)
  - 新增 [apps/web/src/app/dashboard/notes/[id]/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/notes/[id]/page.tsx)
  - 新增 [apps/web/src/app/dashboard/notes/new/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/notes/new/page.tsx)
  - 更新 [apps/web/src/components/workspace-app-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-app-shell.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - notes 现在具备列表页、搜索、按时间分组、创建、删除、复制、置顶、详情编辑、自动保存、版本恢复和本地 assistant side panel
  - `/dashboard/notes/[id]` 已成为真正的 note editor route，不再只是占位文案页
  - 兼容层 `workspace-notes.ts` 已保留给现有 workspace search modal 使用，避免 notes 迁移期间打断搜索能力
  - 已执行 `npm run build:web`
- `done`：参考 Open WebUI 的 `showSearch -> SearchModal -> search API / preview` 结构，将搜索从 sidebar 内联筛选升级为独立工作区搜索层：
  - 新增 [apps/web/src/components/workspace-app-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-app-shell.tsx)
  - 新增 [apps/web/src/components/workspace-search-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-search-modal.tsx)
  - 新增 [apps/web/src/lib/workspace-search.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/workspace-search.ts)
  - 更新 [apps/web/src/app/dashboard/layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/layout.tsx)
  - 更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - 更新 [apps/web/src/app/dashboard/notes/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/notes/page.tsx)
  - 更新 [apps/web/src/components/notes/note-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/note-editor.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - `Search` 已不再是 sidebar 中的展开输入框，而是独立 modal，支持 `Cmd/Ctrl + K`、键盘上下选择、回车进入
  - 搜索结果现在包含 actions、chat results、note results，以及右侧 preview panel
  - query 现在支持 OpenPort 自己的过滤写法：`project:name`、`type:chat`、`type:note`
  - 从搜索可以直接创建新 chat 和新 note，并跳到对应页面
- `done`：继续收敛搜索交互，保留更单纯的“查找与跳转”定位：
  - 更新 [apps/web/src/components/workspace-search-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-search-modal.tsx)
  - 已移除搜索内的 `Actions` 区域
  - 搜索结果现在只保留 chats / notes 命中项与右侧 preview
  - 空结果时改为轻量提示，而不再把创建行为伪装成搜索结果
- `done`：继续将右侧 `Controls` 面板往更高密度的 Open WebUI 风格收敛：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - section 标题已收紧到 `14px`
  - 输入框、下拉框、textarea 内文字已统一到 `12px`
  - 控件高度、内边距和 section 间距已进一步压缩
- `done`：调查并迁移 Open WebUI 的 `Keyboard Shortcuts` 功能架构到 OpenPort：
  - 新增 [apps/web/src/lib/shortcuts.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/shortcuts.ts)
  - 新增 [apps/web/src/components/keyboard-shortcuts-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/keyboard-shortcuts-modal.tsx)
  - 更新 [apps/web/src/components/workspace-app-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-app-shell.tsx)
  - 更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - 更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - 更新 [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 已按 Open WebUI 的方式拆成“快捷键注册表 + 全局 keydown 监听 + shortcuts modal”
  - 账号菜单里的 `Keyboard shortcuts` 现在会真正打开 modal，而不是占位链接
  - 已接入 `New Chat / Search / Open Settings / Show Shortcuts / Toggle Sidebar / Focus Chat Input / Open Model Selector / Generate Message Pair / Copy Last Response / Copy Last Code Block`
- `done`：继续统一左侧 sidebar 的垂直节奏：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 一级入口、历史项和 project 项的行高已进一步压缩
  - `Projects / Chats` 分组标题与列表距离已继续收紧
  - 左侧 utility group、导航列表和 history list 的 gap 已进一步统一
- `done`：继续统一工作区的视觉重心，收掉仍然偏“重”的品牌位、空态和右上角图标组：
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 左侧 brand wordmark 已缩一档，`New chat` 和底部账号区已进一步轻量化
  - 右上角 status / controls / avatar cluster 已继续压缩尺寸与菜单密度
  - `Chat` 空态 badge、标题和说明已收紧，不再像独立 landing section
- `done`：将搜索从前端本地过滤升级为带后端契约的正式搜索能力，并把完整迁移方案写入新文档：
  - 新增 [docs/22-openport-search-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/22-openport-search-parity-plan.md)
  - 更新 [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)
  - 新增 [apps/api/src/search/dto/search-query.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/search/dto/search-query.dto.ts)
  - 新增 [apps/api/src/search/search.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/search/search.service.ts)
  - 新增 [apps/api/src/search/search.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/search/search.controller.ts)
  - 新增 [apps/api/src/search/search.module.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/search/search.module.ts)
  - 更新 [apps/api/src/app.module.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/app.module.ts)
  - 更新 [apps/api/src/ai/ai.module.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/ai.module.ts)
  - 更新 [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - 更新 [apps/web/src/lib/workspace-search.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/workspace-search.ts)
  - 新增 [apps/web/src/components/workspace-search-input.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-search-input.tsx)
  - 新增 [apps/web/src/components/search-highlight.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/search-highlight.tsx)
  - 更新 [apps/web/src/components/workspace-search-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-search-modal.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 搜索现在使用 `/api/search`，返回统一的 `items / hasMore / nextCursor / total` 契约，而不是本地拼接 chats/notes 结果
  - 输入框现在支持 `project:` 和 `type:` 操作符补全，支持键盘接受建议
  - 搜索结果现在支持高亮渲染和分页加载，并继续保留右侧 preview
  - `project:` 仍然可用，但由于 `Projects` 目前是前端本地状态，project filtering 仍由前端对后端结果做二次过滤
  - 为了让验证链路可用，也修正了 [apps/api/src/search/search.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/search/search.controller.ts) 和 [apps/api/src/notes/notes.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/notes/notes.controller.ts) 的 DTO 运行时导入边界
  - 同时修正了若干现有类型边界，见 [apps/web/src/components/notes/note-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/note-editor.tsx) 和 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - 已执行 `npm run build`、`npm run build:api`、`npm run build:web`、`npm run compose:up`
  - 已实际验证：
    - `POST /api/notes`
    - `POST /api/ai/sessions`
    - `GET /api/search?q=smoke&limit=5`
    - `GET /api/search?q=type:note smoke&limit=5`
    - `GET /api/search?q=search&limit=1`
- `done`：继续执行搜索第 2、3 阶段，但明确跳过同事负责的 project 后端持久化：
  - 新增 [docs/23-openport-search-stage-2-3-implementation-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/23-openport-search-stage-2-3-implementation-plan.md)
  - 更新 [apps/web/src/lib/workspace-search.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/workspace-search.ts)
  - 更新 [apps/web/src/components/workspace-search-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-search-modal.tsx)
  - 更新 [apps/web/src/components/workspace-search-input.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-search-input.tsx)
  - 更新 [apps/web/src/components/search-highlight.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/search-highlight.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 搜索已重新收回纯搜索，不再混入 `>` action palette
  - 空输入时现在展示 `Recent` 搜索历史，而不是伪装成结果项的创建动作
  - 高亮已从“只依赖后端单段 range”升级为“后端 range + 前端 query term 多段匹配合并”
  - chat preview 现在优先展示命中 query 的消息；note preview 现在会加载完整 note，并显示内容、tags、pinned / archived 状态
  - 结果列表继续保留后端分页，但现在改成滚动接近底部自动继续加载，而不是手动按钮
  - 已再次执行 `npm run build:web`、`npm run build:api`、`npm run compose:up`
  - 已再次执行运行态检查：
    - `GET http://127.0.0.1:3100/api/health`
    - `GET /api/search?q=search&limit=5`
    - 重建后重新注入 chat/note 测试数据并确认搜索返回 chat + note 混合结果
- `done`：将 `Notes` 从 textarea/plain-text 编辑器升级为对齐 Open WebUI 路线的 `TipTap/ProseMirror` 富文本编辑器，并将完整方案写入新文档：
  - 新增 [docs/24-openport-notes-rich-text-editor-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/24-openport-notes-rich-text-editor-plan.md)
  - 更新 [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)
  - 更新 [apps/api/src/notes/dto/create-note.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/notes/dto/create-note.dto.ts)
  - 更新 [apps/api/src/notes/dto/update-note.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/notes/dto/update-note.dto.ts)
  - 更新 [apps/api/src/notes/notes.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/notes/notes.service.ts)
  - 更新 [apps/api/src/notes/notes-realtime.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/notes/notes-realtime.service.ts)
  - 更新 [apps/api/src/notes/notes-collaboration.gateway.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/notes/notes-collaboration.gateway.ts)
  - 新增 [apps/web/src/lib/notes-rich-text.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/notes-rich-text.ts)
  - 更新 [apps/web/src/lib/notes-realtime.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/notes-realtime.ts)
  - 新增 [apps/web/src/components/notes/note-rich-text-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/note-rich-text-editor.tsx)
  - 更新 [apps/web/src/components/notes/note-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/note-editor.tsx)
  - 更新 [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 新增 [apps/web/src/types/joplin-turndown-plugin-gfm.d.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/types/joplin-turndown-plugin-gfm.d.ts)
  - 新增 [apps/web/src/types/turndown.d.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/types/turndown.d.ts)
  - `Notes` 现在保存并恢复 `contentHtml + contentMd + excerpt`
  - 编辑器已经切到 `TipTap/ProseMirror`，不再是 textarea
  - 现有 `Yjs + websocket` realtime collaboration 已继续工作在富文本链路上
  - 已执行 `npm --prefix apps/web install`
  - 已执行 `npm run build:web`
  - 已执行 `npm run build:api`
  - 已执行 `npm run compose:up`
  - 已实际验证：
    - `GET http://127.0.0.1:4100/api/health`
    - `GET http://127.0.0.1:3100/dashboard/notes`
    - `POST /api/auth/register`
    - `POST /api/notes` with `contentHtml`
    - `PATCH /api/notes/:id` with `contentHtml`
    - `GET /api/notes/:id` readback includes persisted `contentHtml`
- `done`：继续按 Open WebUI `RichTextInput` 结构补齐 notes editor 的高频交互模块，并将完整方案写入新文档：
  - 新增 [docs/25-openport-notes-openwebui-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/25-openport-notes-openwebui-parity-plan.md)
  - 更新 [apps/web/src/components/notes/note-rich-text-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/note-rich-text-editor.tsx)
  - 更新 [apps/web/src/lib/notes-rich-text.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/notes-rich-text.ts)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 更新 [apps/web/package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/package.json)
  - 现已补齐：
    - `BubbleMenu`
    - `Floating insert menu`
    - `Table`
    - `Image` 本地插入
    - clipboard paste image
    - table markdown/html 转换规则
  - 这轮实现直接参考了 Open WebUI 的 `RichTextInput.svelte`、`Collaboration.ts`、`Image/image.ts` 的结构和扩展组合，但在 React/Next 下重建
  - 已执行 `npm --prefix apps/web install`
  - 已执行 `npm run build:web`
  - 已执行 `npm run compose:up`
  - 已实际验证：
    - `GET http://127.0.0.1:3100/dashboard/notes/new`
    - Docker 四个容器全部 `healthy`
- `done`：将 chat metadata 从“临时 UI 状态”升级为对齐 Open WebUI 方向的后端持久化元数据，并把完整方案写入 [docs/23-openport-chat-metadata-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/23-openport-chat-metadata-parity-plan.md)：
  - 新增 [apps/api/src/ai/dto/list-chat-sessions.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/dto/list-chat-sessions.dto.ts)
  - 新增 [apps/api/src/ai/dto/update-chat-session-meta.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/dto/update-chat-session-meta.dto.ts)
  - 更新 [apps/api/src/ai/ai.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/ai.controller.ts)
  - 更新 [apps/api/src/ai/ai.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/ai.service.ts)
  - 更新 [apps/api/src/storage/api-state-store.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/storage/api-state-store.service.ts)
  - 更新 [apps/api/src/search/search.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/search/search.service.ts)
  - 更新 [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - 更新 [apps/web/src/lib/workspace-search.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/workspace-search.ts)
  - 更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - 更新 [apps/web/src/components/project-tree-item.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-tree-item.tsx)
  - 更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - 更新 [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - `archived / pinned / tags / settings.projectId` 现在都是正式的后端字段，不再只是前端临时态
  - Docker/Postgres 路径下，`openport_chat_sessions` 已新增 metadata 列并支持老库 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 迁移
  - `Chat` 现在支持：
    - 活跃/归档视图切换
    - pin / archive / restore
    - tags 编辑
    - project 归属按 `session.settings.projectId` 驱动
  - `Search` 结果的 project 关联也已切到后端 session metadata
  - 已执行 `npm run build:api`
  - 已执行 `npm run build:web`
  - 已执行 `npm run compose:up`
  - 已实际验证：
    - `POST /api/ai/sessions`
    - `PATCH /api/ai/sessions/:id/meta`
    - Postgres 查询 `openport_chat_sessions`
    - 重启 `compose-api-1` 后 `GET /api/ai/sessions?archived=true`
    - `GET /api/ai/sessions?archived=false` excludes archived rows
- `done`：补齐搜索剩余两项差距，并将完整方案写入 [docs/26-openport-search-operators-history-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/26-openport-search-operators-history-parity-plan.md)：
  - 更新 [apps/api/src/search/search.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/search/search.service.ts)
  - 更新 [apps/web/src/lib/workspace-search.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/workspace-search.ts)
  - 更新 [apps/web/src/components/workspace-search-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-search-modal.tsx)
  - `GET /api/search` 现在完整识别并过滤 `tag:` / `archived:` / `pinned:`
  - 搜索输入现在对 `tag:`、`archived:`、`pinned:` 提供补全和值建议
  - 最近搜索现在会持久化 `count / lastResultCount / topResultType`
  - 空查询状态现在分成 `Recent` 与 `Recommended`
  - 推荐项不再是静态占位，而是根据 `tags / archived / pinned / chats / notes / recent history` 实时生成
  - 右侧 preview 现在也会为 recent queries 和 recommended filters 提供说明，不再只有结果预览
  - 已再次执行：
    - `npm run build:web`
    - `npm run build:api`
    - `npm run compose:up`
  - 已实际验证：
    - `GET http://127.0.0.1:3100/api/health`
    - `POST /api/notes` + `PATCH /api/notes/:id`
    - `POST /api/ai/sessions` + `PATCH /api/ai/sessions/:id/meta`
    - `GET /api/search?q=tag:smoke-tag&limit=10`
    - `GET /api/search?q=archived:true&limit=10`
    - `GET /api/search?q=pinned:true&limit=10`
- `done`：在同事完成项目后端持久化后，补齐 `project:` 的服务端原生搜索支持，并将方案写入 [docs/27-openport-search-project-server-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/27-openport-search-project-server-parity-plan.md)：
  - 更新 [apps/api/src/search/search.module.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/search/search.module.ts)
  - 更新 [apps/api/src/search/search.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/search/search.service.ts)
  - 更新 [apps/web/src/components/workspace-search-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-search-modal.tsx)
  - `project:` 现在由 `/api/search` 服务端解析，不再被后端忽略
  - 搜索会基于持久化 projects 解析目标项目，并自动扩展到 descendant projects
  - `project:` 只约束 chats，不再让前端按旧本地缓存做二次过滤
- `done`：补齐 `OpenPort Notes` 最后一轮 `Open WebUI RichTextInput` 对齐模块，并将方案写入 [docs/28-openport-notes-final-openwebui-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/28-openport-notes-final-openwebui-parity-plan.md)：
  - 更新 [apps/web/src/components/notes/note-rich-text-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/note-rich-text-editor.tsx)
  - 更新 [apps/web/src/components/notes/note-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/note-editor.tsx)
  - 更新 [apps/web/src/lib/note-drag-handle.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/note-drag-handle.ts)
  - 更新 [apps/web/src/lib/notes-rich-text.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/notes-rich-text.ts)
  - 更新 [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - 更新 [apps/api/src/notes/notes.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/notes/notes.service.ts)
  - 更新 [apps/api/src/notes/notes.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/notes/notes.controller.ts)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 更新 [apps/web/package.json](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/package.json)
  - 新增并打通：
    - `slash suggestion` 渲染器
    - `mentions`
    - `drag handle`
    - Notes 图片上传 API 与代理读取
  - 这轮实现优先参考了 Open WebUI 的 `commands.ts`、`suggestions.ts`、`listDragHandlePlugin.js`、`RichTextInput.svelte`
  - 为通过完整 Docker 构建，同时顺手修复了两处 web 类型漂移：
    - [apps/api/src/ai/ai.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/ai.service.ts)
    - [apps/web/src/lib/chat-workspace.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-workspace.ts)
  - 已执行：
    - `npm --prefix apps/web install @tiptap/extension-mention`
    - `npm run build:web`
    - `npm run build:api`
    - `npm run compose:up`
  - 已实际验证：
    - `docker compose -f compose/docker-compose.yml ps`
    - `GET http://127.0.0.1:3100/api/health`
    - `GET http://127.0.0.1:4100/api/health`
    - `POST /api/notes`
    - `POST /api/notes/uploads`
    - `GET /api/openport/notes/uploads/:fileName`
    - `compose-api-1 / compose-web-1 / compose-reference-server-1 / compose-postgres-1` 全部 `healthy`
- `done`：继续将 `Notes` 编辑体验向 `Open WebUI` 收到更接近完成态，并将方案写入 [docs/29-openport-notes-openwebui-polish-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/29-openport-notes-openwebui-polish-plan.md)：
  - 更新 [apps/web/src/lib/notes-rich-text.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/notes-rich-text.ts)
  - 更新 [apps/web/src/components/notes/note-rich-text-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/note-rich-text-editor.tsx)
  - 更新 [apps/web/src/components/notes/note-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/notes/note-editor.tsx)
  - 更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - 更新 [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - 这轮对齐直接参考了 Open WebUI 的 `RichTextInput.svelte`、`FormattingButtons.svelte`、`Collaboration.ts`
  - 已补齐：
    - markdown `<@id>` 到 mention 富文本 node 的恢复
    - mention 的 markdown/html 往返
    - `H1 / H2 / H3 / Lift List / Sink List` toolbar 能力
    - note header 协作者头像条和活跃人数展示
  - 为通过完整 web 构建，顺手补齐了 `openport-api` 对 `OpenPortProjectCollaborationState` 的类型再导出
  - 已执行：
    - `npm run build:web`
    - `npm run build:api`
- `done`：完成 `Projects` 在 `folders parity` 之后的四项重增强，并将方案与实施状态写入 [docs/26-openport-projects-phase3-enhancement-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/26-openport-projects-phase3-enhancement-plan.md)：
  - 更新 [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
  - 更新 [apps/api/src/projects/projects.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.controller.ts)
  - 更新 [apps/api/src/projects/project-assets.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/project-assets.service.ts)
  - 更新 [apps/api/src/projects/project-events.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/project-events.service.ts)
  - 更新 [apps/api/src/projects/project-knowledge-index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/project-knowledge-index.ts)
  - 更新 [apps/api/src/ai/ai.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/ai.service.ts)
  - 更新 [apps/web/src/components/project-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-modal.tsx)
  - 更新 [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - 更新 [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - 更新 [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - 更新 [apps/web/src/app/dashboard/workspace/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/workspace/page.tsx)
  - 更新 [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - 更新 [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)
  - 本轮实现优先参考了 Open WebUI 的 `files`, `knowledge`, `AccessControl`, `FolderModal` 本地代码路径
  - 已补齐：
    - API-backed projects 与 asset metadata store
    - server-backed background / knowledge asset upload
    - retrieval-backed knowledge chunking / search / chat context注入
    - SSE invalidation + project collaboration heartbeat
    - project access grants / sharing UI
    - workspace/chat 对 storage / retrieval / collaboration 的消费
  - 已执行：
    - `npm --prefix packages/openport-product-contracts run build`
    - `npm --prefix apps/api run build`
    - `npm --prefix apps/web run build`
- `done`：复核同事最近提交后的 `Projects` 基线，并确认 [docs/26-openport-projects-phase3-enhancement-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/26-openport-projects-phase3-enhancement-plan.md) 不需要结构性改写；在复测阶段补上两处真实运行缺口：
  - 更新 [apps/api/src/storage/api-state-store.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/storage/api-state-store.service.ts)
  - 已修复：
    - `openport_projects` postgres 持久化缺少 `access_grants` 列，导致 sharing grant 不能真正落库
    - retrieval search 对 chunk vector 做分数计算前缺少数值归一化，导致已索引知识偶发返回空结果
  - 已执行：
    - `npm --prefix apps/api run build`
    - `npm run compose:up`
    - `GET /api/projects/:id/knowledge/search?q=latency&limit=3`
    - `POST /api/projects/:id/access-grants`
- `done`：继续把 `Workspace` 四个子页做成真实 CRUD / detail 模块，并将方案写入 [docs/30-openport-workspace-crud-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/30-openport-workspace-crud-parity-plan.md)：
  - 更新 [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)
  - 更新 [apps/api/src/storage/api-state-store.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/storage/api-state-store.service.ts)
  - 新增 `workspace` 资源模块：
    - [apps/api/src/workspace-resources/workspace-resources.module.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/workspace-resources/workspace-resources.module.ts)
    - [apps/api/src/workspace-resources/workspace-resources.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/workspace-resources/workspace-resources.controller.ts)
    - [apps/api/src/workspace-resources/workspace-resources.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/workspace-resources/workspace-resources.service.ts)
    - 对应 DTO 目录 [apps/api/src/workspace-resources/dto](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/workspace-resources/dto)
  - 更新 [apps/api/src/projects/projects.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.controller.ts)
  - 更新 [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
  - 更新 [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - 新增前端模块组件：
    - [apps/web/src/components/workspace-models.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-models.tsx)
    - [apps/web/src/components/workspace-model-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-model-editor.tsx)
    - [apps/web/src/components/workspace-knowledge.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge.tsx)
    - [apps/web/src/components/workspace-knowledge-create.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-create.tsx)
    - [apps/web/src/components/workspace-knowledge-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-detail.tsx)
    - [apps/web/src/components/workspace-prompts.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-prompts.tsx)
    - [apps/web/src/components/workspace-prompt-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-prompt-editor.tsx)
    - [apps/web/src/components/workspace-tools.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tools.tsx)
    - [apps/web/src/components/workspace-tool-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tool-editor.tsx)
  - 新增并接通路由：
    - `/workspace/models/create`
    - `/workspace/models/[id]`
    - `/workspace/knowledge/create`
    - `/workspace/knowledge/[id]`
    - `/workspace/prompts/create`
    - `/workspace/prompts/[id]`
    - `/workspace/tools/create`
    - `/workspace/tools/[id]`
  - 这轮实现优先参考了本地 `open-webui-main` 的：
    - `workspace/models/*`
    - `workspace/knowledge/*`
    - `workspace/prompts/*`
    - `workspace/tools/*`
    - 以及对应的 `ModelEditor / PromptEditor / ToolkitEditor / KnowledgeBase` 结构
  - 已补齐：
    - `Models` 真实管理资源与持久化
    - `Knowledge` 上传页与详情页
    - `Prompts` 创建 / 编辑器
    - `Tools` 创建 / 编辑器
    - `Knowledge` detail / delete API
  - 已执行：
    - `npm run build:api`
    - `npm run build:web`
    - `npm run compose:up`
    - `docker compose -f compose/docker-compose.yml ps`
  - 已实际验证：
    - `GET /api/workspace/models`
    - `POST /api/workspace/models`
    - `POST /api/workspace/prompts`
    - `POST /api/workspace/tools`
    - `POST /api/projects/knowledge/upload`
    - `GET /api/projects/knowledge/:id`
    - `GET http://127.0.0.1:3100/workspace/models`
    - `GET http://127.0.0.1:3100/workspace/models/create`
    - `GET http://127.0.0.1:3100/workspace/prompts/create`
    - `GET http://127.0.0.1:3100/workspace/tools/create`
    - `GET http://127.0.0.1:3100/workspace/knowledge/:id`
    - `compose-api-1 / compose-web-1 / compose-reference-server-1 / compose-postgres-1` 全部 `healthy`
- `done`：新增 [docs/31-openport-platform-foundation-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/31-openport-platform-foundation-parity-plan.md)，并按 Open WebUI 的 `storage provider / vector factory / socket realtime / access control` 结构完成平台基础设施对齐：
  - 新增并接通 API 模块：
    - [apps/api/src/projects/project-storage.provider.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/project-storage.provider.ts)
    - [apps/api/src/projects/project-retrieval.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/project-retrieval.service.ts)
    - [apps/api/src/projects/projects-collaboration.gateway.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects-collaboration.gateway.ts)
    - [apps/api/src/groups/groups.module.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/groups/groups.module.ts)
    - [apps/api/src/groups/groups.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/groups/groups.service.ts)
    - [apps/api/src/groups/groups.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/groups/groups.controller.ts)
  - 更新：
    - [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
    - [apps/api/src/projects/project-assets.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/project-assets.service.ts)
    - [apps/api/src/projects/project-events.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/project-events.service.ts)
    - [apps/api/src/storage/api-state-store.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/storage/api-state-store.service.ts)
    - [apps/api/src/workspaces/workspaces.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/workspaces/workspaces.service.ts)
  - 更新 web 侧消费与管理：
    - [apps/web/src/lib/project-realtime.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/project-realtime.ts)
    - [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
    - [apps/web/src/components/project-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-modal.tsx)
    - [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
    - [apps/web/src/components/workspace-access.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-access.tsx)
    - [apps/web/src/app/workspace/access/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/workspace/access/page.tsx)
    - [apps/web/src/components/workspace-model-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-model-editor.tsx)
    - [apps/web/src/components/workspace-tool-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tool-editor.tsx)
  - 更新共享 contracts：
    - [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)
  - 已执行：
    - `npm --prefix packages/openport-product-contracts run build`
    - `npm --prefix apps/api run build`
    - `npm --prefix apps/web run build`
    - `npm run compose:up`
    - `docker compose -f compose/docker-compose.yml ps`
  - 已实际验证：
    - `GET /api/health`
    - `GET /api/groups`
    - `GET /api/projects`
    - `GET /api/projects/:id/knowledge/search?q=latency&limit=3`
    - `POST /api/projects/:id/access-grants` with `principalType=group`
    - `GET /api/projects/:id` as `user_secondary`
    - `compose-api-1 / compose-web-1 / compose-reference-server-1 / compose-postgres-1` 全部 `healthy`
- `done`：新增 [docs/32-openport-workspace-deep-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/32-openport-workspace-deep-parity-plan.md)，并按本地 `open-webui-main` 的 `ModelEditor / KnowledgeBase / PromptEditor / ToolkitEditor` 结构完成 Workspace 深化实施。
- `done`：扩展 [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)，补齐：
  - `OpenPortWorkspaceModelCapabilities`
  - `OpenPortKnowledgeCollection`
  - `OpenPortWorkspacePromptVersion`
  - `OpenPortKnowledgeCollectionsResponse`
  - `OpenPortWorkspacePromptVersionsResponse`
  同时为 `model / knowledge item / tool` 增加 `filterIds / capabilities / collection / contentText / valves` 字段。
- `done`：扩展 [apps/api/src/storage/api-state-store.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/storage/api-state-store.service.ts)，把 Workspace 深化字段纳入 file/postgres 双后端持久化：
  - knowledge item：`collectionId / collectionName / contentText / source`
  - model：`filterIds / capabilities`
  - tool：`valves`
  - prompt：`openport_workspace_prompt_versions` 版本表与读写逻辑
- `done`：扩展 `WorkspaceResources` API，完成：
  - model 的 `filters / capabilities` 持久化
  - tool 的 `valves` 持久化
  - prompt 版本历史查询
  - prompt 历史版本恢复
- `done`：扩展 `Projects` Knowledge API，完成：
  - `GET /projects/knowledge/collections`
  - `POST /projects/knowledge/text`
  - `POST /projects/knowledge/:itemId/append`
  让 Knowledge 支持 collection 级组织、文本录入与增量导入。
- `done`：升级 Workspace 前端四个核心模块：
  - `Models`：provider/status filters、filterIds、capabilities toggle
  - `Knowledge`：collection filter、upload/text 双模式创建、append 内容
  - `Prompts`：版本历史列表与 restore flow
  - `Tools`：manifest 编辑与 `valves` key/value 编辑体验
- `done`：执行构建与运行态验收，确认 `Workspace` 深化实现可用：
  - `npm run build:web`
  - `npm run build:api`
  - `docker compose -f compose/docker-compose.yml up -d --build`
  - `GET /api/projects/knowledge/collections`
  - `POST /api/projects/knowledge/text`
  - `POST /api/workspace/models`
  - `POST /api/workspace/tools`
  - `POST /api/workspace/prompts`
  - `GET /api/workspace/prompts/:id/versions`
  - `POST /api/workspace/prompts/:id/versions/:versionId/restore`
  均已验证通过，且 Docker 四个容器保持 `healthy`。
- `done`：新增 [docs/33-openport-workspace-product-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/33-openport-workspace-product-parity-plan.md)，继续按本地 `open-webui-main` 的 `ModelEditor / KnowledgeBase / PromptEditor / ToolkitEditor` 结构，把 Workspace 从 CRUD 产品页推进到更接近完整产品态。
- `done`：`Models` 已进一步收敛为更完整的资源页：
  - list 页补齐 `query / provider / status / capability / knowledge collection` 过滤
  - card 补齐 `knowledge / tools` 摘要
  - editor 内的 knowledge selector 已按 collection 分组显示
- `done`：`Knowledge` 已补齐 collection 级浏览与使用关系：
  - list 页新增 collection summary cards
  - 新增 `/workspace/knowledge/collections/[id]`
  - knowledge detail 页支持直接 attach/detach project
  - collection detail 页可查看该 collection 下的 items 与关联 projects
- `done`：`Prompts` 已补齐更接近 Open WebUI 的历史协作能力：
  - create/update DTO 和持久化链新增 `commitMessage`
  - prompt version 现在持久化版本备注
  - editor 新增 `Version note`
  - editor 新增历史版本对比 `Diff preview`
- `done`：`Tools` 编辑器已从简单 textarea 升级为更完整的编辑体验：
  - 结构化 valves rows
  - `Add / Remove valve`
  - manifest templates
  - manifest 摘要 chips
- `done`：完成本轮运行态验收：
  - `npm run build:api`
  - `npm run build:web`
  - `npm run compose:up`
  - `GET /workspace/knowledge/collections/[id]` 页面返回 `200`
  - `POST /api/workspace/prompts` 带 `commitMessage`
  - `GET /api/workspace/prompts/:id/versions` 返回 `commitMessage`
  - `GET /workspace/models` 返回 `200`
  - `GET /workspace/tools/create` 返回 `200`
  - Docker `web/api/reference/postgres` 全部 `healthy`
- `done`：新增 [docs/34-openport-workspace-production-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/34-openport-workspace-production-parity-plan.md)，继续按本地 `open-webui-main` 的 `prompts.py / PromptEditor.svelte / ToolkitEditor.svelte / tools.py` 思路，把 Workspace 从“可编辑”推进到更接近“生产态资源管理”。
- `done`：`Prompts` 已补 production version 语义并接入后端持久化：
  - `OpenPortWorkspacePrompt` 新增 `productionVersionId`
  - `create/update prompt` DTO 新增 `setAsProduction`
  - 新增 `POST /api/workspace/prompts/:id/versions/:versionId/production`
  - Prompt 编辑器支持：
    - `Set this save as production`
    - 历史版本 `Set production`
    - production badge
- `done`：`Tools` 已补结构化 valve schema：
  - `OpenPortWorkspaceTool` 新增 `valveSchema`
  - file/postgres 双后端持久化已完成
  - Tools 编辑器现在把 `runtime valves` 和 `valve schema` 分开管理
  - manifest templates 会同步给出更合理的 schema 起点
- `done`：`Models` 已补默认模型策略收口：
  - 第一个 model 自动成为 default
  - 删除 default model 时自动回退到剩余模型
  - list 页新增 `Default strategy` filter
  - list 页新增 `Make default` 快捷动作
- `done`：完成本轮生产态能力验收：
  - `npm run build:api`
  - `npm run build:web`
  - `npm run compose:up`
  - `POST /api/workspace/prompts` 返回 `productionVersionId`
  - `POST /api/workspace/prompts/:id/versions/:versionId/production` 已验证可更新 production version
  - `POST /api/workspace/tools` 已验证持久化 `valveSchema`
  - `POST /api/workspace/models` + default 切换/删除回退链路已验证
  - Docker `web/api/reference/postgres` 全部 `healthy`
- `done`：新增 [docs/35-openport-knowledge-collections-prompt-workflow-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/35-openport-knowledge-collections-prompt-workflow-plan.md)，继续按本地 `open-webui-main` 的 `knowledge.py / knowledge router / CreateKnowledgeBase.svelte / PromptHistoryMenu.svelte` 思路，把 `Knowledge collections` 和 `Prompt version workflow` 从产品壳层推进到后端持久化资源级。
- `done`：`Knowledge collections` 已改成后端一等资源，而不是从 items 反推：
  - file/postgres 双后端新增 `knowledgeCollectionsByWorkspace`
  - Postgres 新增 `openport_project_knowledge_collections`
  - `General` collection 作为默认集合保留
  - `ProjectsService` 现在会在 upload/text/move/delete 流程里统一解析 collection 目标
- `done`：补齐 collections CRUD 和 item move API：
  - `POST /api/projects/knowledge/collections`
  - `PATCH /api/projects/knowledge/collections/:collectionId`
  - `DELETE /api/projects/knowledge/collections/:collectionId`
  - `PATCH /api/projects/knowledge/:itemId/collection`
- `done`：`Workspace > Knowledge` 已补完整 collection 管理流：
  - `New collection` 入口
  - `/workspace/knowledge/collections/create`
  - `/workspace/knowledge/collections/[id]/edit`
  - knowledge detail 页支持 move collection
  - collection detail 页支持 edit / delete / move items on delete
  - knowledge create 页改为优先选择已有 collection，仍支持按名称新建
- `done`：`Prompts` 已补版本删除与 production 保护：
  - 新增 `DELETE /api/workspace/prompts/:id/versions/:versionId`
  - 非 production version 可删除
  - production version 删除会返回 `400 Cannot delete the production version`
  - Prompt 编辑器历史列表新增 `Delete version`
- `done`：完成本轮运行态验收：
  - `npm run build:api`
  - `npm run build:web`
  - `npm run compose:up`
  - 在 `compose-api-1` 内实际验证：
    - collection create/update/delete
    - knowledge item move to `General`
    - prompt non-production version delete
    - prompt production version delete protection
  - Docker `web/api/reference/postgres` 全部 `healthy`
- `done`：新增 [docs/36-openport-workspace-skills-permissions-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/36-openport-workspace-skills-permissions-parity-plan.md)，继续参考本地 `open-webui-main` 的 Workspace 结构，把 `Skills`、权限驱动导航和模块 import/export 一起补齐。
- `done`：后端已补齐 `Skills` 资源：
  - file/postgres 双后端新增 `workspaceSkillsByWorkspace`
  - Postgres 新增 `openport_workspace_skills`
  - `workspace-resources` 已补：
    - `GET /workspace/skills`
    - `POST /workspace/skills`
    - `GET /workspace/skills/:id`
    - `PATCH /workspace/skills/:id`
    - `DELETE /workspace/skills/:id`
- `done`：前端已补齐 `Skills` 模块：
  - `/workspace/skills`
  - `/workspace/skills/create`
  - `/workspace/skills/[id]`
  - 支持列表、搜索、创建、编辑、删除、JSON import/export
- `done`：Workspace 已改成权限驱动导航：
  - tabs 基于 `/auth/me` 的 `permissions.workspace` 过滤
  - 当前模块无权限时自动跳转到首个可访问模块
  - `Access` 已从 Workspace 一级导航降级
  - `/workspace/access` 路由仍保留
- `done`：以下模块已补齐 JSON import/export：
  - `Models`
  - `Prompts`
  - `Tools`
  - `Skills`
- `done`：完成本轮运行态验收：
  - `npm run build:api`
  - `npm run build:web`
  - `npm run compose:up`
  - `GET /workspace/skills` 返回 `200`
  - `GET /workspace/access` 返回 `200`
  - `GET /api/workspace/skills` 返回 `{"items":[]}`
  - `POST /api/workspace/skills` 成功创建 skill
  - Docker `web/api/reference/postgres` 全部 `healthy`
- `done`：完成胶囊按钮样式排查，并新增统一按钮组件 [apps/web/src/components/ui/capsule-button.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/ui/capsule-button.tsx)，收敛 `primary / secondary` 与 `sm / md / lg / icon` 四档尺寸，避免继续在页面里手写圆角按钮样式。
- `done`：`landing / auth / dashboard / chat / notes / workspace resources / confirm dialog / project modal` 里的胶囊按钮已切到统一组件，旧的 `landing-* / workspace-resource-* / project-confirm-* / project-modal-* / chat-thread-meta-button / workspace-inline-action` 手写类名已从组件代码中清除。
- `done`：更新 [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)，把胶囊按钮基线统一到 `.capsule-button`，并将 `active`、hover、disabled、响应式宽度收敛为单一实现。
- `done`：完成本轮前端验收：
  - `npm run build:web`
  - 确认 `landing / auth / chat / workspace` 路由仍可编译
- `done`：继续把非胶囊按钮统一成两套基础原语：
  - [apps/web/src/components/ui/icon-button.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/ui/icon-button.tsx)
  - [apps/web/src/components/ui/text-button.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/ui/text-button.tsx)
  当前 `project menu / workspace search / chat topbar / chat composer tools / chat suggestion list / controls toggles / keyboard shortcuts modal / notes panel / notes floating menu / project tree toggle` 均已切到统一按钮原语，不再继续在组件里手写 `<button>` 交互样式。
- `done`：残留原生 `<button>` 已收敛到结构性遮罩/backdrop 场景，仅用于 `project modal / confirm dialog / keyboard shortcuts modal` 的点击遮罩；业务交互按钮已由 `CapsuleButton / IconButton / TextButton` 承担。
- `done`：顺手修复两处 Workspace Model 契约缺口，给创建/导入 payload 补齐 `skillIds`，避免 Next TypeScript 构建被旧 payload 形状阻塞：
  - [apps/web/src/components/workspace-model-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-model-editor.tsx)
  - [apps/web/src/components/workspace-models.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-models.tsx)
- `done`：完成本轮统一按钮体系验收：
  - `npm run build:web`
  - `npm run compose:up`
  - `docker compose -f compose/docker-compose.yml ps`
  - Docker `web/api/reference/postgres` 全部 `healthy`
- `done`：新增 [docs/40-openport-workspace-resource-depth-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/40-openport-workspace-resource-depth-plan.md)，继续参考本地 `open-webui-main` 的 `Knowledge.svelte / KnowledgeBase.svelte / Prompts.svelte / ToolkitEditor.svelte`，把 `Knowledge / Prompts / Tools` 再往更深一层的资源工作流推进。
- `done`：产品契约和持久化已补齐以下资源字段：
  - `Knowledge item.chunkPreview`
  - `Knowledge item.sources`
  - `Prompt.visibility`
  - `Tool.tags`
  - `Tool.examples`
  对应：
  - [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)
  - [apps/api/src/storage/api-state-store.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/storage/api-state-store.service.ts)
- `done`：`Prompts` 已补资源工作流：
  - 列表支持 `visibility` 过滤
  - 编辑器支持 `Workspace / Private`
  - 编辑器支持 draft `import/export`
  - 编辑器支持 community handoff
  对应：
  - [apps/web/src/components/workspace-prompts.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-prompts.tsx)
  - [apps/web/src/components/workspace-prompt-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-prompt-editor.tsx)
- `done`：`Tools` 已补 `tags/examples` 与更完整的 toolkit preview：
  - 编辑器支持 tags
  - 编辑器支持 examples rows
  - 列表支持 tag 呈现和 example count
  对应：
  - [apps/web/src/components/workspace-tools.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tools.tsx)
  - [apps/web/src/components/workspace-tool-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tool-editor.tsx)
- `done`：`Knowledge detail` 已补 document-centric 检视：
  - `Source records`
  - `Chunk preview`
  - 文档内搜索与统计继续保留
  对应：
  - [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
  - [apps/web/src/components/workspace-knowledge-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-detail.tsx)
- `done`：新增 [docs/41-openport-knowledge-document-flow-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/41-openport-knowledge-document-flow-plan.md)，继续参考本地 `open-webui-main` 的 `Knowledge.svelte / KnowledgeBase.svelte`，把 `Knowledge` 从资源列表推进到更完整的 document 运营流。
- `done`：`/workspace/knowledge` 已补 document summary 和多维过滤：
  - `documents / indexed / chunks / source links / collections / projects attached`
  - `collection / retrieval state / source type` filters
  - list item 已显示 `source` 与 `source count`
  对应：
  - [apps/web/src/components/workspace-knowledge.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge.tsx)
- `done`：`/workspace/knowledge/collections/[id]` 已补 collection-level document management 视图：
  - `documents / indexed / chunks / source links / projects / types` summary
  - `retrieval state / source type` filters
  - item 行显示 `source` 与 `source count`
  对应：
  - [apps/web/src/components/workspace-knowledge-collection-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-collection-detail.tsx)
- `done`：新增 [docs/42-openport-workspace-resource-operations-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/42-openport-workspace-resource-operations-plan.md)，继续参考本地 `open-webui-main` 的 `Prompts.svelte / ToolkitEditor.svelte / Knowledge.svelte / KnowledgeBase.svelte`，把 `Prompts / Tools / Knowledge collections` 的资源操作流再往前推进。
- `done`：`Prompts` 已补标签与可见集操作：
  - `tag` filter
  - summary cards
  - `Copy visible JSON`
  - `Share visible`
  - per-item `Copy command`
  对应：
  - [apps/web/src/components/workspace-prompts.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-prompts.tsx)
- `done`：`Tools` 已补资源筛选与 JSON 工作流：
  - `enabled` filter
  - `integration` filter
  - summary cards
  - `Copy visible JSON`
  - per-item `Copy JSON`
  对应：
  - [apps/web/src/components/workspace-tools.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tools.tsx)
- `done`：`Knowledge collection detail` 已补聚合视图：
  - `Source records`
  - `Chunk coverage`
  - 继续保留 document list / search / retrieval filters
  对应：
  - [apps/web/src/components/workspace-knowledge-collection-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-collection-detail.tsx)
- `done`：新增 [docs/43-openport-knowledge-layered-management-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/43-openport-knowledge-layered-management-plan.md)，继续参考本地 `open-webui-main` 的 `Knowledge.svelte / KnowledgeBase.svelte`，把 `Knowledge` 从聚合视图进一步推进到明确的 `Documents / Sources / Chunks` 分层管理。
- `done`：`Knowledge collection detail` 已补分层视图与可见集导出：
  - `Documents / Sources / Chunks` 视图切换
  - `Export visible`
  - `Sources / Chunks` 视图空状态
  - 查询输入文案已按当前视图切换
  对应：
  - [apps/web/src/components/workspace-knowledge-collection-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-collection-detail.tsx)
- `done`：`Knowledge detail` 已补文档级分层检视：
  - `Document / Sources / Chunks` 视图切换
  - `Source kind` filter
  - `Export visible`
  - `Sources / Chunks` 视图空状态
  对应：
  - [apps/web/src/components/workspace-knowledge-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-detail.tsx)
- `done`：新增 [docs/44-openport-workspace-operations-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/44-openport-workspace-operations-parity-plan.md)，继续参考本地 `open-webui-main` 的 `Knowledge.svelte / KnowledgeBase.svelte / Prompts.svelte / ToolkitEditor.svelte`，把 `Knowledge / Prompts / Tools` 的操作流再往 Open WebUI 靠近。
- `done`：`/workspace/knowledge` 已升级为顶层分层管理：
  - `Documents / Collections / Sources / Chunks` 视图切换
  - `Export visible`
  - 顶层 source ledger
  - 顶层 chunk coverage
  对应：
  - [apps/web/src/components/workspace-knowledge.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge.tsx)
- `done`：`Prompts` 已补更完整的 share/community workflow：
  - `Copy visible commands`
  - per-item `Copy payload`
  - editor `Community payload preview`
  对应：
  - [apps/web/src/components/workspace-prompts.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-prompts.tsx)
  - [apps/web/src/components/workspace-prompt-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-prompt-editor.tsx)
- `done`：`Tools` 已补更完整的 toolkit operations：
  - `scope` filter
  - `tag` filter
  - `Copy visible manifests`
  - editor `Paste import`
  - editor `Copy payload`
  - editor `Runtime example payload`
  对应：
  - [apps/web/src/components/workspace-tools.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tools.tsx)
  - [apps/web/src/components/workspace-tool-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tool-editor.tsx)
- `done`：新增 [docs/45-openport-workspace-independent-operations-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/45-openport-workspace-independent-operations-plan.md)，继续参考本地 `open-webui-main` 的 `Knowledge.svelte / KnowledgeBase.svelte / Prompts.svelte / ToolkitEditor.svelte`，把 `Knowledge / Prompts / Tools` 再推进到更独立的操作流。
- `done`：`Knowledge` 已新增 route-backed 顶层操作流：
  - `/workspace/knowledge`
  - `/workspace/knowledge/collections`
  - `/workspace/knowledge/sources`
  - `/workspace/knowledge/chunks`
  对应：
  - [apps/web/src/components/workspace-knowledge.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge.tsx)
  - [apps/web/src/app/workspace/knowledge/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/workspace/knowledge/page.tsx)
  - [apps/web/src/app/workspace/knowledge/collections/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/workspace/knowledge/collections/page.tsx)
  - [apps/web/src/app/workspace/knowledge/sources/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/workspace/knowledge/sources/page.tsx)
  - [apps/web/src/app/workspace/knowledge/chunks/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/workspace/knowledge/chunks/page.tsx)
- `done`：`Prompts` 已补 visible `Community bundle` 下载，对应：
  - [apps/web/src/components/workspace-prompts.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-prompts.tsx)
- `done`：`Tools` 已补 runtime-oriented 导出流：
  - per-item `Copy payload`
  - visible `Runtime bundle`
  对应：
  - [apps/web/src/components/workspace-tools.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tools.tsx)
- `done`：新增 [docs/46-openport-chat-home-ui-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/46-openport-chat-home-ui-parity-plan.md)，继续参考本地 `open-webui-main` 的 `Chat.svelte / ChatPlaceholder.svelte / Controls.svelte / Sidebar.svelte`，把 `/chat` 主界面进一步往 chat-first 主页收敛。
- `done`：`/chat` 已继续向 Open WebUI 的 chat home 结构收敛：
  - 顶部新增 route-backed 模型菜单，优先读取 workspace models
  - 无会话时模型选择写入 draft chat settings，并在创建首条消息时继承
  - 空态改成更居中的 model + composer + suggestions 结构
  - `pin / archive` 从主画布移出，收进右侧 controls
  - `Controls` 增加 localStorage 持久化折叠状态，并拆出更轻的 `Context` 分区
  - `Projects` 的创建/导入从主列表区块降成 section header action
  对应：
  - [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
- `done`：chat home parity 这一轮验证已通过：
  - `npm run build:web`
  - `npm run compose:up`
- `done`：新增 [docs/49-openport-chat-deep-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/49-openport-chat-deep-parity-plan.md)，继续参考本地 `open-webui-main` 的 `PinnedModelList.svelte / SettingsModal.svelte / InputMenu.svelte`，把 `/chat` 的剩余高价值差异继续往 Open WebUI 靠拢。
- `done`：`/chat` 已补更深一层的 Open WebUI 交互模块：
  - 左侧新增 `Pinned Models`，由本地 chat UI preferences 驱动
  - 顶部模型菜单支持 `pin / unpin`
  - 账号菜单里的 `Settings` 改为打开 chat-scoped settings modal
  - composer `+` 已接入 root/submenu tools menu，支持 attach `knowledge / notes / chats`
  - composer 已支持 attachment chips，并在提交消息时把引用上下文一起拼入 payload
  对应：
  - [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - [apps/web/src/components/chat-settings-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-settings-modal.tsx)
  - [apps/web/src/components/chat-composer-tools-menu.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-composer-tools-menu.tsx)
  - [apps/web/src/lib/chat-ui-preferences.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-ui-preferences.ts)
  - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
- `done`：chat deep parity 这一轮前端构建已通过：
  - `npm run build:web`
- `done`：新增 [docs/50-openport-chat-final-gap-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/50-openport-chat-final-gap-plan.md)，继续参考本地 `open-webui-main` 的 `Sidebar.svelte / Folders.svelte / PinnedModelList.svelte / SettingsModal.svelte / InputMenu.svelte`，把 `/chat` 剩余的 folder-like organization、pinned ordering、settings 细分项、以及 input tool flows 继续补齐。
- `done`：`/chat` 最后一轮高价值差异已继续补齐：
  - `Projects / Chats / Pinned Models` 已支持 section 级折叠，结构更接近 Open WebUI 的 sidebar folders/chats 分组
  - `Projects` 区新增 `All chats` 根入口，并按名称排序根级项目
  - `Pinned Models` 已支持 drag reorder，并持久化到 chat UI preferences
  - `Settings` modal 已扩成 searchable multi-tab surface：
    - `General`
    - `Interface`
    - `Workspace`
    - `Data`
    - `About`
  - composer tools menu 已扩到更完整的 root/submenu flow：
    - `Knowledge`
    - `Notes`
    - `Chats`
    - `Prompts`
    - `Webpage`
  - 各子菜单已新增内联 search / attach flow
  对应：
  - [apps/web/src/lib/chat-ui-preferences.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-ui-preferences.ts)
  - [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - [apps/web/src/components/chat-settings-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-settings-modal.tsx)
  - [apps/web/src/components/chat-composer-tools-menu.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-composer-tools-menu.tsx)
  - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
- `done`：final gap parity 这一轮前端构建已通过：
  - `npm run build:web`
- `done`：final gap parity 这一轮 Docker 重建验证已通过：
  - `npm run compose:up`
  - `docker compose -f compose/docker-compose.yml ps`
- `done`：新增 [docs/51-openport-openwebui-remaining-checklist.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/51-openport-openwebui-remaining-checklist.md)，基于当前 `openport` 代码和本地 `open-webui-main` 真实实现做了一次代码级审计，把剩余差异整理为可继续执行的完成清单。
- `done`：这次审计不是泛化建议，而是按代码现状把模块拆成：
  - `done`：authenticated root / chat-first entry
  - `partial`：sidebar shell / projects-as-folders / chat home / model picker / controls / settings modal / search / composer tools / persistence / notes-workspace
  - `missing`：尚无单独独立模块，但 checklist 中已明确补齐项与验收标准
- `done`：清单里已明确下一阶段的推荐顺序：
  1. app-shell parity
  2. folder/project parity
  3. model and controls parity
  4. composer tool flows
  5. settings/data controls parity
  6. search parity
  7. database-native persistence cleanup
- `done`：新增 [docs/53-openport-app-shell-and-project-model-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/53-openport-app-shell-and-project-model-parity-plan.md)，继续参考本地 `open-webui-main` 的 `Sidebar.svelte / Controls.svelte / ChatPlaceholder.svelte`，先完成 shared shell state，再把 project-level default model route 做成真实持久化配置。
- `done`：`app-shell parity` 已完成：
  - 新增 shared shell provider，统一持有 `showSidebar / sidebarWidth / showControls / controlsWidth / isMobile`
  - sidebar 和 controls 现在都支持 localStorage 持久化的 open/width 状态
  - desktop 已支持 sidebar / controls resize handle
  - mobile 已支持 sidebar / controls drawer + backdrop close
  - sidebar 内的关键导航在 mobile 下会自动 close
  对应：
  - [apps/web/src/components/app-shell-state.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/app-shell-state.tsx)
  - [apps/web/src/components/workspace-app-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-app-shell.tsx)
  - [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
- `done`：`project default model route` 这一条链已补齐：
  - `CreateProjectDto / UpdateProjectDto` 已接受 `data.defaultModelRoute`
  - `ProjectsService` 已标准化并持久化 `defaultModelRoute`
  - project modal 已新增 `Default Model` 字段，并读取 workspace models
  - new chat 在选中 project 时会继承该 project 的 default model route
  对应：
  - [apps/api/src/projects/dto/create-project.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/create-project.dto.ts)
  - [apps/api/src/projects/dto/update-project.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/update-project.dto.ts)
  - [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
  - [apps/web/src/components/project-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-modal.tsx)
  - [apps/web/src/lib/chat-workspace.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-workspace.ts)
  - [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
- `done`：新增 [docs/54-openport-folder-project-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/54-openport-folder-project-parity-plan.md)，继续参考本地 `open-webui-main` 的 `Sidebar.svelte / Folders.svelte / backend folders router/model`，把 OpenPort 的 `Projects` 继续收成更强的 folder-like 组织层。
- `done`：这一轮 `folder/project parity` 已继续补齐：
  - project create/update 已接受并持久化 `isExpanded`
  - sidebar expand/collapse 已写回后端，不再只是本地 cache 状态
  - `All chats` 已支持根级 drop target：
    - drop project => move to root
    - drop chat => clear project assignment
  - nested project context menu 已新增 `Move To Root`
  对应：
  - [apps/api/src/projects/dto/create-project.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/create-project.dto.ts)
  - [apps/api/src/projects/dto/update-project.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/update-project.dto.ts)
  - [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
  - [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - [apps/web/src/components/project-tree-item.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-tree-item.tsx)
  - [apps/web/src/components/project-menu.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-menu.tsx)
  - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
- `done`：这轮 folder/project parity 构建验证已通过：
  - `npm run build:web`
  - `npm run build:api`
- `done`：新增 [docs/55-openport-model-and-controls-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/55-openport-model-and-controls-parity-plan.md)，继续参考本地 `open-webui-main` 的 `Controls.svelte / SettingsModal.svelte / PinnedModelList.svelte`，把 chat defaults 和 controls 进一步从“平面表单”升级成 layered per-chat options。
- `done`：这一轮 `model and controls parity` 已补齐高价值实现：
  - `chat-ui-preferences` 已新增 interface-level `chatDefaults`
  - 新增 [chat-defaults.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-defaults.ts)，把默认链明确成：
    - `project`
    - `interface`
    - `workspace`
    - `runtime`
  - sidebar `New chat` 与 chat home draft settings 都会继承 project/interface/workspace defaults
  - `Controls` 已支持无 active thread 时直接编辑 pending settings
  - `Controls` 已新增 `Files` section，显示并可移除 composer attachments
  - `Controls` 已为 `Model route / System Prompt` 增加 source hint 与 reset-to-inherited action
  - `Settings` modal 的 `Interface` tab 已改成真正可编辑的 defaults surface：
    - `Default model`
    - `Default operator mode`
    - `Default system prompt`
  对应：
  - [apps/web/src/lib/chat-ui-preferences.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-ui-preferences.ts)
  - [apps/web/src/lib/chat-defaults.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-defaults.ts)
  - [apps/web/src/lib/chat-workspace.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/chat-workspace.ts)
  - [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - [apps/web/src/components/chat-settings-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-settings-modal.tsx)
  - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
- `done`：这轮 model and controls parity 构建验证已通过：
  - `npm run build:web`
- `done`：新增 [docs/55-openport-tools-modal-editor-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/55-openport-tools-modal-editor-parity-plan.md)，继续参考本地 `open-webui-main` 的 `ToolkitEditor.svelte`，把 `Workspace > Tools` 的重编辑区块收成 modal 工作流。
- `done`：`Tools modal editor parity` 首版已完成：
  - 新增 manifest modal：
    - [apps/web/src/components/workspace-tool-manifest-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tool-manifest-modal.tsx)
  - 新增 valves modal：
    - [apps/web/src/components/workspace-tool-valves-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tool-valves-modal.tsx)
  - [apps/web/src/components/workspace-tool-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tool-editor.tsx) 已改成：
    - 页面内保留工具身份、integration、scopes、tags、examples、payload 预览
    - `Manifest` 改成 summary + `Open manifest editor`
    - `Valves` / `Schema` 改成 summary + `Open valves editor`
  - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css) 已补 modal 布局和 summary card 样式
- `done`：Workspace parity matrix 已同步更新 [docs/49-openport-workspace-parity-matrix.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/49-openport-workspace-parity-matrix.md)，`Tools editor depth` 现在从“缺失 modal editor”推进到“首版已补，仍待更完整 toolkit workflow”。
- `done`：新增 [docs/56-openport-knowledge-source-replace-quality-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/56-openport-knowledge-source-replace-quality-plan.md)，继续参考本地 `open-webui-main` 的 `KnowledgeBase.svelte`，把 `Knowledge` 从 browse/export 继续推进到 source maintenance + chunk quality inspection。
- `done`：`Knowledge source replace + chunk quality` 首版已完成：
  - 后端新增 `PATCH /projects/knowledge/:itemId/sources/:sourceId`
    - [apps/api/src/projects/dto/replace-project-knowledge-source.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/replace-project-knowledge-source.dto.ts)
    - [apps/api/src/projects/projects.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.controller.ts)
    - [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
  - 前端 API 已接通：
    - [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - 新增 source replace modal：
    - [apps/web/src/components/workspace-knowledge-source-replace-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-source-replace-modal.tsx)
  - document detail 和 source detail 都已接入 `Replace`：
    - [apps/web/src/components/workspace-knowledge-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-detail.tsx)
    - [apps/web/src/components/workspace-knowledge-source-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-source-detail.tsx)
  - chunk detail 已补首版质量分析：
    - `words`
    - `sentences`
    - `lexical diversity`
    - `retrieval fit`
    - `quality flags`
    - [apps/web/src/components/workspace-knowledge-chunk-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-chunk-detail.tsx)
  - 对应 modal 样式已补在：
    - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
- `done`：Workspace parity matrix 已同步更新 [docs/49-openport-workspace-parity-matrix.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/49-openport-workspace-parity-matrix.md)，`Knowledge source operations` 和 `Knowledge chunk operations` 现在都从“仅浏览”推进到了“首版维护/质量分析，仍待更深运营流”。
- `done`：新增 [docs/57-openport-knowledge-batch-probe-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/57-openport-knowledge-batch-probe-parity-plan.md)，继续参考本地 `open-webui-main` 的 `KnowledgeBase.svelte`，把 `Knowledge` 从单条维护继续推进到 batch source maintenance + chunk retrieval probe。
- `done`：`Knowledge batch source maintenance` 已补首版后端单接口：
  - 新增 DTO：
    - [apps/api/src/projects/dto/maintain-project-knowledge-source.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/maintain-project-knowledge-source.dto.ts)
  - 新增路由：
    - `POST /projects/knowledge/sources/:sourceId/batch`
    - [apps/api/src/projects/projects.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.controller.ts)
  - 新增服务实现：
    - `maintainKnowledgeSourceBatch()`
    - [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
- `done`：`Knowledge chunk retrieval probe` 已补首版接口：
  - 新增路由：
    - `GET /projects/knowledge/:itemId/chunks/search`
  - 新增服务实现：
    - `searchKnowledgeChunks()`
  - 对应同文件：
    - [apps/api/src/projects/projects.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.controller.ts)
    - [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
- `done`：前端 `Knowledge` 页面已接入 batch + probe：
  - API client 新增：
    - `maintainProjectKnowledgeSourceBatch()`
    - `searchProjectKnowledgeChunks()`
    - [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - source detail 现在用后端 batch 接口执行 `Re-index linked / Reset linked / Remove linked`
    - 并新增 `Replace linked` modal
    - [apps/web/src/components/workspace-knowledge-source-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-source-detail.tsx)
    - [apps/web/src/components/workspace-knowledge-source-batch-replace-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-source-batch-replace-modal.tsx)
  - chunk detail 已新增 `Retrieval probe` 面板并展示排名命中
    - [apps/web/src/components/workspace-knowledge-chunk-detail.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-chunk-detail.tsx)
- `done`：新增 [docs/57-openport-settings-data-controls-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/57-openport-settings-data-controls-parity-plan.md)，继续参考本地 `open-webui-main` 的 `SettingsModal.svelte / Settings/DataControls.svelte`，把 `Settings > Data` 从只读入口补成完整的数据控制面板。
- `done`：这一轮 `settings/data controls parity` 已完成：
  - 共享 contract 已新增：
    - `OpenPortChatSessionsExportResponse`
    - `OpenPortChatSessionsImportResponse`
    - [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)
  - API 已补真实 bulk chat data operations：
    - `GET /ai/sessions/export`
    - `POST /ai/sessions/import`
    - `POST /ai/sessions/archive-all`
    - `DELETE /ai/sessions`
    - `DELETE /ai/sessions/:id`
    - [apps/api/src/ai/ai.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/ai.controller.ts)
    - [apps/api/src/ai/ai.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/ai.service.ts)
    - [apps/api/src/ai/dto/import-chat-sessions.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/dto/import-chat-sessions.dto.ts)
  - import 已支持把导出的 chat JSON 重新归一化并持久化到当前用户：
    - 保留 messages / settings / archive / pin / tags
    - duplicate ids 会自动 remap
  - Web API 已补对应调用：
    - `exportChatSessions`
    - `importChatSessions`
    - `archiveAllChatSessions`
    - `deleteAllChatSessions`
    - `deleteChatSession`
    - [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - `ChatSettingsModal` 的 `Data` tab 现在已接成完整数据控制区：
    - active / archived counts
    - import chats
    - export chats
    - archived chats entry
    - archive all chats
    - delete all chats
    - workspace files entry
    - raw session feed entry
    - [apps/web/src/components/chat-settings-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-settings-modal.tsx)
  - 样式已补在：
    - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
- `done`：这轮 `settings/data controls parity` 构建验证已通过：
  - `npm run build:api`
  - `npm run build:web`
- `done`：这轮 `settings/data controls parity` 运行态验收已通过：
  - `npm run compose:up`
  - `GET /api/ai/sessions/export`
  - `DELETE /api/ai/sessions`
  - `POST /api/ai/sessions/import`
  - `POST /api/ai/sessions/archive-all`
  - 最后已按导出文件恢复 demo chat 状态，当前 Docker `web / api / reference / postgres` 全部 `healthy`
- `done`：新增 [docs/58-openport-search-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/58-openport-search-parity-plan.md)，继续参考本地 `open-webui-main` 的 `SearchModal.svelte / Sidebar/SearchInput.svelte`，把 workspace 搜索从 chat/note finder 升级成统一的 command-palette 风格搜索面板。
- `done`：这一轮 `search parity` 已完成首版统一搜索实现：
  - `workspace-search.ts` 已扩展本地搜索语义：
    - 新增 `WorkspaceSearchResultType`
    - `type:model / prompt / tool / skill / knowledge / action`
    - `>` command mode
    - recommendations 现在也会覆盖 models / knowledge / prompts / tools / skills
    - [apps/web/src/lib/workspace-search.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/workspace-search.ts)
  - `WorkspaceSearchModal` 已重构成统一命令面板：
    - 保留 server-backed chat/note 搜索
    - 新增 client-aggregated `models / prompts / tools / skills / knowledge`
    - 新增 action catalog
    - 新增 action / resource / recent / recommendation 统一预览区
    - [apps/web/src/components/workspace-search-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-search-modal.tsx)
  - `WorkspaceSearchInput` placeholder 和搜索语义已同步扩展：
    - [apps/web/src/components/workspace-search-input.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-search-input.tsx)
  - 搜索 modal 样式已同步补齐：
    - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
- `done`：新增 [docs/67-openport-chat-ui-final-alignment-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/67-openport-chat-ui-final-alignment-plan.md)，继续参考本地 `open-webui-main` 的 `Sidebar.svelte / ChatPlaceholder.svelte / Controls.svelte / SettingsModal.svelte`，把 chat-first 主界面的剩余 UI 差异继续收口。
- `done`：这一轮 `chat ui final alignment` 已完成：
  - sidebar 已继续压轻：
    - 去掉独立 CTA 式 `New chat` 区块，改为 utility-nav 节奏
    - 弱化 `Projects` 管理感和底部 workspace/account 区域
    - [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
    - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - `/chat` 空态已继续对齐：
    - 空态改成更纯的 model mark + centered composer + suggestions
    - project 信息降级为轻量 context hint
    - active thread 顶部 summary strip 已移除
    - [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - `Controls` 已从表单感继续收回到 chat options panel：
    - 新增轻量 `Session options`
    - `Project` / `Tags` 从 `Valves` 移入 `Context`
    - `Valves` 只保留 model/operator/function 级别控制
    - [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - `Settings` 和 composer tools 已继续向 Open WebUI 结构靠拢：
    - settings nav 新增图标
    - 新增 `Connections` / `Integrations` tabs
    - composer tools 新增 include-context heading / submenu heading / per-surface counts
    - [apps/web/src/components/chat-settings-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-settings-modal.tsx)
    - [apps/web/src/components/chat-composer-tools-menu.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-composer-tools-menu.tsx)
- `done`：这轮 `chat ui final alignment` 构建验证已通过：
  - `npm run build:web`
- `done`：新增 [docs/68-openport-folders-files-data-controls-final-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/68-openport-folders-files-data-controls-final-plan.md)，继续参考本地 `open-webui-main` 的 `folders.py / files.py / Sidebar.svelte / FilesModal.svelte / InputMenu.svelte / AttachWebpageModal.svelte / SettingsModal.svelte / DataControls.svelte`，把剩余的 folder-like project meta、chat files/webpage 全流、以及 data controls 里的 files surface 一次收口。
- `done`：这一轮 `folders/files/data-controls final` 已完成：
  - 共享 contract 已扩展：
    - `OpenPortChatAttachment`
    - `OpenPortChatMessage.attachments`
    - `OpenPortProjectMeta.description`
    - `OpenPortProjectMeta.icon`
    - `OpenPortProjectMeta.color`
    - `OpenPortProjectMeta.hiddenInSidebar`
    - `OpenPortProjectAsset.ownerUserId`
    - `OpenPortProjectAsset.sourceUrl`
    - `OpenPortProjectAsset.previewText`
    - [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)
  - API persistence 已补齐：
    - state store normalization 已支持 attachments / richer project meta / richer project assets
    - postgres `openport_project_assets` 已写入 `owner_user_id / source_url / preview_text`
    - [apps/api/src/storage/api-state-store.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/storage/api-state-store.service.ts)
  - project DTO 和 service 已补 richer folder-like meta：
    - `description / icon / color / hiddenInSidebar`
    - [apps/api/src/projects/dto/create-project.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/create-project.dto.ts)
    - [apps/api/src/projects/dto/update-project.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/dto/update-project.dto.ts)
    - [apps/api/src/projects/projects.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.service.ts)
  - project assets 已补 application-level files/web support：
    - `GET /projects/assets`
    - `DELETE /projects/assets/:assetId`
    - `POST /projects/assets/web`
    - [apps/api/src/projects/projects.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/projects.controller.ts)
    - [apps/api/src/projects/project-assets.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/projects/project-assets.service.ts)
  - chat message API 已支持 structured attachments：
    - [apps/api/src/ai/dto/post-message.dto.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/dto/post-message.dto.ts)
    - [apps/api/src/ai/ai.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/ai/ai.service.ts)
  - Web API client 已补：
    - `fetchProjectAssets`
    - `deleteProjectAsset`
    - `createProjectWebAsset`
    - `postChatMessage(...attachments)`
    - [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - chat settings 的 `Files` 已改成 dedicated modal，而不是跳 workspace：
    - [apps/web/src/components/chat-files-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-files-modal.tsx)
    - [apps/web/src/components/chat-settings-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-settings-modal.tsx)
  - composer tools 已补完整 file/web attach flow：
    - 上传 file asset
    - attach existing file/webpage asset
    - fetch webpage snapshot
    - [apps/web/src/components/chat-composer-tools-menu.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-composer-tools-menu.tsx)
  - chat messages 已渲染 attachment chips，project sidebar 已使用 icon/color/hidden metadata：
    - [apps/web/src/components/ui/message-bubble.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/ui/message-bubble.tsx)
    - [apps/web/src/components/project-tree-item.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-tree-item.tsx)
    - [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
    - [apps/web/src/components/project-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/project-modal.tsx)
- `done`：这轮 `folders/files/data-controls final` 构建验证已通过：
  - `npm run build:api`
  - `npm run build:web`
- `done`：这轮 `folders/files/data-controls final` 运行态验收已通过：
  - `npm run compose:up`
  - `docker compose -f compose/docker-compose.yml ps`
  - 当前 Docker `web / api / reference / postgres` 全部 `healthy`
- `done`：新增 [docs/70-openport-openwebui-ui-final-closure-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/70-openport-openwebui-ui-final-closure-plan.md)，继续参考本地 `open-webui-main` 的 `(app)/+page.svelte / Sidebar.svelte / ChatPlaceholder.svelte / Controls.svelte / SettingsModal.svelte / InputMenu.svelte`，把匿名根页、侧栏、chat home、controls、settings/tools 的最后一轮 UI 收口一次完成。
- `done`：这一轮 `openwebui ui final closure` 已完成：
  - 匿名根页已进一步收轻成 auth-first entry shell，不再保留 landing-style 视觉重量：
    - [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
    - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - sidebar 继续压轻：
    - 缩小 wordmark、utility 行高、section gap、footer/account 密度
    - `Projects / Chats / Pinned Models` 进一步变成组织层而不是管理区块
    - [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
    - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - `/chat` 空态继续纯化：
    - hero 模型选择器进一步放大居中
    - topbar/account menu 密度压缩
    - hero composer 和 suggestions 比例更接近 Open WebUI
    - [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
    - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - `Controls` 继续去表单化：
    - panel 间距、字段间距、文件行和 intro 动作进一步收紧
    - [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
    - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - `Settings` 和 composer tools 继续向 Open WebUI 的交互密度靠拢：
    - settings nav / panel / toggle field 全部收紧
    - tools menu 宽度和层级进一步调整
    - [apps/web/src/components/chat-settings-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-settings-modal.tsx)
    - [apps/web/src/components/chat-composer-tools-menu.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-composer-tools-menu.tsx)
    - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)

- `done`：新增 [docs/71-openport-connectors-orchestration-final-closure-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/71-openport-connectors-orchestration-final-closure-plan.md)，一次性补齐 `external connectors lifecycle + toolkit orchestration runtime`。
- `done`：这轮 connectors + orchestration 已完成后端闭环：
  - contracts 扩展了 connectors / connector tasks+audit / tool orchestration runs：
    - [packages/openport-product-contracts/src/index.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/packages/openport-product-contracts/src/index.ts)
  - `WorkspaceResources` 新增 API：
    - connectors credentials CRUD
    - connectors CRUD
    - sync trigger / task list / task retry / audit list
    - tool orchestration run / list / detail / replay / cancel
    - [apps/api/src/workspace-resources/workspace-resources.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/workspace-resources/workspace-resources.controller.ts)
    - [apps/api/src/workspace-resources/workspace-resources.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/workspace-resources/workspace-resources.service.ts)
  - state store 已新增 file+postgres 持久化：
    - connectors / credentials / tasks / audits / tool runs
    - scheduler 和 run queue 所需 workspace index 读取
    - [apps/api/src/storage/api-state-store.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/storage/api-state-store.service.ts)
  - 新增 DTO：
    - `create/update-workspace-connector*.dto.ts`
    - `trigger-workspace-connector-sync.dto.ts`
    - `run/replay-workspace-tool-orchestration*.dto.ts`
    - [apps/api/src/workspace-resources/dto](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/api/src/workspace-resources/dto)
- `done`：这轮 connectors + orchestration 已完成前端接入：
  - API client wrappers：
    - [apps/web/src/lib/openport-api.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/lib/openport-api.ts)
  - 新增 `Knowledge > Connectors` 页面：
    - credentials 管理
    - connector 管理
    - manual/incremental sync
    - task + audit 面板
    - [apps/web/src/components/workspace-knowledge-connectors.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge-connectors.tsx)
    - [apps/web/src/app/workspace/knowledge/connectors/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/workspace/knowledge/connectors/page.tsx)
  - `WorkspaceToolEditor` 已新增 runtime orchestration control panel：
    - run/replay/cancel
    - step status + branch path 视图
    - [apps/web/src/components/workspace-tool-editor.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-tool-editor.tsx)
  - `Knowledge` 主页导航补了 connectors 入口：
    - [apps/web/src/components/workspace-knowledge.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-knowledge.tsx)
- `done`：这轮构建验证已通过：
  - `npm run build:api`
  - `npm run build:web`
- `done`：新增 [docs/73-openport-openwebui-auth-shell-final-closure-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/73-openport-openwebui-auth-shell-final-closure-plan.md)，按本地 `open-webui-main` 的 `+page.svelte / Sidebar.svelte / ChatPlaceholder.svelte / Controls.svelte / SettingsModal.svelte / InputMenu.svelte`，一次性补齐匿名入口、canonical `/chat`、sidebar 轻量化、chat 空态纯化、controls 去表单化、settings/tools IA 收口。
- `done`：这轮 `openwebui auth shell final closure` 已完成：
  - 匿名根页已改成更轻的 auth-first shell：
    - [apps/web/src/app/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/page.tsx)
    - [apps/web/src/app/globals.css](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/globals.css)
  - `/chat` 已成为真实主聊天页，已登录 `/` 只做 hand-off，`/dashboard/chat` 继续兼容跳转：
    - [apps/web/src/app/chat/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/chat/page.tsx)
    - [apps/web/src/components/home-entry-gate.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/home-entry-gate.tsx)
    - [apps/web/src/app/dashboard/chat/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/app/dashboard/chat/page.tsx)
    - [apps/web/src/components/landing-entry-actions.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/landing-entry-actions.tsx)
  - sidebar 已继续压轻并让 `Chats` 高于 `Projects`：
    - 去掉 sidebar workspace switcher
    - `Projects` 移到 `Chats` 之后，create action 改成更轻的 section action
    - chat root links 全部改为 `/chat`
    - [apps/web/src/components/workspace-sidebar.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/workspace-sidebar.tsx)
  - chat 空态进一步收成更纯的 model + composer + suggestions：
    - hero 模型选择器整合了 avatar mark / title / subtitle
    - project hint 改成更轻的 inline context
    - [apps/web/src/components/chat-shell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-shell.tsx)
  - controls 已继续去表单化：
    - `Model route` 呈现改成 `Model`
    - `Context` 只在存在上下文时显示
    - copy 改成更轻的 conversation/options 语义
    - [apps/web/src/components/chat-controls-panel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-controls-panel.tsx)
  - settings 和 composer tools 的 IA 已进一步向 Open WebUI 收敛：
    - settings 去掉单独 `Workspace` tab，`Integrations` 吞并 workspace 导航
    - data/archive/chat home links 全部改成 `/chat`
    - tools root menu 改成 `upload / capture / webpage / notes / knowledge / chats / prompts / recent files`
    - [apps/web/src/components/chat-settings-modal.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-settings-modal.tsx)
    - [apps/web/src/components/chat-composer-tools-menu.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/apps/web/src/components/chat-composer-tools-menu.tsx)
- `done`：这轮构建验证已通过：
  - `npm run build:web`
