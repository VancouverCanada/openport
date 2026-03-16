# OpenPort Model Editor Depth Plan

本文件记录 `Workspace > Models` 向本地 `open-webui-main/src/lib/components/workspace/Models/ModelEditor.svelte` 对齐的实施范围。

## 目标

把当前 `WorkspaceModelEditor` 从基础资源编辑器，推进到更接近 Open WebUI 的模型装配器。

本轮优先覆盖：

- `ActionsSelector`
- `BuiltinTools`
- `DefaultFeatures`
- `DefaultFiltersSelector`
- `PromptSuggestions`

## 对齐策略

- 参考 Open WebUI 的 section 组织方式，不做逐行复制。
- 优先复用 OpenPort 已有资源：
  - `Tools`
  - `Skills`
  - `Knowledge`
  - `Workspace model` 持久化
- 先把数据模型和编辑器 section 补齐，再补更复杂的 selector/modal 化交互。

## 本轮实施项

1. 扩展 `OpenPortWorkspaceModel` 契约：
   - `defaultFilterIds`
   - `actionIds`
   - `defaultFeatureIds`
   - `builtinToolIds`
   - `promptSuggestions`
2. 扩展 API DTO 和 service/store 持久化
3. 扩展 `WorkspaceModelEditor`
4. 扩展 `WorkspaceModels` 列表摘要与导入导出
5. 更新 parity matrix 与进度文档

## 非目标

以下内容仍保留到后续批次：

- modal 化 selector
- built-in actions 的真实运行时编排
- prompt suggestions 的更强排序/模板库
- Open WebUI `DefaultFeatures` 的完整能力面

## 验收标准

- `Models` 创建/编辑页可读写新字段
- file/postgres 双后端都能持久化这些字段
- 列表页可体现新装配深度
- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`
