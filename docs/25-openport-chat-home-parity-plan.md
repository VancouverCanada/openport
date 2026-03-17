# OpenPort Chat Home Parity Plan

本方案用于把 `openport` 已登录后的产品主入口继续向 Open WebUI 对齐，但保留 OpenPort 自身的命名与产品边界。

参考代码与结构：

- `open-webui-main/src/routes/(app)/+page.svelte`
- `open-webui-main/src/lib/components/chat/Chat.svelte`
- `open-webui-main/src/lib/components/layout/Sidebar.svelte`

## 目标

1. 已登录访问 `/` 时直接进入聊天主界面，而不是停在产品落地页。
2. 提供独立 `/chat` 主路由，作为 OpenPort 的 chat-first 入口。
3. 将旧的 `/dashboard/chat` 降级为兼容入口。
4. 把聊天主画布调整为更接近 Open WebUI 的空态结构：
   - 顶部轻量模型行
   - 居中的输入框
   - 建议提示
   - 默认收起右侧 controls
5. 把左侧侧栏继续从“后台导航”收敛成“应用侧栏”。

## 设计决策

### 路由

- 未登录访问 `/`
  - 保持现有产品入口页。
- 已登录访问 `/`
  - 直接重定向到 `/chat`。
- 主聊天入口
  - 使用 `/chat`。
- 兼容入口
  - `/dashboard/chat` 保留，但直接跳转到 `/chat`，并保留查询参数。

### 主界面

- 右侧 `Controls` 默认关闭。
- 空 chat 和空线程统一为同一种聊天首页空态。
- 去掉旧的 “No messages in this chat yet.” 说明盒子。
- 顶部不再用大标题和说明文案占主视觉，只保留模型选择行和右上角控制入口。

### 侧栏

- `New chat / Search / Notes / Workspace` 保持应用导航角色。
- `Projects / Chats` 保留 OpenPort 命名，不引入第二套组织层术语别名。
- `Projects` 的创建和导入动作收轻，不再做成显眼的管理块。

## 实施步骤

### Step 1. 路由对齐

- 新增 `/chat` 路由及其布局壳。
- 让 `HomeEntryGate`、登录页、注册页、首页已登录入口统一跳到 `/chat`。
- 将 `/dashboard/chat` 改为兼容跳转页。

### Step 2. Chat 空态对齐

- 将 `ChatShell` 的 `!activeThread` 与 “active thread but zero messages” 统一为 `showEmptyStage`。
- 空态时居中显示模型和主输入框。
- 顶部 header 收敛成模型行而不是说明区。

### Step 3. Sidebar 收敛

- 统一所有 chat href 为 `/chat`。
- 减轻 `Projects` 区的管理感。
- 调整侧栏字号、行高、间距。

### Step 4. 搜索与后端链接一致性

- 后端 search 结果中的 chat href 改为 `/chat?thread=...`。

## 已落地状态

- `done`：已登录访问 `/` 自动进入 `/chat`
- `done`：新增 `/chat` 主路由
- `done`：`/dashboard/chat` 改为兼容跳转
- `done`：登录/注册成功默认进入 `/chat`
- `done`：chat 空态改为统一主页式空态
- `done`：右侧 controls 默认收起
- `done`：搜索结果 chat href 已切到 `/chat`
- `done`：侧栏 chat 入口与 brand 链接已统一切到 `/chat`

## 后续建议

如果继续向 Open WebUI 深度靠拢，下一阶段优先级应为：

1. `Workspace` 页面补充真实模型/知识/工具入口。
2. `Notes` 页面继续做实，与 chat 搜索和上下文挂接。
3. `Chat Controls` 继续扩展真实模型参数和运行时能力。
