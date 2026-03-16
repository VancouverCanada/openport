# OpenPort Notes Final Open WebUI Parity Plan

本文件定义 `OpenPort Notes` 从“已具备富文本协作”继续推进到更接近 `Open WebUI RichTextInput` 的最后一轮实施范围。

## 1. 目标

- 补齐剩余的四个核心差距：
  - `slash suggestion` 渲染器
  - `mentions`
  - `drag handle`
  - 图片上传从本地 `base64` 改为经后端资源路由持久化
- 优先复用 `Open WebUI` 已验证过的模块结构和事件命名。
- 保持当前 `TipTap + ProseMirror + Yjs + Socket.IO`、`notes / sharing / versions / assistant` 方案不被推翻。

## 2. 直接参考的 Open WebUI 实现

- `src/lib/components/common/RichTextInput.svelte`
- `src/lib/components/common/RichTextInput/commands.ts`
- `src/lib/components/common/RichTextInput/suggestions.ts`
- `src/lib/components/common/RichTextInput/listDragHandlePlugin.js`
- `src/lib/components/common/RichTextInput/Image/image.ts`

## 3. 实施原则

- 不复制 `Svelte` 组件。
- 直接复用 `Open WebUI` 的模块拆分、扩展组合和交互结构。
- 在 `React/Next` 下做等价重建。
- 复用当前 `openport` 已有的 `notes realtime gateway`、`RBAC`、`versioning` 和 `contentHtml/contentMd` 持久化链路。

## 4. 实施模块

### Module A: Slash Suggestions

- 采用 `@tiptap/suggestion`
- 结构参考 `commands.ts + suggestions.ts`
- 第一版提供：
  - `Heading`
  - `Bullet list`
  - `Task list`
  - `Quote`
  - `Code block`
  - `Table`
  - `Divider`
  - `Image`

### Module B: Mentions

- 使用 `@tiptap/extension-mention`
- 采用与 slash menu 相同的 suggestion popup 渲染器
- 先接入：
  - 当前用户
  - 当前 note 协作者
  - note 已共享用户
- HTML 持久化保留 `data-type / data-id / data-label`
- Markdown 导出使用 `<@id>` 形式，保持与 `Open WebUI` 一致的可扩展表达

### Module C: Drag Handle

- 直接参考 `Open WebUI listDragHandlePlugin.js`
- 允许拖拽 list item / task item
- 支持：
  - before
  - after
  - into
  - outdent

### Module D: Uploaded Images

- 新增 `POST /api/notes/uploads`
- 新增 `GET /api/notes/uploads/:fileName`
- 前端插图改成：
  - 读取本地文件
  - 发给 notes uploads API
  - 插入回传的代理 URL
- 粘贴图片同样走上传接口

## 5. 验收标准

- `/dashboard/notes/:id` 中输入 `/` 可弹出命令菜单
- 输入 `@` 可弹出 mention 菜单
- list item 可显示 drag handle 并完成拖拽
- 通过文件选择和粘贴插入的图片不再只依赖 `base64`
- `contentHtml / contentMd / excerpt / versions` 继续正常保存
- `npm run build:web` 通过
- `npm run build:api` 通过
- `npm run compose:up` 通过

## 6. 实施状态

- `done`: slash suggestion renderer
- `done`: mentions
- `done`: drag handle
- `done`: uploaded images
- `done`: `npm --prefix apps/web install @tiptap/extension-mention`
- `done`: `npm run build:web`
- `done`: `npm run build:api`
- `done`: `npm run compose:up`
- `done`: notes smoke validation
  - `POST /api/notes`
  - `POST /api/notes/uploads`
  - `GET /api/openport/notes/uploads/:fileName`
  - Docker `api/web/reference-server/postgres` all healthy
