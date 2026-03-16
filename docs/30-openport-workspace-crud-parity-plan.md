# OpenPort Workspace CRUD 对齐方案

## 目标

继续沿着本地 `open-webui-main` 的 `Workspace` 架构推进，把 OpenPort 当前的四个 Workspace 子页从“真实列表页”升级到“真实资源模块”：

- `Models` 做成真正的模型管理
- `Knowledge` 做成上传与详情页
- `Prompts` 做成 prompt editor
- `Tools` 做成工具 / 连接编辑器

本轮目标不是照搬 Open WebUI 的全部细节，而是优先复用它的模块划分、路由结构和编辑器心智，快速把 OpenPort 从 workspace overview/list 形态推进到可用的 CRUD 形态。

## 对齐依据

本轮优先参考本地 `open-webui-main` 这些路径：

- `src/routes/(app)/workspace/models/+page.svelte`
- `src/routes/(app)/workspace/models/create/+page.svelte`
- `src/routes/(app)/workspace/prompts/+page.svelte`
- `src/routes/(app)/workspace/prompts/create/+page.svelte`
- `src/routes/(app)/workspace/prompts/[id]/+page.svelte`
- `src/routes/(app)/workspace/tools/+page.svelte`
- `src/routes/(app)/workspace/tools/create/+page.svelte`
- `src/routes/(app)/workspace/knowledge/+page.svelte`
- `src/routes/(app)/workspace/knowledge/create/+page.svelte`
- `src/routes/(app)/workspace/knowledge/[id]/+page.svelte`
- `src/lib/components/workspace/Models.svelte`
- `src/lib/components/workspace/Knowledge.svelte`
- `src/lib/components/workspace/Prompts.svelte`
- `src/lib/components/workspace/Tools.svelte`
- `src/lib/components/workspace/Models/ModelEditor.svelte`
- `src/lib/components/workspace/Prompts/PromptEditor.svelte`
- `src/lib/components/workspace/Tools/ToolkitEditor.svelte`
- `src/lib/components/workspace/Knowledge/CreateKnowledgeBase.svelte`
- `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`

本轮参考重点：

- `Workspace` 子页应该有单独的 create / detail / edit 流
- `Knowledge` 不是一组标签，而是一个可进入的知识条目
- `Prompts` 与 `Tools` 需要自己的编辑器，而不是只读列表
- `Models` 是 workspace 内部可管理资源，不只是会话里读出来的 route

## OpenPort 实施原则

### 1. 优先沿用 Open WebUI 的路由结构

新增或落地这些路径：

- `/workspace/models`
- `/workspace/models/create`
- `/workspace/models/[id]`
- `/workspace/knowledge`
- `/workspace/knowledge/create`
- `/workspace/knowledge/[id]`
- `/workspace/prompts`
- `/workspace/prompts/create`
- `/workspace/prompts/[id]`
- `/workspace/tools`
- `/workspace/tools/create`
- `/workspace/tools/[id]`

### 2. 优先复用现有 OpenPort 存储架构

后端不新开第三套 persistence framework，而是延续当前已经用于 `chat / projects / knowledge` 的双后端模式：

- 本机直跑：`file-backed state`
- Docker / 产品路径：`postgres-backed state`

因此本轮新增的 `models / prompts / tools` 会直接接入 `ApiStateStoreService`。

### 3. 保持 Workspace 命名，不新增第二套术语

继续保留：

- `Workspace`
- `Models`
- `Knowledge`
- `Prompts`
- `Tools`

不再额外引入新的产品名词。

### 4. Knowledge 本轮做上传 + 详情，不硬做复杂知识库流程

Open WebUI 的 `Knowledge` 比当前 OpenPort 更完整。本轮只对齐到：

- 上传
- 列表
- 详情
- 关联项目预览
- 原始内容预览 / 索引状态展示

不强行扩展成复杂知识库管线。

## 数据模型

### Workspace Model

- `id`
- `workspaceId`
- `name`
- `route`
- `provider`
- `description`
- `tags`
- `status`
- `isDefault`
- `knowledgeItemIds`
- `toolIds`
- `createdAt`
- `updatedAt`

### Workspace Prompt

- `id`
- `workspaceId`
- `title`
- `command`
- `description`
- `content`
- `tags`
- `createdAt`
- `updatedAt`

### Workspace Tool

- `id`
- `workspaceId`
- `name`
- `description`
- `integrationId`
- `enabled`
- `scopes`
- `manifest`
- `createdAt`
- `updatedAt`

## 具体实施步骤

### Step 1. 扩展产品契约

在 `packages/openport-product-contracts` 中新增：

- `OpenPortWorkspaceModel`
- `OpenPortWorkspacePrompt`
- `OpenPortWorkspaceTool`
- 对应的 response/list response

### Step 2. 扩展 API 持久化层

在 `ApiStateStoreService` 中新增：

- `workspaceModelsByWorkspace`
- `workspacePromptsByWorkspace`
- `workspaceToolsByWorkspace`

并为 Postgres 增加表：

- `openport_workspace_models`
- `openport_workspace_prompts`
- `openport_workspace_tools`

### Step 3. 新增 Workspace 资源模块

新增 `apps/api/src/workspace-resources`：

- `workspace-resources.module.ts`
- `workspace-resources.controller.ts`
- `workspace-resources.service.ts`
- 对应 DTO

提供 CRUD 接口：

- `/workspace/models`
- `/workspace/prompts`
- `/workspace/tools`

### Step 4. 为 Knowledge 增补 detail/delete

在 `ProjectsService / ProjectsController` 中补齐：

- `GET /projects/knowledge/:id`
- `DELETE /projects/knowledge/:id`

### Step 5. 前端 API client 扩展

在 `apps/web/src/lib/openport-api.ts` 中新增：

- models CRUD
- prompts CRUD
- tools CRUD
- knowledge detail / delete

### Step 6. 前端 Workspace 页面重构

保留现有 `/workspace/*` 列表页，但替换其内部实现：

- `Models`
  - 列表
  - create 入口
  - detail / edit 页
- `Knowledge`
  - 列表
  - upload 页
  - detail 页
- `Prompts`
  - 列表
  - create 页
  - editor 页
- `Tools`
  - 列表
  - create 页
  - editor 页

### Step 7. Open WebUI 风格对齐

本轮优先对齐这些结构：

- list page + create CTA
- editor/detail page 独立路由
- 轻量搜索 / filter / metadata
- 不把编辑器塞回 overview

## 验收标准

完成后应满足：

- `/workspace/models` 可列出持久化 models
- `/workspace/models/create` 可创建 model
- `/workspace/models/[id]` 可编辑 model
- `/workspace/knowledge/create` 可上传 knowledge
- `/workspace/knowledge/[id]` 可查看详情
- `/workspace/prompts/create` 可创建 prompt
- `/workspace/prompts/[id]` 可编辑 prompt
- `/workspace/tools/create` 可创建 tool
- `/workspace/tools/[id]` 可编辑 tool
- `npm run build:web`
- `npm run build:api`
- `npm run compose:up`

## 本轮边界

本轮不强行补齐 Open WebUI 的这些能力：

- workspace access control matrix
- community share/import
- prompt history/version tree
- tool marketplace
- advanced knowledge collection orchestration

这些仍然可以在后续阶段继续补。
