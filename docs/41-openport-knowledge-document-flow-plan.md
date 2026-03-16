# OpenPort Knowledge 文档流深化方案

本方案用于继续把 `Workspace > Knowledge` 向 `Open WebUI` 的 document-centric 结构推进。

本轮不新增模块，而是把现有三层界面做成更完整的文档运营流：

1. `Knowledge` 总列表
2. `Collection detail`
3. `Knowledge item detail`

## 参考实现

- `open-webui-main/src/lib/components/workspace/Knowledge.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`

## 当前缺口

- 总列表仍偏“资源列表”，缺少 document 级 summary/filter
- collection 详情仍偏“集合下 item 列表”，缺少文档运营视角
- item 详情虽已有正文搜索，但还没有更明显的 source/chunk inspection 结构

## 本轮目标

### A. 总列表补 document 运营 summary

- 新增整体 summary：
  - documents
  - indexed
  - chunks
  - source links
- 新增过滤：
  - collection
  - retrieval state
  - source type

### B. Collection 详情补 document management 视角

- 新增 collection summary：
  - documents
  - indexed
  - chunks
  - projects
- 新增过滤：
  - search
  - retrieval state
  - source
- item 行显示：
  - chunk 数
  - source links
  - source type

### C. Item 详情保持 document inspection 结构

- 保留：
  - content search
  - stats
  - append content
- 强化：
  - source records
  - chunk preview
  - retrieval-facing detail 信息

## 实施顺序

1. 写入方案文档
2. 更新 `workspace-knowledge.tsx`
3. 更新 `workspace-knowledge-collection-detail.tsx`
4. 补齐 `workspace-knowledge-detail.tsx`
5. 更新进度文档
6. 运行 `build:web`
7. 运行 `compose:up`

## 验收标准

- `/workspace/knowledge` 有 summary 和多维过滤
- `/workspace/knowledge/collections/[id]` 有 summary 和 document-level 过滤
- `/workspace/knowledge/[id]` 能看到 `Source records` 与 `Chunk preview`
- Docker 产品栈构建并启动通过

## 完成后仍未完全对齐 Open WebUI 的点

- 还没有真正的 chunk/source 后台管理
- 还没有 document upload pipeline 的更多解析策略
- 还没有 collection 级访问控制和更深的检索调优面板
