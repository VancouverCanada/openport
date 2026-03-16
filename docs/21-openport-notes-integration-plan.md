# OpenPort Notes Integration Plan

本文件定义 `Open WebUI Notes` 在 `openport` 中的完整整合方案。目标不是逐文件复制原始实现，而是把其产品能力按 `OpenPort` 现有的 `auth / workspace / rbac / api + web` 结构重建为可维护能力。

## 1. 目标

- 将当前前端本地 `Notes` 原型切换为真实的产品级模块。
- 让 `Notes` 与 `OpenPort` 现有认证、工作区与权限模型自然整合。
- 提供：
  - note CRUD
  - note 搜索与分组
  - note 版本恢复
  - note 共享访问
  - note 协作状态
  - note assistant 辅助动作
- 保持后续可扩展到：
  - 真正的多成员共享
  - 实时协作
  - note 与 chat 的联动

## 2. 对齐原则

### 2.1 参考 Open WebUI 的部分

- `Notes` 作为独立工作区页面存在，而不是侧栏内联输入块。
- note 详情页包含：
  - 主编辑区
  - 右侧 metadata / actions / versions / assistant 面板
- note 支持搜索、版本、辅助动作与协作态。

### 2.2 不直接复制的部分

- 不照搬 Open WebUI 的 Svelte 组件结构。
- 不照搬其资源命名或内部实现细节。
- 不直接迁其实时协作协议与服务端结构。

## 3. OpenPort 目标架构

### 3.1 后端资源模型

`Note` 作为 `workspace-scoped resource`。

核心字段：

- `id`
- `workspaceId`
- `ownerUserId`
- `title`
- `contentMd`
- `excerpt`
- `pinned`
- `archived`
- `tags`
- `createdAt`
- `updatedAt`
- `accessGrants`
- `versions`
- `assistantMessages`

### 3.2 权限模型

权限定义：

- `read`
- `write`
- `admin`

主体类型：

- `user`
- `workspace`
- `public`

判定规则：

- owner 默认 `admin`
- workspace grant 作为默认共享边界
- user grant 允许细粒度共享
- public grant 仅作为后续扩展保留

### 3.3 协作模型

分两阶段：

Phase A:

- heartbeat presence
- viewing / editing 状态
- 活跃成员面板
- last-writer-wins 保存策略

Phase B:

- websocket / CRDT 协作
- 实时多人编辑
- conflict resolution

## 4. 前端整合方式

### 4.1 页面

- `/dashboard/notes`
- `/dashboard/notes/new`
- `/dashboard/notes/[id]`

### 4.2 UI 结构

- list 页面：
  - 搜索框
  - 分组列表
  - 新建入口
- detail 页面：
  - 标题与保存状态
  - markdown/plain text 编辑区
  - preview 模式
  - 右侧详情面板
  - 共享与协作信息
  - assistant 面板
  - versions 列表

### 4.3 数据流

- 前端不再使用 `localStorage` 作为主数据源。
- 前端通过 `apps/web/src/lib/openport-api.ts` 调用 `apps/api`。
- 仍保留前端事件广播，用于：
  - 列表刷新
  - 搜索索引同步
  - 详情页联动刷新

## 5. API 设计

目标路由：

- `GET /notes`
- `POST /notes`
- `GET /notes/:id`
- `PATCH /notes/:id`
- `DELETE /notes/:id`
- `POST /notes/:id/duplicate`
- `POST /notes/:id/restore-version`
- `GET /notes/:id/access-grants`
- `POST /notes/:id/access-grants`
- `DELETE /notes/:id/access-grants/:grantId`
- `POST /notes/:id/assistant`
- `GET /notes/:id/collaboration`
- `POST /notes/:id/collaboration/heartbeat`

## 6. 分阶段实施

### Phase 1

- 建立 notes 合同类型
- 新增 `apps/api` notes 模块
- 接入 workspace / auth 基础边界

### Phase 2

- `apps/web` notes 页面切换到真实 API
- 保留现有 UI，替换本地存储逻辑
- 搜索页与 workspace search 接入 notes API

### Phase 3

- 补共享权限 UI
- 补协作 presence UI
- 将 assistant 接到真实 notes API

### Phase 4

- websocket 协作层
- note 与 chat 联动
- 更接近 Open WebUI 的 editor actions

## 7. 本轮实施范围

本轮目标：

- 文档化完整方案
- 完成 `apps/api` notes 模块接入
- 完成 `apps/web` notes 从 local storage 到真实 API 的切换
- 提供共享、版本、assistant、presence 的第一版完整闭环

不在本轮完成：

- websocket 实时协作
- 多人同时编辑冲突解决
- 外部公开分享链接

## 8. 验收标准

- `Notes` 页面可创建、读取、更新、删除 note
- `Notes` 详情可自动保存并恢复版本
- `Assistant` 面板通过 notes API 返回结果
- `Workspace Search` 可搜到 notes
- `Notes` 页面在 Docker 产品栈下可正常运行
- `npm run build:web` 通过
- `docker compose -f compose/docker-compose.yml up -d --build` 后容器健康

## 9. 当前状态

- 方案文档：done
- API notes 模块：in_progress
- 前端 notes API 化：in_progress
- 权限与共享骨架：in_progress
- presence 协作骨架：in_progress
- websocket 实时协作：todo
