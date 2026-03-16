# OpenPort Workspace 深度对齐方案

## 目标

继续沿着本地 `open-webui-main` 的 `Workspace` 架构推进，把 OpenPort 当前已经完成 CRUD 的四个 Workspace 子模块升级到更接近 Open WebUI 的产品层级：

- `Models` 增加 `filters / capabilities / knowledge selector`
- `Knowledge` 增加 `collection` 级组织与内容增量导入
- `Prompts` 增加版本历史与回滚
- `Tools` 增加更完整的 `manifest / valves` 编辑体验

本轮不追求逐文件复制 Open WebUI，而是优先复用它的模块划分、元数据结构和编辑器心智，快速把 OpenPort 的 Workspace 从 CRUD 页推进到可持续演进的资源模块。

## 对齐依据

本轮优先参考本地 `open-webui-main` 的这些实现：

- `src/lib/components/workspace/Models/ModelEditor.svelte`
- `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `src/lib/components/workspace/Prompts/PromptEditor.svelte`
- `src/lib/components/workspace/Tools/ToolkitEditor.svelte`

重点借鉴的不是 UI 细节，而是数据结构与页面职责：

- `Models` 不是只有 route/provider，而是带 `knowledge / tools / filters / capabilities`
- `Knowledge` 不是单个文件列表，而是 collection + 内容维护
- `Prompts` 不是单版本记录，而是带历史快照
- `Tools` 不是只有 manifest textarea，而是 manifest + valves/参数

## OpenPort 设计约束

### 1. 保持现有命名

继续使用：

- `Workspace`
- `Models`
- `Knowledge`
- `Prompts`
- `Tools`
- `Projects`

不引入 `Folders`、`Skills`、`Actions` 等第二套术语。

### 2. 优先扩展现有 API，而不是再起一套新模块

本轮在现有模块上递增：

- `apps/api/src/workspace-resources`
- `apps/api/src/projects`
- `apps/web/src/components/workspace-*`

### 3. 持久化继续沿用当前双后端模式

- 本机直跑：file-backed state
- Docker / 产品路径：postgres-backed state

新字段、新版本历史、新 collection 元数据都写入 `ApiStateStoreService`。

## 数据模型扩展

### Models

在 `OpenPortWorkspaceModel` 上新增：

- `filterIds: string[]`
- `capabilities: OpenPortWorkspaceModelCapabilities`

其中 `capabilities` 至少覆盖：

- `vision: boolean`
- `webSearch: boolean`
- `imageGeneration: boolean`
- `codeInterpreter: boolean`

### Knowledge

在 `OpenPortProjectKnowledgeItem` 上新增：

- `collectionId: string | null`
- `collectionName: string`
- `contentText: string`
- `source: 'upload' | 'text' | 'append'`

新增 collection 视图结构：

- `OpenPortKnowledgeCollection`
  - `id`
  - `workspaceId`
  - `name`
  - `description`
  - `itemCount`
  - `updatedAt`

本轮 collection 仍然由 knowledge item 元数据推导，不单独建复杂关系表。

### Prompts

在 `OpenPortWorkspacePrompt` 之外新增：

- `OpenPortWorkspacePromptVersion`
  - `id`
  - `promptId`
  - `workspaceId`
  - `title`
  - `command`
  - `description`
  - `content`
  - `tags`
  - `savedAt`
  - `versionLabel`

每次创建或更新 prompt 时都自动生成一个历史快照。

### Tools

在 `OpenPortWorkspaceTool` 上新增：

- `valves: Record<string, string>`

本轮 `valves` 先按 key/value 持久化，不做复杂 schema 解释器。

## API 实施步骤

### Step 1. 扩展共享产品契约

更新 `packages/openport-product-contracts/src/index.ts`：

- 模型 capabilities 类型
- knowledge collection 类型
- prompt version 类型
- tool valves 字段

### Step 2. 扩展 state store

更新 `apps/api/src/storage/api-state-store.service.ts`：

- knowledge item 新字段
- workspace model 新字段
- workspace prompt version 存储
- workspace tool valves 字段

并在 postgres 路径补齐对应表结构与列：

- `openport_workspace_prompt_versions`
- 为 models / tools / knowledge 表补 JSON/文本列

### Step 3. 扩展 WorkspaceResourcesService

新增：

- `GET /workspace/prompts/:id/versions`
- `POST /workspace/prompts/:id/versions/:versionId/restore`

增强：

- model create/update 支持 `filterIds / capabilities`
- tool create/update 支持 `valves`

### Step 4. 扩展 ProjectsService 的 Knowledge 能力

新增：

- `POST /projects/knowledge/text`
  - 创建 text-based knowledge item
- `POST /projects/knowledge/:id/append`
  - 向现有 knowledge item 增量追加内容
- `GET /projects/knowledge/collections`
  - 返回 collection 汇总

并在追加内容后重建：

- `previewText`
- `chunkCount`
- sparse/dense retrieval chunks

## 前端实施步骤

### Step 5. Models 编辑器升级

参考 `ModelEditor.svelte`，在 `workspace-model-editor.tsx` 中补：

- filters 文本 chips
- capabilities toggle grid
- knowledge selector 保留
- tools selector 保留

列表页补：

- provider/status filters
- capability chips

### Step 6. Knowledge 升级

参考 `KnowledgeBase.svelte`：

- `workspace-knowledge.tsx`
  - 新增 collection 分组
- `workspace-knowledge-create.tsx`
  - 支持：
    - 文件上传
    - 纯文本录入
    - 选择/创建 collection
- `workspace-knowledge-detail.tsx`
  - 展示 collection
  - 支持 append text
  - 展示全文或更大 preview

### Step 7. Prompts 升级

参考 `PromptEditor.svelte`：

- `workspace-prompt-editor.tsx`
  - 右侧或底部加版本历史列表
  - 支持 restore 旧版本
  - 支持显示当前版本时间

### Step 8. Tools 升级

参考 `ToolkitEditor.svelte`：

- `workspace-tool-editor.tsx`
  - manifest 编辑区
  - valves key/value 编辑区
  - integration 绑定保留
  - scopes 保留

列表页补：

- valves 数量与 manifest 状态摘要

## 验收标准

完成后应满足：

- `Models` 可编辑 `filters / capabilities / knowledge / tools`
- `Knowledge` 可按 collection 浏览
- `Knowledge` 可创建 text item 并对既有 item 追加内容
- `Prompts` 可查看版本历史并恢复旧版本
- `Tools` 可编辑 manifest 与 valves
- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`

## 本轮边界

本轮仍不强行实现：

- Open WebUI 的完整 access control matrix
- skills / actions / builtin tools 全量体系
- knowledge 的外部网页抓取与高级 ingestion pipeline
- tool marketplace / remote registry

这些保留到下一阶段。
