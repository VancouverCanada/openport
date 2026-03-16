# OpenPort Notes Open WebUI Polish Plan

本文件定义 `OpenPort Notes` 在完成 `TipTap + ProseMirror + Yjs + uploads` 后，继续向 `Open WebUI` 靠拢的“交互完成度”收敛范围。

## 1. 目标

- 补齐 `notes` 编辑器在日常使用上的细节差距。
- 继续优先参考 `Open WebUI RichTextInput` 的现有实现，而不是额外引入新编辑器路线。
- 不推翻当前已完成的 `realtime / uploads / sharing / versions`。

## 2. 直接参考的 Open WebUI 实现

- `src/lib/components/common/RichTextInput.svelte`
- `src/lib/components/common/RichTextInput/FormattingButtons.svelte`
- `src/lib/components/common/RichTextInput/Collaboration.ts`

## 3. 本轮实施模块

### Module A: Mention Round-trip

- Markdown 中的 `<@id>` 恢复为富文本 mention node。
- 保证：
  - `markdown -> html`
  - `html -> markdown`
  两个方向都成立。

### Module B: Formatting Buttons Parity

- 参考 `FormattingButtons.svelte`
- 在现有 toolbar 中补齐：
  - `H1 / H2 / H3`
  - `Lift List`
  - `Sink List`
- 保持当前 `bold / italic / strike / code / table / image` 不变。

### Module C: Collaboration Presence Polish

- 在 note header 中增加协作者头像条和活跃人数。
- 在 panel 中保留详细 presence 列表。
- 让实时协作不只体现在 cursor，而是体现在页面顶部可见。

## 4. 验收标准

- 含 `<@user_id>` 的 note 能恢复成 mention 样式
- toolbar 出现 `H1 / H2 / H3 / Lift / Sink`
- note header 显示协作者头像条
- `npm run build:web` 通过
- `npm run compose:up` 通过

## 5. 实施状态

- `done`: mention round-trip
- `done`: formatting buttons parity
- `done`: collaboration presence polish
- `done`: `npm run build:web`
- `done`: `npm run build:api`
