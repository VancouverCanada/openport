# OpenPort Workspace 资源工作流补强方案

本方案用于继续把 `Workspace` 从“模块存在”推进到“资源工作流可用”，重点参考 `Open WebUI` 的 `Knowledge / Prompts / Tools` 资产管理思路。

## 参考实现

- `open-webui-main/src/lib/components/workspace/Knowledge.svelte`
- `open-webui-main/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `open-webui-main/src/lib/components/workspace/Prompts.svelte`
- `open-webui-main/src/lib/components/workspace/Tools/ToolkitEditor.svelte`

## 本轮目标

### 1. Knowledge 资源导出与文档操作

- `Knowledge item detail`
  - 导出单条 knowledge item JSON
  - 下载纯文本内容
  - 复制文档正文
- `Knowledge collection detail`
  - 导出 collection + items bundle

### 2. Prompts 资源分享工作流

- 列表页已有 `duplicate / copy / export`
- 再补：
  - 社区分享入口
  - 编辑器内导出当前 prompt draft

### 3. Tools 更像 Toolkit 资源编辑器

- `Tool editor`
  - 单条 tool JSON 导出
  - 单条 tool JSON 导入
  - toolkit preview（结构化预览）
- 列表页继续保留 `duplicate / copy manifest / export`

## 实施顺序

1. 新增文档
2. 补 `Knowledge` item / collection export
3. 补 `Prompts` community/export workflow
4. 补 `Tool editor` import/export/preview
5. 构建验证并更新进度

## 验收标准

- Knowledge item 可导出 JSON、下载文本、复制正文
- Knowledge collection 可导出 bundle
- Prompts 有社区分享入口，编辑器能导出当前 draft
- Tool editor 支持导入/导出单条资源，并显示 toolkit preview
