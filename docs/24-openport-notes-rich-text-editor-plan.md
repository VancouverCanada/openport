# OpenPort Notes Rich Text Editor Plan

本文件定义 `OpenPort Notes` 向 `Open WebUI` 风格富文本编辑器升级的实施方案。目标是把当前 `notes` 从协作文本框提升为真正的 `TipTap/ProseMirror + Yjs` 协作编辑器。

## 1. 目标

- 将 `Notes` 编辑器升级为富文本编辑器。
- 保持现有 `Yjs + websocket` 实时协作链路可用。
- 对齐 `Open WebUI` 的核心做法：
  - `TipTap/ProseMirror`
  - `Yjs` 文档同步
  - awareness / cursor 协作
  - HTML 内容持久化
  - Markdown 导出能力

## 2. 参考基线

Open WebUI 相关实现：

- 富文本编辑器：
  - `src/lib/components/common/RichTextInput.svelte`
- 协作 provider：
  - `src/lib/components/common/RichTextInput/Collaboration.ts`

从这些实现里，OpenPort 需要对齐的是：

- 使用 `ProseMirror` 文档模型，而不是普通 textarea
- 使用 `Y.Doc + y-prosemirror`
- 使用 `awareness` 同步协作者状态
- 在编辑器侧生成 HTML / Markdown / plain text 快照

## 3. OpenPort 目标数据模型

现有字段保留：

- `contentMd`
- `excerpt`

新增字段：

- `contentHtml`

版本模型同步新增：

- `OpenPortNoteVersion.contentHtml`

语义约束：

- `contentHtml` 是富文本真实持久化内容
- `contentMd` 是从 HTML 导出的 markdown 兼容层
- `excerpt` 从纯文本提取

## 4. 编辑器技术选型

采用：

- `@tiptap/react`
- `@tiptap/starter-kit`
- `yjs`
- `y-prosemirror`
- `y-protocols`

不采用：

- `Lexical`
- `Slate`
- `BlockNote`

原因：

- `TipTap/ProseMirror` 与 `Open WebUI` 路线一致
- 与现有 `Yjs` 协作层兼容最好
- 后续扩展 toolbar / code / task list / table 最顺

## 5. 本轮功能范围

### 5.1 本轮完成

- 富文本编辑器替换 textarea
- 基础格式：
  - paragraph
  - heading
  - bold
  - italic
  - bullet list
  - ordered list
  - task list
  - blockquote
  - code block
  - horizontal rule
- `Yjs + websocket` 实时协作继续可用
- note 内容保存为 `contentHtml + contentMd`
- 版本恢复兼容富文本内容

### 5.2 本轮可选增强

- awareness 驱动的协作者状态
- 基础 cursor 协作显示

### 5.3 本轮不做

- 完整 table 工具栏
- mentions
- drag handle
- image upload
- slash command

## 6. 实施步骤

### Phase A

- 扩展 contracts / DTO / notes service
- notes 资源支持 `contentHtml`

### Phase B

- 新增 React 版 `TipTap/ProseMirror` editor
- 新增 HTML -> markdown / plain text 快照逻辑

### Phase C

- 将现有 `OpenPortNoteRealtime` 升级为 `ProseMirror/Yjs` provider
- 协作事件继续沿用：
  - `ydoc:document:join`
  - `ydoc:document:state`
  - `ydoc:document:update`
  - `ydoc:document:leave`
  - `ydoc:awareness:update`

### Phase D

- Notes 页面接入新编辑器
- 版本恢复 / 分享 / assistant 面板与富文本共存

## 7. 验收标准

- note 打开后显示富文本编辑器
- 格式化内容刷新后仍保持
- 两个浏览器窗口编辑同一 note 可实时同步
- `contentHtml` 与 `contentMd` 同时保存
- 版本恢复后富文本内容恢复正确
- `npm run build:web` 通过
- `npm run build:api` 通过
- `docker compose -f compose/docker-compose.yml up -d --build` 后容器健康

## 8. 结论

要对齐到 `Open WebUI` 的 notes editor，最合理的路线就是：

- `TipTap/ProseMirror`
- `Yjs`
- `Socket.IO`

没有比这条路线更适合当前 `openport` 的选择。

## 9. 实施状态

当前已完成：

- `contracts / DTO / notes service` 已新增 `contentHtml`
- `notes` 版本恢复已兼容 `contentHtml`
- React 版 `TipTap/ProseMirror` editor 已落地
- `y-prosemirror + awareness` 已接入现有 notes realtime socket 链路
- `contentHtml / contentMd / excerpt` 快照已联动保存
- `note-editor` 已从 textarea 升级为富文本编辑器
- `npm run build:web` 通过
- `npm run build:api` 通过
- `npm run compose:up` 通过
- Docker 运行态下已验证 `contentHtml` 创建、更新、读取正常

当前仍未对齐到 Open WebUI 的点：

- 完整富文本工具栏还没做到它那么全
- 协作者 cursor / selection decoration 仅为基础版
- 还没补 tables / image upload / slash command
