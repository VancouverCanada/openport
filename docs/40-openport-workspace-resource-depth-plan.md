# OpenPort Workspace 资源深度对齐方案

本方案用于继续把 `openport` 的 `Workspace` 资源模块往 `Open WebUI` 的真实资产工作流推进。

本轮不再扩张模块数量，而是集中补齐三类仍然偏浅的资源行为：

1. `Knowledge` 的 `source/chunk/document` 视图
2. `Prompts` 的 `visibility/import/community` 工作流
3. `Tools` 的 `tags/examples/toolkit` 编辑体验

## 参考实现

- `open-webui-main/src/lib/components/workspace/Knowledge.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `open-webui-main/src/lib/components/workspace/Prompts.svelte`
- `open-webui-main/src/lib/components/workspace/Tools/ToolkitEditor.svelte`

## 当前缺口

### 1. Knowledge 仍停留在文档正文视图

- 已有：
  - collections
  - item detail
  - document search
  - append content
- 仍缺：
  - source records
  - chunk preview
  - 更接近检索链路的 document inspection

### 2. Prompts 仍偏内部 CRUD

- 已有：
  - version history
  - production version
  - duplicate / export / copy
- 仍缺：
  - visibility
  - 更顺手的 draft import/export
  - community style handoff

### 3. Tools 仍偏 schema 表单

- 已有：
  - manifest
  - valves
  - valve schema
- 仍缺：
  - tags
  - examples
  - 更明显的 toolkit usage preview

## 本轮实施目标

### A. Knowledge 详情页补 source/chunk 视图

- `Knowledge detail` 新增：
  - `Source records`
  - `Chunk preview`
- 数据来源继续优先复用现有 `projects.service` 生成的 retrieval metadata

### B. Prompts 补 visibility + draft/community 工作流

- Prompt 数据模型新增 `visibility`
- 编辑器支持：
  - `Workspace / Private`
  - draft JSON import/export
  - community handoff
- 列表支持按 `visibility` 过滤

### C. Tools 补 tags/examples

- Tool 数据模型新增：
  - `tags`
  - `examples`
- 编辑器支持：
  - tags 输入
  - example rows
  - toolkit preview 中显示 tags/examples
- 列表支持 tags/example count 呈现与搜索

## 实施顺序

1. 扩展产品契约
2. 扩展 file/postgres 双后端持久化
3. 扩展 workspace DTO / service
4. 扩展前端 API client
5. 扩展 `Prompts / Tools / Knowledge detail`
6. 运行 `build:api`
7. 运行 `build:web`
8. 运行 `compose:up`

## 验收标准

- `Knowledge detail` 可看到 `Source records` 和 `Chunk preview`
- `Prompt` 支持 `visibility`
- `Prompt editor` 支持 draft import/export 和 community handoff
- `Tool` 支持 `tags/examples`
- `Tool list` 可展示 example count 并按 tags 搜索
- Docker 产品栈构建通过

## 完成后仍未完全对齐 Open WebUI 的点

- `Knowledge` 还没有真正的 chunk/source 管理后台
- `Prompts` 还没有完整 community/share 社区工作流
- `Tools` 还不是完整的 toolkit runtime/editor
