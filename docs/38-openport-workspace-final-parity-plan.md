# OpenPort Workspace 最终差距收口方案

本方案用于继续把 `openport` 的 `Workspace` 收口到更接近 `Open WebUI` 的结构与行为。

本轮不再继续平均铺开模块，而是集中处理三个最影响对齐度的缺口：

1. 把 `Access` 从 `Workspace` 主模块彻底降级到独立 `Settings` 区
2. 把 `Knowledge` 继续往 document-centric 方向推进
3. 为 `Prompts` 与 `Tools` 补一层更完整的资源工作流

## 参考实现

- `open-webui-main/src/routes/(app)/workspace/+layout.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `open-webui-main/src/lib/components/workspace/Prompts.svelte`
- `open-webui-main/src/lib/components/workspace/Tools/ToolkitEditor.svelte`

## 当前关键缺口

### 1. Access 仍挂在 Workspace 体系内

- 当前仍保留 `/workspace/access`
- `chat` 头像菜单里的 `Settings` 也仍直接跳到 `/workspace/access`
- 这会让 `Workspace` 主结构继续偏离 Open WebUI

### 2. Knowledge 还不够 document-centric

- 现在已经有：
  - collections
  - item CRUD
  - collection 搜索
  - item 详情
- 还缺：
  - 文档级搜索和文档摘要统计
  - 内容内命中视图
  - 更明显的 document detail 工作流

### 3. Prompts / Tools 仍偏 CRUD

- `Prompts` 目前强在：
  - version history
  - production version
- 还缺更顺手的资源操作：
  - duplicate
  - 单条 export
  - copy workflow

- `Tools` 目前强在：
  - manifest
  - valves
  - valveSchema
- 还缺更完整的资源操作：
  - duplicate
  - 单条 export
  - manifest copy / quick reuse

## 本轮实施目标

### A. Access 降级为 Settings 子区

- 新增：
  - `/settings`
  - `/settings/access`
- `/workspace/access` 保留兼容跳转到 `/settings/access`
- `Workspace` 权限映射不再把 `/workspace/access` 当成主模块路径
- `Open Settings` 快捷键与聊天头像菜单统一切到 `/settings/access`

### B. Knowledge document-centric 补强

- `Knowledge item detail` 新增：
  - 文档级搜索
  - 内容命中摘要
  - 内容统计：
    - characters
    - words
    - lines
    - matches
- `collection detail` 保持 collection 视图，但继续作为 documents 列表入口

### C. Prompts 资源工作流补强

- 列表页新增：
  - duplicate
  - 单条 export
  - copy content
- 保持已有：
  - import/export
  - production version
  - diff / restore

### D. Tools 资源工作流补强

- 列表页新增：
  - duplicate
  - 单条 export
  - copy manifest
- 强化 `Toolkit` 风格的资源复用感，而不只是基础 CRUD

## 实施顺序

1. 新增 Settings 路由与导航壳层
2. 将 `/workspace/access` 改为兼容跳转
3. 更新 `chat/menu/shortcuts/permissions` 中所有旧入口
4. 为 `Knowledge detail` 增加文档搜索与统计
5. 为 `Prompts` 增加 duplicate/export/copy
6. 为 `Tools` 增加 duplicate/export/copy
7. 运行 `build:web` / `build:api` 验证

## 验收标准

- `/settings/access` 可正常访问
- `/workspace/access` 会跳转到 `/settings/access`
- `Workspace` 主导航不再暗含 `Access`
- `Knowledge` item 详情页支持文档内搜索并显示命中摘要
- `Prompts` 支持 duplicate / 单条 export / copy content
- `Tools` 支持 duplicate / 单条 export / copy manifest

## 本轮之后仍未完全对齐 Open WebUI 的点

- `Knowledge` 仍未做到完整 chunk/source 管理
- `Prompts` 仍未做到 community/share 级工作流
- `Tools` 仍未做到完整 Python/toolkit 级编辑器
- 多 workspace 切换体验仍需继续完善
