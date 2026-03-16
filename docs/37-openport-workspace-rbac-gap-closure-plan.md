# OpenPort Workspace RBAC 与缺口收口方案

本方案用于继续收口 `Workspace` 与 `Open WebUI` 的差距，重点不是再增加新页面，而是把已有模块从“壳层对齐”推进到“真实行为对齐”。

参考实现：

- `open-webui-main/src/routes/(app)/workspace/+layout.svelte`
- `open-webui-main/src/routes/(app)/workspace/+page.svelte`
- `open-webui-main/src/lib/components/workspace/Models/ModelEditor.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`

## 当前核心缺口

1. `Workspace` 权限仍然是壳层，后端 `auth/me` 仍没有基于真实成员角色输出权限。
2. `Access` 虽然已经从一级导航移除，但仍缺少真正的成员角色管理能力。
3. `Models` 仍少一段 Open WebUI `ModelEditor` 里真实存在的 `Skills` 关联能力。
4. `Knowledge` 已有 collection CRUD，但还不够 document-centric，缺少快速文档筛选入口。

## 本轮实施目标

### 1. 真实 RBAC 驱动的 Workspace

- 以后端 `workspace member role` 作为 `auth/me` 的权限来源。
- `owner/admin` 拥有全部 Workspace 模块权限。
- `member/viewer` 默认不拥有 Workspace 资产管理权限。
- `/workspace` 默认入口不再固定跳到 `models`，而是按首个可访问模块重定向。

### 2. Access 变成真实设置入口

- 在 `Access` 页加入：
  - workspace members 列表
  - role 更新
  - invites 列表与创建
  - groups 管理继续保留
- `Access` 继续保留为 settings/admin 入口，不回到 Workspace 一级导航。

### 3. Models 对齐 Open WebUI ModelEditor

- 为 `OpenPortWorkspaceModel` 增加 `skillIds`
- 后端 file/postgres 双持久化一起扩展
- 前端 `ModelEditor` 增加 `Skills` 选择区
- 列表页显示 `skills` 关联数量

### 4. Knowledge 向 document-centric 流靠拢

- `Knowledge` 列表支持 query 搜索
- collection detail 支持 collection 内文档搜索
- 搜索范围覆盖：
  - name
  - preview
  - contentText
  - source/type

## 实施顺序

1. 更新共享契约：`workspaceRole`、member response、model `skillIds`
2. 更新后端 `WorkspacesService/AuthService`，把 `auth/me` 权限接到真实成员角色
3. 为成员角色管理补 API
4. 更新前端 `Access` 页，接入成员/邀请/角色管理
5. 扩展 model `skillIds` 到 API/store/frontend editor
6. 为 `Knowledge` 与 collection detail 增加文档式 query filter
7. 调整 Workspace 入口与前端权限兜底逻辑

## 通过标准

- `GET /auth/me` 会根据当前 workspace member role 返回不同的 `permissions.workspace`
- `/workspace` 会跳到第一个可访问模块，而不是固定 `/workspace/models`
- `Access` 页可查看成员、修改角色、创建 invite
- `Models` 可保存并回读 `skillIds`
- `Knowledge` 与 collection detail 支持基于内容的筛选

## 本轮之后仍未完全对齐 Open WebUI 的点

- `Workspace` 权限仍是 role -> module 的粗粒度映射，还不是更细粒度 capability matrix
- `Knowledge` 还没有完整 document ingestion / chunk management / source detail workflow
- `Prompts` 仍缺 community/share/import-export 深度工作流
- `Tools` 仍缺更接近 Open WebUI `ToolkitEditor` 的完整 schema/editor 体验
