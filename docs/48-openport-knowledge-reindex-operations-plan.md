# OpenPort Knowledge Reindex Operations Plan

## 目标

继续把 `Workspace > Knowledge` 往 Open WebUI 的 `KnowledgeBase` 操作流靠拢，不再只提供浏览、导出和 drill-down，而是补上接近 `reset/update` 心智的真实索引维护动作。

## Open WebUI 参考

- `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `src/lib/apis/knowledge/index.ts`

Open WebUI 在知识库层除了浏览文件，还具备：

- reset knowledge
- update file in knowledge
- remove file from knowledge

对 OpenPort 现有数据模型来说，最稳的等价动作是：

- `Re-index document`
- `Re-index linked documents for one source`

## 本轮实施范围

1. 后端新增 `POST /projects/knowledge/:itemId/reindex`
2. document detail 新增 `Re-index`
3. source detail 新增：
   - `Re-index linked`
   - per-document `Re-index`
4. 这轮能力接在现有 `persistKnowledgeItem` 上，不引入新的存储模型

## 预期结果

- 知识项内容变更后可以显式重建 chunks 和 dense chunks
- source detail 不再只是查看源头映射，而是能触发关联文档的索引重建
- `Knowledge` 更接近 Open WebUI 的可维护知识库，而不是只读资源浏览器
