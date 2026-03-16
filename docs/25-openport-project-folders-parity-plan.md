# OpenPort Projects 对齐 Open WebUI Folders 实施方案

本文件用于把 `openport` 的 `Projects` 完整收敛到 Open WebUI `Folders` 的实现结构与交互能力。

目标不是直接复制 Open WebUI 代码，而是参考其信息架构、状态模型和交互流，在 `openport` 现有 Next.js 架构内做等价实现。

当前状态：

- 2026-03-15 已完成本方案主线实施
- 目前 `Projects` 已从本地-only 方案升级到 API-backed + workspace knowledge + import/export + destructive delete
- 剩余差距已经不再是 folders parity 缺口，而是更重的对象存储、向量知识和实时同步增强
- 上述增强项的正式方案与实施结果已转入 [docs/26-openport-projects-phase3-enhancement-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/26-openport-projects-phase3-enhancement-plan.md)

## 1. 调查范围

本方案主要对照以下 Open WebUI 本地代码：

- `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar/Folders.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar/RecursiveFolder.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar/Folders/FolderMenu.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/layout/Sidebar/Folders/FolderModal.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/components/common/ConfirmDialog.svelte`
- `/Users/Sebastian/open-webui-main/src/lib/apis/folders/index.ts`
- `/Users/Sebastian/open-webui-main/src/lib/apis/chats/index.ts`

## 2. 当前代码基线

### 2.1 已完成

- `Projects` 已从平铺列表升级成树形结构
- 已支持：
  - parent/child 层级
  - 展开状态持久化
  - 子项目创建
  - 项目移动
  - chat 拖放归档
  - sidebar 递归渲染

### 2.2 同事最近提交后的关键变化

当前 `Projects` 归档的真实来源已经从单纯本地 `project.chatIds` 转向：

- `OpenPortChatSession.settings.projectId`

这意味着方案需要更新为双层状态边界：

- `Projects` 的树结构与元数据：本地 `localStorage`
- chat 与 project 的真实绑定：API-backed `session.settings.projectId`

因此后续实现不能再把 `project.chatIds` 当作唯一真值，只能作为兼容层和搜索辅助索引。

## 3. 与 Open WebUI 的差距

### 3.1 已对齐

- tree-based projects
- nested projects
- expand / collapse
- drag project into project
- drag chat into project
- project-scoped chat grouping

### 3.2 未对齐

- 每个 project 的 ellipsis dropdown menu
- create / edit modal
- confirm dialog 替代原生 `window.confirm`
- project export
- project metadata
  - background image
  - system prompt
  - attached files / local knowledge shell
- project 默认值接入新建 chat 流
- delete project 时的 chat assignment 清理策略

### 3.3 二阶段剩余差距

在同事提交 `session.settings.projectId` 归档更新后，完整 parity 还需要补齐以下 7 点：

1. `Projects` 变成服务端实体，而不是只存本地 `localStorage`
2. `Knowledge / Files` 绑定到真实 `Workspace` 知识项，而不是本地壳层
3. 支持完整 `import` 流，而不是只有 `export`
4. `background image` 真正消费到聊天主画布
5. `delete contents` 变成真实内容删除，而不是只清 `project assignment`
6. 补齐 loading / toast / workspace context 这类完整产品交互
7. 让 `Projects` 具备多端共享与同步基础，而不是当前单浏览器缓存主导

### 3.4 当前不纳入本轮

以下能力在 Open WebUI 中依赖更完整后端，本轮只做壳层或暂缓：

- 文件二进制对象存储
- 真正的外部向量知识索引
- 实时协同级别的 project presence / live mutation stream

## 4. 设计边界

OpenPort 术语保持：

- `Projects`

不会在 UI 中同时引入：

- `Folders`
- `Projects`

Open WebUI 仅作为结构参考，不直接暴露其命名。

## 5. 实施步骤

### Step 0. 方案修正

由于最新代码基线已经改为：

- project 结构元数据本地缓存
- chat 归档真值来自 `session.settings.projectId`

因此本轮实施采用：

- API 为 source of truth
- `localStorage` 仅作为 web 缓存与离线回退
- 所有 UI mutation 先写 API，再刷新本地缓存

### Step 1. 数据模型升级

在 `apps/web/src/lib/chat-workspace.ts` 中扩展 `OpenPortProject`：

- `meta.backgroundImageUrl`
- `data.systemPrompt`
- `data.files`
- 继续保留：
  - `parentId`
  - `isExpanded`
  - `updatedAt`

要求：

- 向后兼容旧的 localStorage 数据
- `project.chatIds` 仅保留为兼容索引，不作为唯一真值
- 新增项目默认 chat settings 生成器，能把 project 级 system prompt 带入新会话

同时在共享 contracts 与 API store 中新增：

- `OpenPortProject`
- `OpenPortProjectKnowledgeItem`
- `OpenPortProjectExportBundle`
- `OpenPortDeleteProjectResponse`

### Step 2. Sidebar 交互壳层对齐

在 `workspace-sidebar.tsx` 与 `project-tree-item.tsx` 中补齐：

- 顶层 `Create project` 入口从 inline input 改为 modal
- 每个 project row 使用 ellipsis dropdown menu
- 菜单项统一为：
  - `Create Project`
  - `Edit`
  - `Export`
  - `Delete`

### Step 3. Project Modal

新增 project modal，字段如下：

- `Project Name`
- `Project Background Image`
- `System Prompt`
- `Knowledge`
  - `Select Knowledge`
  - `Upload Files`

实现要求：

- create / edit 共用同一 modal
- 支持 ESC 关闭
- 支持 click-backdrop 关闭
- 文件上传进入 workspace knowledge store
- `Select Knowledge` 绑定真实 workspace knowledge items
- project 仅保存被选中的 knowledge/file 引用

### Step 4. Delete Confirm Dialog

用统一 confirm dialog 替代 `window.confirm`

本轮改成真实 destructive flow，checkbox 文案恢复为：

- `Delete all contents inside this project`

行为：

- 不勾选：删除 project 树，清理 chats 的 `projectId`
- 勾选：删除 project 树，并真实删除 subtree 内 chats

### Step 5. Export

增加 project export：

- project 本体
- descendants
- 当前属于该 project subtree 的 chats

导出格式：

- JSON blob

并补齐 import：

- root-level import
- parent project import
- JSON file drop import
- import bundle 自动生成新的 ids，避免冲突

### Step 6. 新建 Chat 默认值

当用户处于 project 作用域中创建 chat 时：

- 继承 projectId
- 继承 project.data.systemPrompt

入口包括：

- sidebar `New chat`
- chat 空态创建

### Step 7. API-backed Projects

新增 `apps/api` projects 模块：

- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `POST /projects/:id/move`
- `POST /projects/:id/items`
- `POST /projects/import`
- `GET /projects/:id/export`
- `DELETE /projects/:id?delete_contents=true|false`
- `GET /projects/knowledge`
- `POST /projects/knowledge/upload`

存储要求：

- file backend 与 postgres backend 同时支持
- workspace 维度隔离
- project / knowledge 元数据可持久化

### Step 8. 聊天画布消费 Project 元数据

在 `Chat` 页面消费：

- `project.meta.backgroundImageUrl`
- `project.data.systemPrompt`
- `project.data.files`

表现要求：

- 选中 project 时聊天空态与标题区出现背景图语义
- right controls 能看到当前 project prompt / knowledge context

### Step 9. 交互完整度补齐

补齐：

- loading state
- success/error toast
- permission-aware disable state
- workspace knowledge 页面显示可复用知识项
- API 刷新与多端共享基础

## 6. 验收标准

本轮完成的标准是：

- `Projects` 可以通过 modal 新建
- `Projects` 可以通过 modal 编辑
- 每个 project row 有统一 dropdown menu
- project 可以导出 JSON
- project 可以导入 JSON
- 删除 project 使用 confirm dialog
- 删除时支持真实删除 subtree chats
- new chat 会继承 project 的 system prompt
- Workspace 中可查看并复用 project knowledge items
- Chat 画布会消费 project 背景图
- `Projects` 数据从 API 加载并持久化
- `npm run build:web` 通过
- `npm --prefix apps/api run build` 通过
- Docker 运行态不回归

## 7. 实施后剩余差距

即使本轮全部完成，和 Open WebUI 相比仍保留以下差距：

- 真正的对象存储 / 文件 CDN
- 向量化 knowledge retrieval
- 实时 project mutation broadcast
