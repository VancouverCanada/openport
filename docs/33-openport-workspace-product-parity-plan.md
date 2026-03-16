# OpenPort Workspace 产品态对齐方案

## 目标

在已完成 Workspace CRUD 和基础 Open WebUI 对齐的前提下，把四个核心模块继续推进到更接近完整产品态：

- `Models`：更完整的筛选、能力视图、按 Knowledge collection 组织的选择器
- `Knowledge`：collection 详情页和多项目绑定管理
- `Prompts`：版本备注、历史对比和 restore 体验
- `Tools`：结构化 `valves` 编辑和 manifest 模板/摘要体验

本轮仍然优先参考本地 `open-webui-main` 的模块心智与交互组织，而不是逐文件照搬：

- `workspace/Models/ModelEditor.svelte`
- `workspace/Knowledge/KnowledgeBase.svelte`
- `workspace/Prompts/PromptEditor.svelte`
- `workspace/Tools/ToolkitEditor.svelte`

## 设计原则

### 1. 继续保留 OpenPort 命名

不引入第二套术语：

- `Workspace`
- `Models`
- `Knowledge`
- `Prompts`
- `Tools`
- `Projects`

### 2. 优先增强现有模块，不再新增平行系统

本轮继续扩展：

- `apps/api/src/workspace-resources`
- `apps/api/src/projects`
- `apps/web/src/components/workspace-*`

### 3. 先做能提升产品可用性的深度，而不是继续铺壳层

本轮不再新增 overview 页，重点补齐：

- 真实筛选与结构化编辑
- collection 级浏览和绑定
- prompt 版本协作信息
- tool 编辑器的可维护性

## 具体实施

### Step 1. Prompt 历史补版本备注

参考 Open WebUI 的 `PromptEditor.svelte`：

- 在 `create/update prompt` DTO 中新增 `commitMessage?: string`
- 在 `OpenPortWorkspacePromptVersion` 上新增 `commitMessage?: string`
- 每次保存 prompt 时把 `commitMessage` 作为历史快照备注保存
- restore 时保留 `Restored ...` 的版本标签

### Step 2. Prompt 编辑器补 diff 视图

在 `workspace-prompt-editor.tsx` 中新增：

- `Version note` 输入框
- 历史列表点击后显示该版本与当前内容的 diff 预览
- 保留 restore 能力

本轮 diff 采用轻量 line-based 差异显示，不引入重型 diff editor。

### Step 3. Knowledge 增加 collection 详情页

参考 Open WebUI `KnowledgeBase.svelte` 的侧重方式：

- 在 `Knowledge` 列表页增加 collection summary cards
- 新增 `/workspace/knowledge/collections/[id]`
- collection 详情页显示：
  - collection 信息
  - collection 下所有 knowledge items
  - 使用该 collection 的 projects

### Step 4. Knowledge item 补项目绑定管理

在知识详情页中新增：

- 当前 knowledge item 被哪些 project 使用
- 直接 attach/detach 到 project 的交互

实现上复用现有 `updateProject` 和 `project.data.files`，不再另起一套绑定系统。

### Step 5. Models 增强筛选与 selector

参考 Open WebUI 的模型编辑器心智：

- list 页补：
  - query filter
  - capability filter
  - knowledge collection filter
- edit 页补：
  - knowledge items 按 collection 分组
  - 已选数量提示
  - tool/knowledge 选择区更接近 selector 而不是裸 checklist

### Step 6. Tools 编辑器改为结构化 valves

参考 Open WebUI `ToolkitEditor.svelte` 的编辑器体验：

- 不再只靠 `key=value` 文本块
- 改成可增删的 `valve rows`
- 保留 manifest 编辑区
- 新增 manifest templates
- 显示 manifest 摘要（如 `name / entry`）

## 验收标准

完成后应满足：

- `Prompts` 可填写版本备注并查看内容 diff
- `Knowledge` 有 collection 详情页
- `Knowledge` 可直接绑定/解绑 project
- `Models` 支持 query/capability/collection 过滤
- `Models` 编辑器按 collection 分组显示 knowledge
- `Tools` 支持结构化 valves 编辑
- `npm run build:web`
- `npm run build:api`
- `npm run compose:up`

## 本轮边界

本轮仍不实现：

- Open WebUI 那套完整 access control matrix
- prompt production version/branching 体系
- knowledge 的远程网页抓取 ingestion pipeline
- tool 的远程 registry / marketplace
