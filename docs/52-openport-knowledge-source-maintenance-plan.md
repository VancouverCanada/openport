# OpenPort Knowledge Source Maintenance Plan

本文件记录 `Workspace > Knowledge > Source` 继续向本地 `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte` 对齐时，本轮优先补的 source 维护动作。

## 目标

把 `Knowledge` 的 source 视图从“可查看、可重建、可重置”推进到“可移除”。

## 参考实现

- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
  - `removeFileFromKnowledgeById`
  - `resetKnowledgeById`
  - `updateFileFromKnowledgeById`
- `open-webui-main/src/lib/apis/knowledge/index.ts`

## 本轮范围

1. 后端新增 source remove 接口
2. `ProjectsService.getKnowledge` 修正为返回真实 `sources`
3. `WorkspaceKnowledgeSourceDetail` 增加：
   - `Remove`
   - `Remove linked`
4. 调整 knowledge source 正常化逻辑
   - `sources: []` 应保留为空，而不是再次自动合成默认 source

## 完成标准

- `DELETE /projects/knowledge/:itemId/sources/:sourceId` 可用
- source detail 支持单条和批量移除
- 移除后 source ledger 和 detail 页面会反映真实状态
- `npm run build:api`、`npm run build:web`、`npm run compose:up` 通过
