# OpenPort Workspace 模块化对齐方案

## 目标

把 OpenPort 当前的 `Workspace` 从总览页改造成更接近 Open WebUI 的模块化工作区：

- `/workspace` 不再停留在 overview
- `/workspace` 自动进入默认子页
- 使用真实子路由承载工作区能力：
  - `/workspace/models`
  - `/workspace/knowledge`
  - `/workspace/prompts`
  - `/workspace/tools`
- 保留 `Workspace` 命名，不再引入第二套 `Folders / Projects` 命名

## 对齐依据

参考本地 `open-webui-main` 中的结构：

- `src/routes/(app)/workspace/+layout.svelte`
- `src/routes/(app)/workspace/+page.svelte`
- `src/routes/(app)/workspace/models/+page.svelte`
- `src/routes/(app)/workspace/knowledge/+page.svelte`
- `src/routes/(app)/workspace/prompts/+page.svelte`
- `src/routes/(app)/workspace/tools/+page.svelte`

Open WebUI 的关键点不是把 `Workspace` 做成概览页，而是：

- `Workspace` 是模块容器
- 进入后直接落到某个可操作子模块
- 顶部用轻量 tab 导航切换模块

## OpenPort 实施原则

### 1. 保留名称

继续使用 `Workspace`，不改名。

原因：

- 和 Open WebUI 用户心智一致
- 现有侧栏和入口已经建立了该名称
- 当前更需要改结构，不需要制造新的命名迁移成本

### 2. 删除当前 overview 停留页

当前 `dashboard/workspace` 的 hub 页不再作为最终页面保留。

处理方式：

- 新增真正的 `/workspace` 路由
- `/workspace` 自动重定向到 `/workspace/models`
- 原 `/dashboard/workspace` 仅保留兼容跳转到 `/workspace`

### 3. 优先复用现有 OpenPort 数据

本轮不复制 Open WebUI 后端模型，而是在 OpenPort 现有 API 能力上实现同构工作区：

- `Models`
  - 来自 chat session settings 中的 `modelRoute`
  - 辅以 runtime/bootstrap 状态
- `Knowledge`
  - 来自 `/projects/knowledge`
  - 辅以 project attachment 关系
- `Prompts`
  - 使用 `project.data.systemPrompt`
  - 作为 OpenPort 当前 prompt 资产来源
- `Tools`
  - 来自 `/openport-admin/integrations`
  - 辅以 `bootstrap.modules`

### 4. 先做模块壳层，再继续功能深化

本轮目标是：

- 完成信息架构对齐
- 建立可继续扩展的子路由骨架
- 让 `Workspace` 从“概览页”升级为“真实模块入口”

下一轮再继续做：

- prompt editor
- knowledge upload / item detail
- model management
- tool editor / toolkit config

## 具体实施步骤

### Step 1. 新增顶级 `/workspace` 模块

新增：

- `apps/web/src/app/workspace/layout.tsx`
- `apps/web/src/app/workspace/page.tsx`

行为：

- 使用现有 `WorkspaceAppShell`
- 在内容区顶部增加模块 tab 导航
- `/workspace` 自动重定向到 `/workspace/models`

### Step 2. 新增四个真实子页面

新增：

- `apps/web/src/app/workspace/models/page.tsx`
- `apps/web/src/app/workspace/knowledge/page.tsx`
- `apps/web/src/app/workspace/prompts/page.tsx`
- `apps/web/src/app/workspace/tools/page.tsx`

实现要求：

- 全部消费现有 OpenPort API
- 不做纯静态占位页
- 每个子页至少有：
  - 模块标题
  - 简短说明
  - 真实数据列表
  - 空状态

### Step 3. 删除 overview 停留页

更新：

- `apps/web/src/app/dashboard/workspace/page.tsx`

改为：

- 兼容跳转到 `/workspace`

### Step 4. 全部入口切换到新模块

更新：

- `WorkspaceSidebar`
- `WorkspaceAppShell`
- `ChatShell` 右上角菜单

把旧的 `/dashboard/workspace` 链接切到：

- `/workspace`
- `/workspace/models`
- `/workspace/tools`

### Step 5. 样式收敛

新增 workspace 模块样式：

- 顶部 tab 导航
- 子页 section 列表
- 模块统计块
- 轻量空状态

视觉原则：

- 继续保持当前 OpenPort 的极简风格
- 结构参考 Open WebUI
- 不恢复旧的 marketing-like overview

## 验收标准

完成后应满足：

- 已登录用户可直接访问 `/workspace`
- `/workspace` 自动进入 `/workspace/models`
- 侧栏 `Workspace` 指向新模块
- `/dashboard/workspace` 自动跳转到 `/workspace`
- `Models / Knowledge / Prompts / Tools` 四个子页都能正常显示真实数据
- `npm run build:web`
- `npm run compose:up`

## 风险与边界

### 已知不完全对齐项

本轮不会完全复制 Open WebUI 的以下能力：

- permission-aware workspace tab gating
- prompt / tool / model 的完整 CRUD 编辑器
- skills 模块
- knowledge item detail page

### 当前设计取舍

本轮优先对齐：

- 路由结构
- 模块信息架构
- 主入口逻辑

而不是一次性补齐全部细分功能。
