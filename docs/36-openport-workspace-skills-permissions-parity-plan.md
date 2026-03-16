# OpenPort Workspace Skills 与权限导航对齐方案

## 目标

在已完成 `Models / Knowledge / Prompts / Tools` 的基础上，继续向 Open WebUI 的 Workspace 主模块结构靠拢，补齐三类能力：

- `Skills` 模块
- Workspace 权限驱动显示与路由保护
- 各模块列表的 `import / export / search` 基础能力

本轮优先参考本地 `open-webui-main`：

- `src/routes/(app)/workspace/+layout.svelte`
- `src/routes/(app)/workspace/skills/+page.svelte`
- `src/lib/components/workspace/Skills.svelte`
- `src/lib/components/workspace/Models.svelte`
- `src/lib/components/workspace/Prompts.svelte`
- `src/lib/components/workspace/Tools.svelte`

## 设计原则

### 1. 继续沿用 OpenPort 已有资源模型

不引入第二套 Workspace 资源系统，继续在现有 `workspace-resources` 上补：

- `skills`
- permissions-aware tabs
- import/export helpers

### 2. 结构对齐 Open WebUI，但不机械复制

- `Skills` 进入 Workspace 主模块
- `Access` 从一级 tab 降级，不再和 `Models / Knowledge / Prompts / Tools / Skills` 同级
- Workspace tabs 按权限动态显示

### 3. 优先实现可用的产品能力

导入导出本轮采用 JSON 级别：

- `Export`：直接导出当前列表资源 JSON
- `Import`：读取 JSON 并调用已有 create API

这样可以快速达到 Open WebUI 类似的资源运营流，而不需要先补完整后端 import/export 协议。

## 实施步骤

### Step 1. 后端补齐 Skills 持久化与 CRUD

- state store 新增：
  - `workspaceSkillsByWorkspace`
- Postgres 新增：
  - `openport_workspace_skills`
- `WorkspaceResourcesService` 新增：
  - `listSkills`
  - `getSkill`
  - `createSkill`
  - `updateSkill`
  - `deleteSkill`
- controller 新增：
  - `GET /workspace/skills`
  - `POST /workspace/skills`
  - `GET /workspace/skills/:id`
  - `PATCH /workspace/skills/:id`
  - `DELETE /workspace/skills/:id`

### Step 2. 前端补齐 Skills 模块

新增：

- `/workspace/skills`
- `/workspace/skills/create`
- `/workspace/skills/[id]`

页面能力：

- 列表
- 搜索
- 创建
- 编辑
- 删除
- JSON 导入导出

### Step 3. Workspace 改为权限驱动 tab

新增前端权限工具：

- 读取 `/auth/me`
- 基于 `permissions.workspace` 过滤 tabs
- 对当前访问模块做 client-side route guard

保留：

- `/workspace/access`

但不再放入主 tab。

### Step 4. 各模块统一补齐 import / export

本轮覆盖：

- `Models`
- `Prompts`
- `Tools`
- `Skills`

同时补齐：

- `Prompts` 搜索
- `Tools` 搜索
- `Skills` 搜索

## 验收标准

完成后应满足：

- `/workspace/skills` 可正常访问
- Skills CRUD 可用且持久化
- Workspace tabs 包含 `Skills`
- Workspace tabs 不再显示 `Access`
- `Access` 路由仍可访问
- `Models / Prompts / Tools / Skills` 均支持 import/export
- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`

## 实施结果

本轮已完成，核心落地如下：

- 后端已补齐 Skills 资源：
  - state store 新增 `workspaceSkillsByWorkspace`
  - Postgres 新增 `openport_workspace_skills`
  - `workspace-resources` 已接通完整 Skills CRUD
- 前端已补齐 `Skills` 模块：
  - `/workspace/skills`
  - `/workspace/skills/create`
  - `/workspace/skills/[id]`
- Workspace 已改成权限驱动导航：
  - tabs 基于 `/auth/me` 的 `permissions.workspace` 过滤
  - 当前模块在无权限时会自动跳到第一个可访问模块
- `Access` 已从 Workspace 一级导航中降级：
  - 不再出现在主 tabs
  - 路由仍保留为 `/workspace/access`
  - 聊天页右上角 `Settings` 已改指向 `/workspace/access`
- 已为以下模块补齐 JSON import/export：
  - `Models`
  - `Prompts`
  - `Tools`
  - `Skills`
- 列表能力已继续补齐：
  - `Prompts` 搜索
  - `Tools` 搜索
  - `Skills` 搜索

## 验收结果

已执行：

- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`

并已完成运行态检查：

- `GET /workspace/skills` 页面返回 `200`
- `GET /workspace/access` 页面仍返回 `200`
- `GET /api/workspace/skills` 返回空列表 `{"items":[]}`
- `POST /api/workspace/skills` 可成功创建 skill
- Docker `web/api/reference/postgres` 四个容器均为 `healthy`
