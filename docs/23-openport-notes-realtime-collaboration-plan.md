# OpenPort Notes Realtime Collaboration Plan

本文件定义 `Open WebUI Notes` 实时协作层在 `openport` 中的落地方案。目标不是复制其 `Svelte` 组件，而是按同样的系统结构，在 `OpenPort` 的 `NestJS + Next.js` 架构中实现可维护的实时协作。

## 1. 目标

- 为 `Notes` 提供真正的多人实时协作，而不是仅有 heartbeat/presence。
- 保持现有 `workspace / access grants / versions / assistant` 资源模型不变。
- 对齐 `Open WebUI` 的核心协作思路：
  - note 级权限校验
  - socket room join / leave
  - Yjs 文档同步
  - awareness / active sessions
  - 文档状态回写持久层

## 2. Open WebUI 参考结论

Open WebUI 的 notes 协作核心来自以下结构：

- 后端 notes 资源与权限：
  - `backend/open_webui/routers/notes.py`
- 后端 socket 协作入口：
  - `backend/open_webui/socket/main.py`
- 前端富文本协作接入：
  - `src/lib/components/common/RichTextInput.svelte`
  - `src/lib/components/common/RichTextInput/Collaboration.ts`

其关键特征：

- note 访问先经过 `AccessGrants` 权限检查
- 用户加入 note room：`join-note`
- 协作文档加入：`ydoc:document:join`
- 文档同步事件：
  - `ydoc:document:state`
  - `ydoc:document:update`
  - `ydoc:document:leave`
  - `ydoc:awareness:update`
- 文档 ID 采用 `note:{id}`
- 服务端维护 Yjs 文档状态，并将内容保存回 note 资源

## 3. OpenPort 目标架构

## 3.1 后端

新增 `notes` 协作网关与文档管理能力：

- `NotesCollaborationGateway`
- `NotesRealtimeService`

能力职责：

- 校验 socket 连接中的 actor 身份
- 校验 note 读权限
- 维护 `note:{id}` -> `Y.Doc`
- 维护 `note:{id}` -> 活跃协作用户
- 接收并广播 Yjs update
- 将文档内容 debounce 回写 `NotesService`

## 3.2 前端

新增 React 版协作适配层：

- `NotesRealtimeProvider` 或同等 hook
- 直接绑定当前 note 编辑器

本轮不强行引入 `TipTap/ProseMirror`，先在现有 Markdown/plain-text editor 上接入：

- `Y.Doc`
- `Y.Text`
- `socket.io-client`

这样可以先把：

- 多人协作
- 实时内容同步
- presence
- 会话列表

完整打通，再决定是否把编辑器升级成富文本。

## 4. 协作协议

延续 Open WebUI 的命名，避免协议再次分叉：

- `ydoc:document:join`
- `ydoc:document:state`
- `ydoc:document:update`
- `ydoc:document:leave`
- `ydoc:awareness:update`

文档 ID 规则：

- `note:{noteId}`

客户端 join 负载：

- `document_id`
- `note_id`
- `user_id`
- `user_name`
- `workspace_id`

## 5. 权限与安全

- 只有有 `read` 权限的用户可以 join 文档
- 只有有 `write` 权限的用户可以发送文档 update
- owner / admin / write grants 保持与现有 notes 资源判定一致
- Socket 认证使用当前 `OpenPortSession` 中的：
  - `accessToken`
  - `userId`
  - `workspaceId`

## 6. 数据持久化策略

本轮采用：

- 协作期间：Yjs 文档作为实时状态源
- debounce 保存：把当前 `Y.Text` 内容回写到 note `contentMd`
- 回写不为每个字符创建版本快照

版本策略保持：

- 标题变更与显式 REST 更新继续产生 version
- 实时协作文本保存不为每次更新制造 version 噪音

## 7. UI 目标

在当前 notes 编辑页中新增：

- 顶部实时协作状态
- 活跃用户列表
- 协作连接状态
- 编辑冲突提示

保留现有：

- title
- preview
- versions
- grants
- assistant

## 8. 分阶段实施

### Phase A

- 文档化方案
- 后端引入 `Socket.IO + Yjs`
- 前端引入 `socket.io-client + Yjs`
- 打通 note 内容实时同步

### Phase B

- 加入 awareness 广播
- 前端显示活跃协作者
- 将旧 heartbeat presence 降级为兼容层

### Phase C

- 评估将 editor 升级为 `TipTap/ProseMirror`
- 再向 Open WebUI 的 rich text collaboration 收敛

## 9. 本轮验收标准

- 两个浏览器标签打开同一 note
- 一侧编辑内容，另一侧实时看到更新
- 活跃用户列表能同步变化
- 断开标签后 presence 消失
- `npm run build:web` 通过
- `npm run build:api` 通过
- `docker compose -f compose/docker-compose.yml up -d --build` 后产品栈健康

## 10. 非目标

本轮不做：

- 完整富文本工具栏迁移
- cursor decorations
- selection decorations
- 评论流
- CRDT 历史回放 UI

## 11. 实施结论

可以按与 Open WebUI 基本一致的协作架构来做。

不能直接复制其实现，原因是：

- Open WebUI 前端为 `Svelte`
- OpenPort 前端为 `React / Next.js`
- Open WebUI 使用 `TipTap/ProseMirror` 富文本编辑器链
- OpenPort 当前 notes editor 还是 plain-text / markdown 形态

因此本轮方案采用：

- 同协议
- 同数据流
- 同权限边界
- React 侧重新实现编辑器协作绑定
