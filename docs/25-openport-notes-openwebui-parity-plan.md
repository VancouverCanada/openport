# OpenPort Notes Open WebUI Parity Plan

本文件定义 `OpenPort Notes` 从“已具备富文本协作”继续收敛到更接近 `Open WebUI RichTextInput` 体验的实施方案。

## 1. 目标

- 在现有 `TipTap + ProseMirror + Yjs + Socket.IO` 基础上，补齐更接近 Open WebUI 的编辑器体验。
- 优先复用 Open WebUI 已验证过的实现思路，而不是重新发明一套 notes editor。
- 保持与当前 `openport` 的 `notes / sharing / versions / assistant` 模块兼容。

## 2. 直接参考的 Open WebUI 实现

- 富文本主组件：
  - `src/lib/components/common/RichTextInput.svelte`
- 协作 provider：
  - `src/lib/components/common/RichTextInput/Collaboration.ts`
- 图片节点：
  - `src/lib/components/common/RichTextInput/Image/image.ts`
- 命令菜单：
  - `src/lib/components/common/RichTextInput/commands.ts`

## 3. 本轮对齐范围

### 3.1 需要补齐

- `BubbleMenu`
- `Floating insert menu`
- `Table`
- `Image`
- 更完整的 markdown/html 互转规则

### 3.2 暂不直接迁移

- `mentions`
- `slash suggestion` 的完整组件渲染器
- `drag handle`
- `file upload backend`

## 4. 采用方式

不是复制 Open WebUI 的 Svelte 代码，而是：

- 复用它的交互结构
- 复用它的扩展组合
- 复用它的 markdown/html 转换规则
- 在 React/Next 下用等价 TipTap 扩展重建

## 5. 具体实施模块

### Module A: BubbleMenu

- 文本选中后显示轻量浮动格式工具
- 包含：
  - bold
  - italic
  - strike
  - link
  - code

### Module B: Floating Insert Menu

- 在空段落处显示插入菜单
- 用于插入：
  - heading
  - bullet list
  - task list
  - blockquote
  - code block
  - table
  - image

### Module C: Table

- 使用 `@tiptap/extension-table`
- 支持：
  - insert table
  - add/remove row
  - add/remove column
  - delete table
- markdown 转换规则按 Open WebUI 的 table turndown 逻辑对齐

### Module D: Image

- 使用 `@tiptap/extension-image`
- 第一版支持：
  - toolbar 插入
  - floating menu 插入
  - clipboard paste base64 image
  - 本地文件选择插入
- 暂不做外部对象存储上传

## 6. 验收标准

- note editor 出现 bubble menu
- 空段落可通过 floating menu 快速插入 block/table/image
- 图片可通过本地文件和粘贴插入
- table 内容可保存并恢复
- `contentHtml / contentMd / excerpt` 继续正常保存
- `npm run build:web` 通过
- `npm run compose:up` 通过

## 7. 当前结论

最合理的加速方式不是复制 Open WebUI 组件，而是：

- 直接沿用它的技术栈和交互结构
- 用 React 版 TipTap 在 `openport` 里重建

这能最大化节约时间，同时避免跨框架硬搬代码。

## 8. 实施状态

当前已完成：

- `BubbleMenu`
- `Floating insert menu`
- `Table`
- `Image` 本地文件插入
- `clipboard paste image`
- table 的 markdown/html 转换规则补强
- `npm --prefix apps/web install`
- `npm run build:web`
- `npm run compose:up`

当前仍未做满的 Open WebUI 细节：

- 完整 `slash suggestion` 渲染器
- `mentions`
- `drag handle`
- 图片上传到外部存储
