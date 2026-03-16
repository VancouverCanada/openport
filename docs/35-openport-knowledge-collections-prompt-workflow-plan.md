# OpenPort Knowledge Collections 与 Prompt Workflow 对齐方案

## 目标

在已完成 Workspace 资源 CRUD、prompt 生产版本、tool schema、model 默认策略的基础上，继续向 Open WebUI 的更完整工作区产品态推进：

- `Knowledge`：把 collections 从“由 items 推导”升级成真正资源，支持创建、编辑、删除、迁移
- `Prompts`：补齐 version workflow，包括删除版本和 production version 保护

本轮优先参考本地 `open-webui-main`：

- `backend/open_webui/models/knowledge.py`
- `backend/open_webui/routers/knowledge.py`
- `src/lib/components/workspace/Knowledge/CreateKnowledgeBase.svelte`
- `src/lib/components/workspace/Prompts/PromptHistoryMenu.svelte`

## 设计原则

### 1. 继续复用现有 OpenPort 模型

不引入第二套资源系统，继续基于：

- `projects/knowledge`
- `OpenPortKnowledgeCollection`
- `OpenPortProjectKnowledgeItem`
- `OpenPortWorkspacePromptVersion`

### 2. 让 collection 成为一等资源

当前 collection 是从 knowledge item 反推出来的，这无法支持：

- 创建空 collection
- 重命名 collection
- 保留 collection 描述
- 删除 collection 并迁移 item

本轮改为真正持久化 collection。

### 3. Prompt version workflow 参考 Open WebUI 的保护逻辑

参考 `PromptHistoryMenu.svelte`：

- 允许删除历史版本
- 禁止删除当前 production version
- 在 UI 上给出明确禁用/错误反馈

## 具体实施

### Step 1. Knowledge collections 持久化

- 在 state store 中新增 `knowledgeCollectionsByWorkspace`
- Postgres 新增 `openport_project_knowledge_collections`
- `listKnowledgeCollections()` 改为：
  - 读取持久化 collection
  - 合并 itemCount / updatedAt
  - 保留空 collection

### Step 2. Knowledge collections CRUD API

新增：

- `POST /projects/knowledge/collections`
- `PATCH /projects/knowledge/collections/:collectionId`
- `DELETE /projects/knowledge/collections/:collectionId`
- `PATCH /projects/knowledge/:itemId/collection`

删除 collection 时：

- 默认把 items 迁回 `General`
- 可选指定 `targetCollectionId`

### Step 3. Workspace Knowledge 页面改为 collection-first 管理

- `Knowledge` 列表页增加 `New collection`
- 新增：
  - `/workspace/knowledge/collections/create`
  - `/workspace/knowledge/collections/[id]/edit`
- `Knowledge create` 页改为优先选择已有 collection，而不是只填自由文本
- `Knowledge detail` 页支持把 item 移动到其它 collection
- `Collection detail` 页补：
  - edit
  - delete
  - item count / attached projects 之外的真实管理操作

### Step 4. Prompt version 删除与保护

新增：

- `DELETE /workspace/prompts/:id/versions/:versionId`

规则：

- 如果 `versionId === prompt.productionVersionId`，拒绝删除
- 其它版本允许删除
- 前端历史列表显示：
  - production badge
  - delete button
  - production version delete disabled

## 验收标准

完成后应满足：

- 可以创建空 knowledge collection
- collection 可编辑名称和描述
- collection 可删除并迁移 items
- knowledge item 可移动到别的 collection
- prompt 非 production 历史版本可删除
- prompt production version 不可删除
- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`

## 本轮边界

本轮仍不实现：

- Open WebUI 那套 access grants UI
- knowledge collection 的远程抓取/批量 ingestion pipeline
- prompt branching / graph history

## 实施结果

本轮已完成，核心落地如下：

- `Knowledge collections` 已从 item 推导升级为后端持久化资源：
  - file/postgres 双后端新增 `knowledgeCollectionsByWorkspace`
  - Postgres 新增 `openport_project_knowledge_collections`
  - `General` collection 保留为默认集合
- 已新增并接通：
  - `POST /projects/knowledge/collections`
  - `PATCH /projects/knowledge/collections/:collectionId`
  - `DELETE /projects/knowledge/collections/:collectionId`
  - `PATCH /projects/knowledge/:itemId/collection`
- `Workspace > Knowledge` 已补：
  - `New collection`
  - `/workspace/knowledge/collections/create`
  - `/workspace/knowledge/collections/[id]/edit`
  - knowledge item 详情页的 collection move
  - collection detail 页的 edit / delete
- `Prompts` 已补版本删除：
  - 新增 `DELETE /workspace/prompts/:id/versions/:versionId`
  - 非 production version 可删除
  - production version 删除会返回 `400 Cannot delete the production version`
  - 编辑器历史列表已补 `Delete version`

## 验收结果

已执行：

- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`

并已在 `compose-api-1` 容器内完成真实 API 验收：

- 创建 collection：`201`
- 更新 collection：`200`
- 创建 knowledge text 并绑定 collection：`201`
- 移动 knowledge item 到 `General`：`200`
- 删除 collection 并迁移 items：`200`
- 创建 prompt 并生成 production version：`201`
- 新增第二个 prompt version：`200`
- 删除非 production version：`200`
- 删除 production version：`400`

当前 Docker `web/api/reference/postgres` 四个容器均为 `healthy`。
