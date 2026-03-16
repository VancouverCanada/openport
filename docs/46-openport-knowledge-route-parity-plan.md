# OpenPort Knowledge Route Parity Plan

## 目标

继续把 `Workspace > Knowledge` 对齐到 Open WebUI 的 `KnowledgeBase` 路由心智，不再只依赖单页内部状态切换，而是让 `documents / collections / sources / chunks` 以及 collection 内部的 `documents / sources / chunks` 都具备独立可访问路由。

## Open WebUI 参考

- `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `src/lib/components/workspace/Knowledge/KnowledgeBase/Files.svelte`

这些实现的关键不是视觉，而是：

- 资源视图具备明确的上下文边界
- 左右切换后 URL 可以直接表达当前管理视图
- 文档、文件、检索对象之间是逐层钻取，而不是一个页面里堆很多隐藏态

## 本轮实施范围

1. 把 collection 详情页内部的 `Documents / Sources / Chunks` 改成 route-backed 入口
2. 补齐 `/workspace/knowledge/collections/[id]/sources`
3. 补齐 `/workspace/knowledge/collections/[id]/chunks`
4. 保留 `/workspace/knowledge/collections/[id]` 作为 document 视图
5. 把这轮进度回写到 `docs/15-openport-productization-progress.md`

## 预期结果

- 用户可以直接分享或刷新 collection 的 source/chunk 视图
- Knowledge 路由树更接近 Open WebUI 的资源管理方式
- 后续继续补 source/chunk 明细编辑时，不需要再重构 collection 详情入口
