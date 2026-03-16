# OpenPort Knowledge Lifecycle Operations Plan

本文件记录 `Workspace > Knowledge` 继续向本地 `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte` 对齐时，本轮优先补的生命周期操作。

## 目标

把 `Knowledge` 从“可浏览、可导出、可重建”继续推进到“可维护”。

本轮优先补：

- `Replace content`
- `Reset index`
- source detail 批量 `Re-index / Reset`

## 参考

- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- Open WebUI 的 file / knowledge lifecycle：
  - `updateFileFromKnowledgeById`
  - `resetKnowledgeById`

## 实施范围

1. API
   - 新增 `PATCH /projects/knowledge/:itemId/content`
   - 新增 `POST /projects/knowledge/:itemId/reset`
2. `WorkspaceKnowledgeDetail`
   - 内容替换
   - 索引重置
3. `WorkspaceKnowledgeSourceDetail`
   - 批量重建
   - 批量 reset
   - 单条重建
   - 单条 reset

## 验收标准

- `Knowledge detail` 可直接替换文档内容
- `Reset index` 后文档保留但 chunk 归零、检索态回退
- `Re-index` 可再次恢复 chunk
- source 详情页能对 linked documents 进行批量和单条 reset/reindex
- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`
