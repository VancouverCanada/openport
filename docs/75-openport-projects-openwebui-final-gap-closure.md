# OpenPort Projects vs Open WebUI Folders Final Gap Closure

## Scope

一次性补齐以下 4 个剩余差异：

1. project 背景图在 chat 主画布真实生效。
2. project 从单模型默认扩展到多模型语义（`modelRoutes`）。
3. project modal 增加文件数上限策略校验。
4. sidebar 拖拽 JSON 导入支持 chat payload 回退（不仅 project bundle）。

## Implementation

### 1) Chat background consumption

- `apps/web/src/components/chat-shell.tsx`
  - 对 `selectedProject.meta.backgroundImageUrl` 做读取。
  - 在 `chat-main-stage` 动态增加 `has-project-background` class 和背景 style。

### 2) Multi-model project semantics

- Shared contracts
  - `packages/openport-product-contracts/src/index.ts`
  - `OpenPortProjectData` 新增 `modelRoutes: string[]`。
- API + persistence
  - `apps/api/src/projects/dto/create-project.dto.ts`
  - `apps/api/src/projects/dto/update-project.dto.ts`
  - `apps/api/src/projects/projects.service.ts`
  - `apps/api/src/storage/api-state-store.service.ts`
  - 新增 `modelRoutes` 校验与 normalize，`defaultModelRoute` 自动回退到首个可用 model route。
- Web normalization + defaults
  - `apps/web/src/lib/chat-workspace.ts`
  - `apps/web/src/lib/chat-defaults.ts`
  - `apps/web/src/components/chat-controls-panel.tsx`
  - `apps/web/src/lib/openport-api.ts`
  - 新增 primary model 解析函数，聊天继承逻辑优先使用 project primary route。
- Project modal
  - `apps/web/src/components/project-modal.tsx`
  - 新增 `Project Models` 选择和 `Primary Model` 选择，提交时写入 `modelRoutes`。

### 3) Max file count strategy

- `apps/web/src/components/project-modal.tsx`
  - 新增 `NEXT_PUBLIC_OPENPORT_PROJECT_MAX_FILE_COUNT`（默认 32）。
  - 提交、上传、知识勾选三条路径均执行上限校验和提示。

### 4) JSON import fallback

- `apps/web/src/components/workspace-sidebar.tsx`
  - 导入流程先判定 project bundle。
  - 非 bundle 时回退到 `importChatSessions`（支持 `items`/`chats`/array payload）。
  - 如在目标 project 下导入，自动将新导入 chats 绑定到该 project。

## Status

- 状态：`done`
- 完成日期：`2026-03-16`
