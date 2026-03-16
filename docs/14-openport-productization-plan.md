# OpenPort 产品化实施方案

## 1. 目标

本方案的目标不是把当前 `openport` 继续堆成一个更大的 demo，而是把它升级为一个像 Open WebUI 一样可以直接部署、注册登录、进入后台、创建集成、审批草案、查看审计，并带有完整 AI 聊天入口的自托管产品，同时保留当前 OpenPort 的协议内核、适配器边界和安全默认值。

实施进度单独记录在：

- [docs/15-openport-productization-progress.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/15-openport-productization-progress.md)

OSS / Cloud 分版策略记录在：

- [docs/20-openport-oss-vs-cloud-edition-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/20-openport-oss-vs-cloud-edition-plan.md)

目标结果：

- 保留现有 OpenPort 协议能力和 `agent/v1` / `agent-admin/v1` 契约。
- 增加完整 Web 前端、用户体系、工作区、多租户后台和部署产物。
- 聊天界面优先复用 Figena 现有 `Cilila AI` React/Next.js 实现风格，而不是去移植 Open WebUI 的 Svelte 聊天代码。
- 部署体验参考 Open WebUI：Docker 优先、环境变量驱动、单机先跑、后续可扩展到多实例。
- 后端能力优先复用 Figena 已有认证、RBAC、AI、集成管理等实现思路，再抽象成 OpenPort 产品层。

## 2. 基线结论

### 2.1 openport 当前状态

我检查后的结论是：当前 `openport` 仍然是“协议参考运行时”，不是“完整产品”。

直接依据：

- `src/app.ts` 只暴露 Fastify API，没有 Web 页面、会话管理、数据库迁移或部署编排。
- `src/auth.ts` 只有 Bearer token 鉴权，没有用户注册、登录、邮箱验证、刷新会话、CSRF。
- `src/runtime.ts` 使用 `InMemoryStore` 作为核心状态存储，Postgres 仅覆盖领域数据适配器，不覆盖用户/集成/草案/审计持久化。
- `src/reference-server.ts` 是本地 demo 启动器，启动后打印 bootstrap token。
- `test/app.test.ts`、`test/security-controls.test.ts` 说明当前优势在协议稳定性、安全控制和高风险动作流程，而不是产品壳层。

### 2.2 Figena-Web 可直接复用的成熟能力

`Figena-Web` 已经具备大量 OpenPort 产品化所需能力，而且技术栈与目标形态高度匹配。

已确认的直接参考源：

- 后端认证：
  - `Figena-Web/backend/src/auth/auth.controller.ts`
  - `Figena-Web/backend/src/auth/auth.service.ts`
- 后端 AI：
  - `Figena-Web/backend/src/ai/ai.module.ts`
  - `Figena-Web/backend/src/ai/ai.controller.ts`
  - `Figena-Web/backend/src/ai/ai.service.ts`
- 后端 Agent/OpenPort：
  - `Figena-Web/backend/src/agent/agent.controller.ts`
  - `Figena-Web/backend/src/agent/agent-admin.controller.ts`
  - `Figena-Web/backend/src/agent/agent-admin.service.ts`
- 前端后台壳层：
  - `Figena-Web/frontend/src/components/dashboard/AppShell.tsx`
  - `Figena-Web/frontend/src/hooks/useSession.ts`
  - `Figena-Web/frontend/src/components/dashboard/SessionProvider.tsx`
- 前端 OpenPort 控制台：
  - `Figena-Web/frontend/src/app/[locale]/dashboard/openport/page.tsx`
  - `Figena-Web/frontend/src/components/integrations/AgentIntegrationsPanel.tsx`
- 前端 AI 聊天：
  - `Figena-Web/frontend/src/app/[locale]/dashboard/ai/page.tsx`
  - `Figena-Web/frontend/src/components/ai/AiChatPanel.tsx`
- 数据模型参考：
  - `Figena-Web/backend/prisma/schema.prisma` 中的 `users`、`refresh_sessions`、`email_verifications`、`agent_apps`、`agent_keys`、`ai_sessions`、`ai_messages`

结论：

- `openport` 产品化不应该从零搭建认证和控制台。
- 更合理的路线是：保留 `openport` 协议内核，把 Figena 中已经验证过的产品层抽取、净化、通用化。

### 2.3 Open WebUI 应该借鉴什么

Open WebUI 不适合作为 React 代码直接拷贝源，因为它前端是 Svelte，聊天与工作区逻辑也更偏通用 AI 平台；但它非常适合作为“产品发行方式”和“完整自托管体验”的参考样板。

重点参考点：

- `README.md` 的安装体验：默认 Docker、单命令启动、环境变量驱动。
- `Dockerfile`：前后端一体发行、构建镜像、数据目录、健康检查。
- `docker-compose.yaml`：把主要依赖与应用编排成开箱即用体验。
- `src/routes/auth/+page.svelte`：统一登录/注册/LDAP/OAuth 入口。
- `src/routes/(app)/+layout.svelte` 与 `src/routes/(app)/admin/+layout.svelte`：应用壳层、工作区与后台的分层路由。
- `backend/open_webui/main.py`：配置集中化、鉴权能力可切换、OAuth/SCIM/Trusted Header 扩展位。

结论：

- Open WebUI 主要借鉴“产品化结构”和“部署形态”。
- 聊天 UI 与业务后台，优先复用 Figena，而不是移植 Open WebUI 的 Svelte 组件。

## 3. 总体策略

推荐把 OpenPort 拆成“两层一壳”：

1. 协议内核层：保留当前 `openport` 运行时，负责协议、工具注册、draft-first、preflight、state witness、审计抽象。
2. 产品服务层：新增完整 API 服务，负责用户、组织、RBAC、AI 会话、文件、审批、后台管理。
3. Web 壳层：新增 Next.js 前端，负责注册登录、后台、集成控制台、AI 聊天、审计可视化。

核心原则：

- 现有 `src/` 不能直接被“产品逻辑污染”。
- 用户体系、工作区、邮件验证、文件上传、聊天会话、运营后台，应全部进入新产品层。
- OpenPort 协议端点必须保持稳定，不能因为产品化而破坏现有 SDK 和测试。

## 4. 推荐目标架构

## 4.1 仓库结构

建议把当前仓库重构为单仓多应用结构：

```text
openport/
  apps/
    api/                      # 新的 NestJS 产品 API
    web/                      # 新的 Next.js Web 应用
    reference-server/         # 保留当前 Fastify demo 启动器
  packages/
    openport-core/            # 由当前 src/ 提炼出的协议内核
    openport-adapter-sdk/     # DomainAdapter / auth / audit / storage 等接口
    openport-ui/              # 可复用前端组件，来自 Figena 的净化版本
    openport-config/          # env schema, feature flags, shared constants
  deploy/
    docker/
    compose/
    helm/
  docs/
  spec/
  conformance/
```

如果暂时不想一次性大重构，可以采用过渡形态：

- 第一阶段保留当前仓库根目录 `src/` 和 `test/` 不动。
- 新增 `apps/api`、`apps/web`。
- 等产品层稳定后，再把 `src/` 平移到 `packages/openport-core`。

## 4.2 后端技术选型

推荐：

- 产品 API 层使用 NestJS。
- 协议内核层保留当前 TypeScript/Fastify-neutral 实现。
- 数据访问统一使用 Prisma + PostgreSQL。
- 文件上传统一用 S3/R2 接口。
- 限流、session 撤销、SSE 多实例广播优先支持 Redis。

原因：

- Figena 的认证、AI、Agent、RBAC 全部已经在 NestJS 上成型，迁移成本最低。
- `openport` 当前内核是纯 TypeScript，可作为 NestJS service 的底层依赖，不冲突。
- 如果继续只在 Fastify 上堆产品能力，会重复发明 Figena 里已经存在的认证、会话、CSRF、RBAC、邮件验证、管理员设置逻辑。

## 4.3 模块分层

### A. Core 协议层

来自当前 `openport/src`：

- `AgentEngine`
- `AdminEngine`
- `AgentToolRegistry`
- `policy.ts`
- `auth.ts` 中的 agent token 鉴权逻辑
- `types.ts` 中的协议类型
- `spec/openport-v1.openapi.yaml`

职责：

- 维护 `manifest`、`preflight`、`actions`、`draft`、`stateWitnessHash` 等协议行为。
- 继续作为 SDK 和嵌入式运行时发布。

### B. Product API 层

新增 NestJS 模块：

- `AuthModule`
- `AccountModule`
- `OrgModule`
- `RbacModule`
- `AgentModule`
- `AiModule`
- `StorageModule`
- `AuditModule`
- `NotificationModule`
- `AdminModule`
- `HealthModule`

职责：

- 用户注册、登录、刷新会话、邮箱验证、密码重置
- 工作区与成员管理
- 集成生命周期管理
- AI 聊天、附件、草案执行
- Web 后台所需的全部数据接口

### C. Web 层

新增 Next.js App Router：

- 公共认证页
- Dashboard 壳层
- OpenPort 集成控制台
- AI 聊天工作台
- Admin 设置页

## 5. 功能蓝图

## 5.1 v1 必须具备的产品能力

### 身份与账户

- 邮箱注册
- 邮箱密码登录
- HttpOnly Cookie 会话
- Refresh Session 轮换
- CSRF 防护
- 邮箱验证码与激活链接
- 忘记密码 / 重置密码
- 更换邮箱并重新验证
- 可选双重确认或 step-up 验证

### 工作区与权限

- 个人空间与工作区空间
- 工作区成员关系
- 角色与 capability
- 个人 app 和 workspace app 两种 scope
- workspace app 绑定 service account

### OpenPort 控制台

- 创建 integration/app
- 创建和轮换 access key
- 编辑 scope
- 编辑数据策略与 IP allowlist
- 配置 auto-execute
- 查看可用 tools
- 查看 ledgers / resource scope
- Quickstart 面板和 curl 示例
- 查看草案并审批/驳回
- 查看审计日志与监控摘要

### AI 工作台

- 会话列表
- 流式聊天
- 文件上传 / 解析
- 结构化草案卡片
- 差异确认与取消
- 语音转写
- AI provider 设置与 fallback

### 部署与运维

- `docker compose up -d` 可直接跑通
- `.env.example`
- 初始化管理员
- 健康检查
- 数据卷挂载
- Postgres 持久化
- 邮件开发环境
- 最低限度日志和审计可导出

## 5.2 明确保留的 openport 现有能力

下列能力不能丢：

- `GET /api/agent/v1/manifest`
- `GET /api/agent/v1/ledgers`
- `GET /api/agent/v1/transactions`
- `POST /api/agent/v1/preflight`
- `POST /api/agent/v1/actions`
- `GET /api/agent/v1/drafts/:id`
- `GET/POST/PATCH/DELETE /api/agent-admin/v1/...`
- draft-first 默认策略
- 高风险动作 preflight + idempotency + state witness
- IP allowlist
- 数据范围限制
- 审计日志
- 可嵌入的 `DomainAdapter`

## 6. 复用策略

| 能力域 | 优先来源 | 处理方式 | 说明 |
| --- | --- | --- | --- |
| 协议内核 | 当前 `openport` | 保留并抽包 | 这是 OpenPort 的核心资产 |
| 用户认证 | Figena backend auth | 提炼后迁入产品 API | 已有注册/登录/refresh/email verify/CSRF |
| AI 会话与文件 | Figena AI 模块 | 提炼后迁入产品 API | 已有 session/message/file/draft/stream |
| OpenPort 管理后台 API | Figena agent module | 对齐 openport core 并抽象 | 比当前 demo 更接近生产 |
| Dashboard 壳层 | Figena frontend | 直接复用视觉结构 | React/Next 技术栈完全一致 |
| 聊天 UI | Figena `AiChatPanel` | 优先复用和裁剪 | 比移植 Open WebUI 更低风险 |
| 安装与发行方式 | Open WebUI | 借鉴结构，不直接拷贝 | Docker、compose、env、health |
| OAuth/SSO 扩展位 | Open WebUI | 设计预留 | v1 可不全部实现 |

## 6.1 Figena 抽取边界白名单 / 黑名单

这一节用于回答一个关键问题：优先抽取 Figena 的产品层能力，是否会泄露商业机密。

结论：

- 直接复制 Figena 产品层代码，存在明显泄露风险。
- 经过边界清洗后，只抽取“平台能力壳层”，风险可控。
- OpenPort 只能吸收通用产品能力，不能吸收 Figena 的业务实现、业务数据模型和产品策略。

### A. 允许抽取的白名单

以下内容可以作为 OpenPort 产品层的直接参考来源，但必须先做去品牌、去业务、去基础设施参数清洗。

#### 1. 认证与会话壳层

允许抽取类型：

- 注册 / 登录 / 退出接口结构
- refresh session 轮换机制
- CSRF 下发与校验模式
- 邮箱验证码 / 激活链接流程骨架
- 忘记密码 / 重置密码流程骨架
- 更换邮箱并重验证流程骨架

对应参考源：

- [auth.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/auth/auth.controller.ts)
- [auth.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/auth/auth.service.ts)
- [useSession.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/hooks/useSession.ts)
- [apiClient.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/lib/apiClient.ts)

允许保留的抽象：

- cookie session 模式
- csrf token 模式
- email verification 生命周期
- refresh token 撤销与轮换

#### 2. Dashboard / App Shell 壳层

允许抽取类型：

- Web 后台总体布局
- SessionProvider / WorkspaceProvider / AppShell 分层
- Dashboard 路由结构
- 顶栏、侧边栏、主内容区容器模式

对应参考源：

- [AppShell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/components/dashboard/AppShell.tsx)
- [layout.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/app/[locale]/dashboard/layout.tsx)
- [SessionProvider.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/components/dashboard/SessionProvider.tsx)

#### 3. OpenPort 控制台壳层

允许抽取类型：

- integration 管理页信息架构
- key 管理、policy、auto-execute 的页面布局
- drafts / audit / monitor tab 结构
- quickstart 面板交互方式

对应参考源：

- [openport/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/app/[locale]/dashboard/openport/page.tsx)
- [AgentIntegrationsPanel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/components/integrations/AgentIntegrationsPanel.tsx)
- [agent-admin.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/agent/agent-admin.controller.ts)
- [agent-admin.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/agent/agent-admin.service.ts)

允许保留的抽象：

- app/key 生命周期
- policy editor 结构
- auto-execute editor 结构
- 审计与草案 review 工作流

#### 4. AI 聊天容器层

允许抽取类型：

- chat session / message / file / stream 的通用形态
- 聊天页布局、附件区、流式渲染、草案确认区
- provider registry / fallback 配置壳层

对应参考源：

- [ai.module.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/ai/ai.module.ts)
- [ai.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/ai/ai.controller.ts)
- [ai.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/ai/ai.service.ts)
- [AiChatPanel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/components/ai/AiChatPanel.tsx)

允许保留的抽象：

- session/message/file/draft 数据流
- SSE 流式事件模型
- 聊天区 + 草案区双栏模式
- provider/model/fallback 配置模型

#### 5. 通用数据模型骨架

允许抽取类型：

- `users`
- `refresh_sessions`
- `email_verifications`
- `agent_apps`
- `agent_keys`
- `ai_sessions`
- `ai_messages`
- `ai_files`

对应参考源：

- [schema.prisma](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/prisma/schema.prisma)

但要求：

- 只能保留通用身份、会话、集成、聊天字段。
- 必须移除或改名任何 Figena 特有业务字段、产品字段和品牌字段。

### B. 禁止抽取的黑名单

以下内容不得进入 OpenPort 公共仓库，即使它们当前位于 Figena 产品层内部。

#### 1. 业务域模型和业务 flow

禁止抽取：

- 财务账本、交易、预算、资产、账户、客户、供应商、项目的具体业务实现
- 招聘、职位、候选人、pipeline、合规、模板的具体业务实现
- 库存、仓位、库存流水、成本层、批次、序列号的具体业务实现
- 预约、消息、里程、订阅、地图等具体业务实现

典型高风险来源：

- `Figena-Web/backend/src/ai/flows/*.handler.ts`
- `Figena-Web/backend/src/finance/*`
- `Figena-Web/backend/src/recruiting/*`
- `Figena-Web/backend/src/messaging/*`
- `Figena-Web/backend/prisma/schema.prisma` 中业务表

原因：

- 这些内容直接体现 Figena 的商业产品设计和业务语义，公开后会泄露领域模型和经营方向。

#### 2. 基础设施与运营参数

禁止抽取：

- 真实或半真实域名、邮件域名、bucket 名称、内部服务地址
- 部署拓扑、内部 API 基址、密钥来源和轮换策略细节
- quota 默认值、保留周期默认值、上传大小限制等运营策略

典型高风险来源：

- [.env.example](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/.env.example)

要求：

- OpenPort 必须重新定义自己的 env 名称和默认值。
- 所有示例地址必须使用通用占位符，不能沿用 Figena 命名。

#### 3. 品牌与产品定位文案

禁止抽取：

- `Cilila AI`
- `Figena`
- 面向 Figena 客群的营销文案
- 体现 Figena 商业定位的页面描述、默认标题、说明文字

高风险来源：

- 前端 messages 文案
- AI branding prompt
- 页面标题、副标题、help 内容

要求：

- OpenPort 所有品牌词全部参数化。
- 默认品牌应为 `OpenPort`，不能出现 Figena 品牌残留。

#### 4. 专有 RBAC 和 capability 命名

禁止抽取：

- 与 Figena 业务域绑定的 capability
- 对外暴露 Figena 内部组织权限策略
- 与具体业务模块耦合的角色模板

要求：

- OpenPort 只能保留通用 capability：
  - `integrations.read`
  - `integrations.settings.manage`
  - `integrations.drafts.review`
  - `integrations.audit.read`
  - `ai.use`
  - `ai.manage`

#### 5. AI 提示词中的产品策略

禁止抽取：

- Figena 的品牌系统 prompt
- 体现 Figena 商业策略的 assistant persona
- 面向 Figena 业务域的默认动作提示词和回复规则

高风险来源：

- `ai-branding.ts`
- 各业务 flow handler 中的 prompt 片段

要求：

- OpenPort 只能使用通用、无业务偏向的系统提示词。

### C. 抽取判定规则

每个候选文件都必须先判定，再决定是否进入 OpenPort。

判定问题：

1. 这个文件是否只提供“身份、会话、壳层、协议、通用 AI 容器”？
2. 这个文件是否包含具体业务实体、业务流程、行业术语或商业策略？
3. 这个文件是否暴露 Figena 品牌、域名、环境变量、运营参数？
4. 这个文件是否会让外部观察者反推出 Figena 的产品能力路线？

判定规则：

- 4 个问题里只要第 2/3/4 任一项为“是”，默认禁止抽取。
- 只有第 1 项为“是”且第 2/3/4 全部为“否”，才允许进入白名单。
- 无法判断时，按黑名单处理。

### D. 实施时的抽取方式

执行上必须遵守以下顺序：

1. 先复制结构，不复制业务代码。
2. 先重命名品牌、env、文案，再迁移逻辑。
3. 先抽接口和骨架，再按 OpenPort 语义重写实现。
4. 所有业务 flow handler 一律留在 Figena 私有仓库，通过 adapter 对接。

推荐执行法：

- 认证：参考实现，重写 OpenPort 版
- Dashboard 壳层：可直接复用 UI 容器，但移除业务导航项
- OpenPort 控制台：可保留交互模式，重写数据模型映射
- AI 聊天：保留 UI 结构与流式机制，删除所有 Figena 业务卡片和业务预览组件

### E. 当前建议的实际白名单文件级别起点

可以优先研究并提炼，但不能原样复制公开的文件：

- [auth.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/auth/auth.controller.ts)
- [auth.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/auth/auth.service.ts)
- [AppShell.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/components/dashboard/AppShell.tsx)
- [useSession.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/hooks/useSession.ts)
- [SessionProvider.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/components/dashboard/SessionProvider.tsx)
- [openport/page.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/app/[locale]/dashboard/openport/page.tsx)
- [AgentIntegrationsPanel.tsx](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/frontend/src/components/integrations/AgentIntegrationsPanel.tsx)
- [ai.controller.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/ai/ai.controller.ts)
- [ai.service.ts](/Users/Sebastian/Fidelock-Multiple-%20Platform/Figena-Web/backend/src/ai/ai.service.ts)

这些文件的正确用途是：

- 学结构
- 学边界
- 学交互组织方式

不是：

- 直接复制到 OpenPort 公共仓库
- 连同业务 handler 一起搬运
- 保留原始品牌与参数命名

## 7. 详细设计规范

## 7.1 用户与工作区模型

推荐直接参考 Figena 的成熟表结构，并做产品化净化。

最小必备表：

- `users`
- `refresh_sessions`
- `email_verifications`
- `organizations`
- `org_members`
- `service_accounts` 或直接复用 `users.is_service_account`
- `agent_apps`
- `agent_keys`
- `agent_action_drafts`
- `agent_action_executions`
- `agent_audit_logs`
- `ai_sessions`
- `ai_messages`
- `ai_files`
- `ai_action_drafts`
- `ai_provider_settings`

建议保留的关键字段：

- `users.email_verified_at`
- `users.role`
- `users.scopes`
- `agent_apps.scope`
- `agent_apps.service_user_id`
- `agent_apps.policy`
- `agent_apps.auto_execute`
- `agent_keys.token_hash`
- `agent_action_drafts.preflight_hash`
- `agent_action_drafts.policy_snapshot`
- `ai_messages.provider`
- `ai_messages.model`
- `ai_messages.usage`

## 7.2 鉴权规范

### Web 用户鉴权

采用 Figena 已验证的模式：

- Access token 放 HttpOnly cookie
- Refresh token 放 HttpOnly cookie
- `POST /auth/refresh` 静默续期
- `GET /auth/csrf` 下发 CSRF token
- 写接口要求 `x-csrf-token`

### Agent 鉴权

保留当前 OpenPort 模式：

- `Authorization: Bearer <agent key>`
- 数据库存储 hash，不保存明文 token
- key 可撤销、过期、轮换
- 按 app scope、policy、IP、租户边界做二次检查

### Step-up 鉴权

审批高风险操作时，增加 step-up：

- 邮箱验证码
- 或当前密码验证
- 后续可扩展 TOTP / WebAuthn

这部分可直接参考 Figena 的 `AgentAdminController` 和 `AgentAdminService` 设计。

## 7.3 RBAC 规范

最小 capability 集合建议为：

- `integrations.read`
- `integrations.settings.manage`
- `integrations.drafts.review`
- `integrations.audit.read`
- `ai.read`
- `ai.use`
- `ai.manage`
- `workspace.members.manage`
- `workspace.settings.manage`

默认角色：

- `owner`
- `admin`
- `operator`
- `auditor`
- `viewer`

要求：

- 所有 workspace app 必须通过 capability 判定可见与可管理范围。
- 个人 app 只允许 app owner 管理。
- 审计导出必须单独 capability。

## 7.4 前端路由规范

建议使用以下路由结构：

### 公共页

- `/login`
- `/register`
- `/verify-email`
- `/forgot-password`
- `/reset-password`

### 应用页

- `/dashboard`
- `/dashboard/openport`
- `/dashboard/openport?tab=integrations`
- `/dashboard/openport?tab=drafts`
- `/dashboard/openport?tab=audit`
- `/dashboard/openport?tab=monitor`
- `/dashboard/ai`
- `/dashboard/settings/account`
- `/dashboard/settings/workspace`

### 管理页

- `/admin/users`
- `/admin/settings/auth`
- `/admin/settings/ai`
- `/admin/settings/email`
- `/admin/settings/deployment`

说明：

- 路由分层借鉴 Open WebUI 的 `(app)`、`admin`、`workspace` 分离思路。
- 具体实现采用 Figena 的 App Router 壳层与 context provider 模式。

## 7.5 聊天界面规范

聊天界面不建议抄 Open WebUI 的 Svelte 组件，建议直接以 Figena `Cilila AI` 为母版。

### 目标布局

- 左侧：会话列表和筛选
- 中间：消息流、输入框、附件区、流式输出
- 右侧：草案卡片、结构化字段确认、执行结果、上下文资源卡

### 必备交互

- 文本输入
- 文件拖拽上传
- SSE 流式回包
- 解析状态提示
- AI 生成草案后的确认/取消
- 草案与最终执行结果关联
- 会话内显示“本次操作将生成 OpenPort draft”

### 组件来源

直接复用优先级：

1. `Figena-Web/frontend/src/components/ai/AiChatPanel.tsx`
2. Figena 的卡片、按钮、Modal、Popover、DatePicker、Toast
3. Open WebUI 仅参考信息架构和互动密度

### UI 风格要求

- 保留 Figena/Cilila 已有现代工作台风格
- 不引入 Open WebUI 的品牌元素、图标或 Svelte 结构
- 对 OpenPort 进行品牌替换：所有“Cilila AI”文案需抽成可配置 branding

## 7.6 OpenPort 控制台规范

以 Figena `AgentIntegrationsPanel` 为基础，整理成产品版控制台。

模块拆分：

- Integration List
- Create Integration Wizard
- Policy Editor
- Auto Execute Editor
- Key Rotation Drawer
- Draft Review Queue
- Audit Explorer
- Quickstart Playground

新增要求：

- 首页提供“复制 SDK 配置”和“复制 curl”快捷入口
- 提供 app health / recent errors / last used 时间
- 审计页支持 CSV 导出
- 草案页支持筛选：draft/confirmed/canceled/failed
- Quickstart 页面展示当前 `manifest` 和 tool 列表

## 7.7 部署规范

### 本地开发

最低本地栈：

- `web`
- `api`
- `postgres`
- `redis`
- `mailpit`
- `minio` 或直接 R2 dev bucket

### 生产部署

第一优先级必须支持：

- Docker Compose
- 单独 `web` / `api` 镜像
- Postgres 外置
- Redis 外置
- S3/R2 外置

第二优先级再支持：

- Helm Chart
- Kustomize
- Render / Railway / Fly.io 模板

### 安装体验

必须达到接近 Open WebUI 的体验：

- 文档第一屏给出 `docker compose up -d`
- 启动后直接访问 Web
- 首次启动自动创建初始化向导
- 没有管理员时允许创建首个 admin
- env 缺失时启动前失败并给出清晰错误

### 环境变量分组

建议至少拆成：

- Core: `PORT`, `NODE_ENV`, `PUBLIC_BASE_URL`
- Database: `DATABASE_URL`, `DIRECT_DATABASE_URL`
- Auth: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_DOMAIN`, `COOKIE_SECURE`
- Email: `SMTP_*`, `VERIFY_LINK_BASE`
- AI: `OPENAI_*`, `GEMINI_*`, `AI_*`
- Storage: `S3_*` 或 `R2_*`
- Cache/Queue: `REDIS_URL`
- Branding: `OPENPORT_APP_NAME`, `OPENPORT_LOGO_URL`, `OPENPORT_SUPPORT_URL`

## 8. 推荐实施阶段

## Phase 0: 架构冻结与边界锁定

产出：

- 明确 `openport-core` 与产品层边界
- 决定哪些 Figena 模块可抽取，哪些必须重新命名/去业务化
- 整理 API 契约兼容清单

退出标准：

- 不再讨论是否“直接把 Figena 整仓搬进来”
- 完成模块映射表

## Phase 1: 持久化与数据层

任务：

- 为 OpenPort 产品层建立 Prisma schema
- 将 `InMemoryStore` 对应对象迁移到持久化仓储接口
- 保留 reference runtime 的 in-memory 版本用于测试

退出标准：

- `agent_apps`、`agent_keys`、`agent_drafts`、`agent_audit_logs` 全部可持久化
- 现有核心测试迁移到 DB-backed 与 memory-backed 双模式

## Phase 2: 认证与工作区

任务：

- 引入 AuthModule
- 实现 register/login/logout/refresh/csrf
- 接入 email verification / reset password
- 建立 organizations / org_members / service account

退出标准：

- 用户可通过 Web 完成注册、登录、验证邮箱、进入 dashboard
- workspace app 与 personal app 均可创建

## Phase 3: OpenPort 管理后台

任务：

- 接入 `agent-admin/v1` 的数据库版实现
- 完成前端 OpenPort 控制台页面
- 接入 key 管理、policy、auto-execute、draft review、audit

退出标准：

- 后台可以完整覆盖当前 `src/app.ts` 中所有 admin 能力
- 不再依赖 `x-admin-user` header

## Phase 4: AI 工作台

任务：

- 抽取 Figena `AiModule` 与 `AiChatPanel`
- 接入 AI session/message/file/draft/stream
- 将 AI 草案与 OpenPort draft 统一展示

退出标准：

- `/dashboard/ai` 可发起对话、上传文件、生成结构化 draft、确认执行

## Phase 5: 开箱部署

任务：

- 编写 `Dockerfile`、`docker-compose.yml`
- 提供 `.env.example`
- 增加 bootstrap admin 流程
- 增加 health/readiness endpoints

退出标准：

- 一条 compose 命令启动完整栈
- 文档可从零复现

## Phase 6: 稳定性与发布

任务：

- 合并现有 `openport` 协议测试与产品层 E2E
- 增加 auth、RBAC、chat、draft approval、audit export E2E
- 提供 release checklist

退出标准：

- `openport-core` 与产品层都能独立发布

## 9. 兼容性要求

产品化过程中必须遵守以下约束：

- 不破坏 `createOpenPortRuntime()` 的现有嵌入式用法。
- 不删除 `src/reference-server.ts` 对应的 demo 能力，至少在过渡期保留。
- 不修改 `spec/openport-v1.openapi.yaml` 的既有契约，除非做版本升级。
- `test/app.test.ts`、`test/security-controls.test.ts` 等安全行为必须继续通过。
- 当前 `memory` / `postgres` / `prisma` domain adapter 模式都要保留。

## 10. 风险与规避

### 风险 1: 直接把 Figena 代码整体复制进 openport，导致业务污染

规避：

- 只抽基础能力：auth、rbac、ai shell、agent admin
- 所有财务/招聘/库存等业务词汇必须回退成 OpenPort 通用资源层或 adapter 层

### 风险 2: 过早移植 Open WebUI 前端，导致技术栈失配

规避：

- Open WebUI 只参考部署方式、安装体验、路由分层、配置模式
- Web UI 代码源以 Figena React/Next 为准

### 风险 3: 产品层侵入协议层，破坏 OSS 边界

规避：

- 协议层保持无用户表、无组织表、无邮件、无 RBAC 依赖
- 产品层通过 adapter / service 包装 core

### 风险 4: 一次性大迁移导致不可控

规避：

- 先增量加 `apps/api`、`apps/web`
- 等产品稳定再重构 `packages/openport-core`

## 11. Definition of Done

只有满足下面条件，才能认为 `openport` 已经达到“像 Open WebUI 一样开箱即用”：

- 新用户可在 Web 注册、验证邮箱、登录。
- 登录后可进入 dashboard。
- 可创建 workspace。
- 可在 `/dashboard/openport` 创建 integration、生成 key、限制 policy、审批草案、查看 audit。
- 可在 `/dashboard/ai` 进行聊天、上传附件、触发结构化动作。
- 协议接口仍然可被外部 agent 调用。
- `docker compose up -d` 可启动完整环境。
- 至少提供一份生产部署文档和一份本地开发文档。

## 12. 最终建议

最合理的落地路径不是“把当前 openport 继续补页面”，而是：

1. 把当前 `openport` 固定为协议内核。
2. 以 Figena 的 `AuthModule`、`AgentModule`、`AiModule`、Dashboard 壳层、`AiChatPanel` 为产品层主要来源。
3. 以 Open WebUI 的 Docker-first、自托管、配置中心化、admin/workspace 分层方式作为发行和部署模板。
4. 最终交付一个“core + api + web + deploy”四件套的 OpenPort 产品版。

这条路径复用率最高、风险最低，也最符合你要的结果：既保留 openport 现有功能，又让它真正具备完整的部署、注册登录、后台与聊天体验。
