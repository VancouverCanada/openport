# OpenPort Workspace Parity Plan

本方案用于把 `Workspace` 页面从说明页升级为真正的工作区入口页，参考 Open WebUI 的 `Workspace` 信息架构，但保留 OpenPort 现有的数据模型与命名边界。

参考方向：

- Open WebUI 的 `Workspace` 不只是“设置页”，而是模型、知识、工具与构建资源的集中入口。
- OpenPort 当前已经具备可用数据源：
  - `bootstrap`
  - `integrations`
  - `projects`
  - `knowledge items`
  - `chat sessions`

## 目标

1. 把 `Workspace` 改成真实功能入口，而不是纯文案页面。
2. 使用现有 API 数据拼出 `Models / Knowledge / Tools` 三块。
3. 让 `Workspace` 成为：
   - `Chat` 的上游配置入口
   - `Connections` 的上层能力索引
   - `Projects` 与知识资产的聚合视图

## 设计原则

1. 不伪造后端不存在的复杂能力。
2. 先把真实数据组织起来，再逐步补更深功能。
3. 视觉上继续沿用现有 `dashboard` 体系，不引入新的视觉系统。

## 页面结构

### Hero

- 页面标题
- 一句短说明
- 右侧 quick actions：
  - Open chat
  - Open notes
  - Open connections

### Models

- 当前可见的 model routes
- 来自已有 chat sessions 的 route 汇总
- 结合 runtime/bootstrap 状态给出简洁状态信息

### Knowledge

- 工作区 knowledge library 数量
- 已附着到 project 的 knowledge 数量
- 最近上传的知识项列表

### Tools

- `integrations` 视为当前工具/连接能力
- `modules` 视为当前 runtime 提供的产品模块
- `projects with system prompt` 作为 prompt-capable workspace assets

## 已实施范围

- `done`：新增独立方案文档
- `done`：`Workspace` 页面改为真实数据驱动
- `done`：接入 `fetchBootstrap / fetchIntegrations / fetchProjects / fetchProjectKnowledge / fetchChatSessions`
- `done`：新增 `Models / Knowledge / Tools` 三块入口
- `done`：新增 quick actions

## 后续建议

下一阶段如果继续对齐 Open WebUI：

1. 在 `Workspace` 内把 `Models / Knowledge / Tools / Prompts` 拆成独立二级页面。
2. 给 `Models` 加真实 provider / route 编辑能力。
3. 给 `Knowledge` 加上传与管理交互，而不是只读列表。
4. 把 `Tools` 接到更真实的 OpenPort runtime 能力目录。
