# OpenPort Knowledge Chunk Resource Plan

## 目标

继续把 `Workspace > Knowledge` 往 Open WebUI 的 `KnowledgeBase` 资源心智推进，把 `chunks` 从“文档级预览”提升为真正的独立资源：

- 顶层 `chunks` 视图显示真实 chunk 列表，而不是按 document 聚合
- collection 内部的 `chunks` 视图也显示真实 chunk 列表
- `/workspace/knowledge/chunks/[id]` 变成真正的 chunk detail，而不是借 item detail 的 `chunks` tab 复用

## Open WebUI 参考

- `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `src/lib/components/workspace/Knowledge/KnowledgeBase/Files.svelte`

Open WebUI 的关键心智不是“文档有很多块”，而是：

- 文件/文档可单独进入
- 检索对象可分层查看
- 每层资源都有自己的操作上下文

## 本轮实施范围

1. 顶层 `Knowledge > Chunks` 改为真实 chunk ledger
2. `Collection > Chunks` 改为真实 chunk ledger
3. 新增 `WorkspaceKnowledgeChunkDetail`
4. `/workspace/knowledge/chunks/[id]` 优先解析 chunk，旧 itemId 链接保留兼容回退
5. document detail 的 chunk/source 列表补上 drill-down 链接

## 预期结果

- `Knowledge` 的 `chunks` 不再是 document summary，而是独立资源列表
- 顶层、collection、document 三层的 chunk drill-down 一致
- 后续继续补 chunk/source 级操作时，不需要再重做路由和资源心智
