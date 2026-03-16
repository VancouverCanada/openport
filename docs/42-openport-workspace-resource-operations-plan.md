# OpenPort Workspace 资源操作深化方案

本方案用于继续把 `Workspace` 的资源模块往 `Open WebUI` 的实际操作流推进。

本轮聚焦三块：

1. `Prompts` 的标签与分享工作流
2. `Tools` 的筛选与资源交换工作流
3. `Knowledge collections` 的 source/chunk 聚合视图

## 参考实现

- `open-webui-main/src/lib/components/workspace/Prompts.svelte`
- `open-webui-main/src/lib/components/workspace/Tools/ToolkitEditor.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`

## 当前缺口

### 1. Prompts 还缺标签级操作和可见集分享

- 已有：
  - search
  - visibility
  - duplicate / export / copy / community
- 仍缺：
  - tag filter
  - visible subset copy/share
  - 更明显的 prompt inventory summary

### 2. Tools 还缺资源级筛选和交换操作

- 已有：
  - import/export
  - duplicate
  - manifest copy
- 仍缺：
  - enabled/integration filters
  - visible subset export/copy
  - 更明显的 toolkit inventory summary

### 3. Knowledge collection 还缺聚合视图

- 已有：
  - document list
  - document search
  - retrieval/source filters
- 仍缺：
  - collection-level source ledger
  - chunk coverage 视图
  - 更明显的 retrieval inventory 感

## 本轮目标

### A. Prompts

- 新增：
  - `tag` filter
  - top-level `Copy visible JSON`
  - top-level `Share visible`
  - summary cards
  - per-item `Copy command`

### B. Tools

- 新增：
  - `enabled` filter
  - `integration` filter
  - top-level `Copy visible JSON`
  - summary cards
  - per-item `Copy JSON`

### C. Knowledge collections

- 新增：
  - `Source records` 聚合区
  - `Chunk coverage` 聚合区
- 让 collection detail 更接近知识库运营页，而不只是集合下的 item list

## 实施顺序

1. 写入方案文档
2. 增强 `workspace-prompts.tsx`
3. 增强 `workspace-tools.tsx`
4. 增强 `workspace-knowledge-collection-detail.tsx`
5. 更新进度文档
6. 运行 `build:web`
7. 运行 `compose:up`

## 验收标准

- `/workspace/prompts` 支持 tag filter、visible JSON copy、visible share
- `/workspace/tools` 支持 enabled/integration filters、visible JSON copy
- `/workspace/knowledge/collections/[id]` 出现 source ledger 和 chunk coverage
- Docker 产品栈构建通过
