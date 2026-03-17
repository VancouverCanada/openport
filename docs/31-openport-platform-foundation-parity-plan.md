## OpenPort 平台基础设施对齐 Open WebUI 实施方案

本方案覆盖 `Projects` 在产品层基本对齐 `Open WebUI projects-layer` 后，仍然落后的四块平台基础设施：

1. 存储 provider
2. 向量/检索 provider
3. Projects 实时协同与多端同步
4. group/admin 级共享模型

目标不是机械复制 Open WebUI，而是在 `openport` 当前 `NestJS + Next.js + product-contracts + postgres|file state store` 架构里，优先复用/参考 Open WebUI 的实现思路，完成等价能力闭环。

### 参考基线

- Open WebUI storage provider：
  - `backend/open_webui/storage/provider.py`
- Open WebUI vector factory：
  - `backend/open_webui/retrieval/vector/factory.py`
- Open WebUI realtime/socket：
  - `backend/open_webui/socket/main.py`
- Open WebUI access control：
  - `src/lib/components/workspace/common/AccessControl.svelte`

### OpenPort 当前基线

- `Projects` 已具备：
  - API-backed tree
  - knowledge/files 挂载
  - import/export
  - background image
  - access grants
  - SSE invalidation
- 仍缺：
  - provider 化二进制存储
  - provider 化 dense retrieval
  - websocket 级 project collaboration
  - group principal 与 admin 共享

## 实施范围

### Phase A: Storage Provider

目标：

- 把 `ProjectAssetsService` 从直接文件系统写入提升为 provider 架构
- 保留当前本地文件 provider
- 增加第二种真实二进制后端，避免继续只依赖 `metadata + local path`

实施：

- 新增 `ProjectAssetStorageProvider` 接口
- 新增：
  - `LocalProjectAssetStorageProvider`
  - `DatabaseProjectAssetStorageProvider`
- 通过 env 选择：
  - `OPENPORT_PROJECT_STORAGE_PROVIDER=local|database`
- 新增持久化表：
  - `openport_project_asset_blobs`

说明：

- 本阶段优先完成 provider abstraction 与真实二进制持久层
- 外部对象存储的接口形态对齐 Open WebUI，后端先在本仓库内落地 `local + database`

### Phase B: Retrieval Provider

目标：

- 把当前仅有的 sparse token ranking 提升为 provider 化 retrieval
- 引入 dense embedding + vector store 抽象
- 支持 hybrid ranking

实施：

- 新增：
  - `ProjectEmbeddingProvider`
  - `DeterministicEmbeddingProvider`
  - `ProjectVectorStoreProvider`
  - `PostgresProjectVectorStoreProvider`
  - `ProjectRetrievalService`
- 新增持久化表：
  - `openport_project_knowledge_dense_chunks`
- `uploadKnowledge()` 时写入 sparse chunks + dense chunks
- `searchKnowledge()` 切到 hybrid retrieval

说明：

- 架构参考 Open WebUI vector factory
- 当前仓库先使用本地 deterministic embedding，保证无需引入额外模型服务即可完成闭环

### Phase C: Realtime Collaboration

目标：

- 把 `Projects` 从 SSE invalidation 升级为 websocket 协同通道
- 对齐 Open WebUI 的 socket-first 实时架构

实施：

- 新增：
  - `ProjectsRealtimeService`
  - `ProjectsCollaborationGateway`
  - web 端 `project-realtime.ts`
- 支持：
  - project room join/leave
  - presence
  - project update broadcast
  - cross-tab / cross-client live refresh

说明：

- 当前重点是 project entity 级实时同步，不追求 Yjs 富文本复杂度
- Notes 已有协同通道，这里优先复用相同架构

### Phase D: Group/Admin Sharing

目标：

- 把 `Projects` principal 从 `user|workspace|public` 扩展到 `user|workspace|group|public`
- 增加 workspace groups API
- 在 project modal 中可管理 group grants

实施：

- product contracts 新增：
  - `OpenPortWorkspaceGroup`
  - 相关 response types
- API 新增：
  - `GroupsModule`
  - `GroupsController`
  - `GroupsService`
- state store 新增：
  - `openport_workspace_groups`
- `ProjectsService.resolvePermission()` 增加 group resolution
- Project modal 接入 group grants

## 验收标准

- `apps/api` 构建通过
- `apps/web` 构建通过
- Docker `compose:up` 通过
- `Projects` 资产上传在 `local|database` provider 下均可读回
- `Projects` knowledge search 返回 hybrid retrieval 结果
- 两个浏览器窗口对同一 project 的更新可实时同步
- project access grants 可给 `group`
- group grant 生效后，组内成员可读/写/管理对应 project

## 交付顺序

1. contracts + state store schema
2. storage provider
3. retrieval provider
4. realtime gateway/client
5. groups/admin sharing
6. build + docker verify

## 实施结果

状态：`done`

已落地模块：

- `Storage Provider`
  - 新增 `ProjectAssetStorageProvider` 抽象
  - 已实现：
    - `LocalProjectAssetStorageProvider`
    - `DatabaseProjectAssetStorageProvider`
  - 已接入：
    - `ProjectAssetsService`
    - `openport_project_asset_blobs`
- `Retrieval Provider`
  - 新增 `ProjectRetrievalService`
  - 已实现：
    - `DeterministicEmbeddingProvider`
    - `InProcessVectorStoreProvider`
    - hybrid sparse+dense ranking
  - 已接入：
    - `uploadKnowledge()`
    - `appendKnowledgeContent()`
    - `searchKnowledge()`
    - `openport_project_knowledge_dense_chunks`
- `Realtime Collaboration`
  - 新增：
    - `ProjectsCollaborationGateway`
    - web 端 `project-realtime.ts`
  - 已接入 `Chat` 页 project room / presence / project event refresh
- `Group/Admin Sharing`
  - 新增：
    - `GroupsModule`
    - `GroupsService`
    - `GroupsController`
    - `openport_workspace_groups`
  - `Projects` grant principal 已扩展为：
    - `user`
    - `workspace`
    - `group`
    - `public`
  - `Project modal` 已支持 group grants

参考 Open WebUI 的实现来源：

- storage provider：`backend/open_webui/storage/provider.py`
- vector/retrieval provider：`backend/open_webui/retrieval/vector/factory.py`
- socket realtime：`backend/open_webui/socket/main.py`
- access control：`src/lib/components/workspace/common/AccessControl.svelte`

最终验证：

- `npm --prefix packages/openport-product-contracts run build` 通过
- `npm --prefix apps/api run build` 通过
- `npm --prefix apps/web run build` 通过
- `npm run compose:up` 通过
- `docker compose -f compose/docker-compose.yml ps`
  - `compose-api-1` healthy
  - `compose-web-1` healthy
  - `compose-reference-server-1` healthy
  - `compose-postgres-1` healthy
- smoke test 通过：
  - `GET /api/groups`
  - `GET /api/projects`
  - `GET /api/projects/:id/knowledge/search?q=latency&limit=3`
  - `POST /api/projects/:id/access-grants` with `principalType=group`
  - `GET /api/projects/:id` as `user_secondary`

补充修复：

- 刷新了 `apps/api` / `apps/web` 对本地 `@openport/product-contracts` file dependency 的安装副本，解决了共享 contracts 产物滞后问题
- 补齐了 `ProjectKnowledgeItem`、`WorkspaceModel`、`WorkspaceTool` 新字段在 API/Web editor 中的编译漂移
