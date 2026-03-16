# OpenPort OSS / Cloud 分版方案

本文件定义 `openport-oss` 与 `openport-cloud` 的实施边界，用来同时满足：

- 本地部署版可公开发布、可自托管、可社区协作
- 云端多租户版保持私有商业实现，不向外暴露代码和内部策略

## 1. 版本决策

### 1.1 OpenPort OSS

- 许可：`AGPL-3.0-or-later`
- 形态：公开仓库、可自托管、可二次开发
- 目标用户：单机用户、私有化用户、开发者、集成方

### 1.2 OpenPort Cloud

- 许可：私有商业许可
- 形态：私有仓库和私有包，不对外公开源码
- 目标用户：多用户云端托管、商业订阅、企业版客户

### 1.3 品牌边界

- 代码许可与品牌权分离
- `OpenPort` 名称、logo、官方视觉和品牌表述不随 AGPL 自动授权
- 品牌使用规则单独见根目录 `TRADEMARK_POLICY.md`

## 2. 可见性边界

### 2.1 对外公开的部分

- `packages/openport-core`
- `packages/openport-product-contracts`
- `apps/web` 的 OSS 前端壳层
- `apps/api` 的 OSS 产品 API 能力
- `apps/reference-server`
- Docker / Compose / 文档 / 示例 / 验收脚本

### 2.2 建议保留在私有边界的部分

- 多租户云端运营逻辑
- 商业配额、订阅、计费、账单和收入相关代码
- 云端管理后台和内部运营工具
- 私有 prompt、内部策略规则、内部模型路由
- 生产基础设施参数、内部域名、私有对象存储配置
- `openport-cloud` 的具体实现代码

## 3. 功能矩阵

| 能力 | `openport-oss` | `openport-cloud` |
| --- | --- | --- |
| 本地部署 / 私有化 | 是 | 是 |
| Docker 一键启动 | 是 | 是 |
| 单实例 owner/admin | 是 | 是 |
| 基础登录 / 会话 | 是 | 是 |
| Dashboard / Integrations / Chat 壳层 | 是 | 是 |
| OpenPort 协议运行时 | 是 | 是 |
| 多工作区 / 多租户组织 | 否 | 是 |
| 团队邀请 / 复杂 RBAC | 限基础能力 | 是 |
| 配额 / 计费 / 订阅 | 否 | 是 |
| 企业 SSO / 托管运维 | 否 | 是 |
| 云端运营后台 | 否 | 是 |

## 4. 代码组织原则

### 4.1 OSS 仓库

OSS 仓库只包含开源底座和单机 / 私有化默认实现：

- OpenPort 协议核心
- 可运行的参考服务
- 本地部署用 Web / API 壳层
- 通用认证和产品契约
- 与自托管直接相关的部署脚本

### 4.2 Cloud 仓库

Cloud 仓库只做商业扩展，并依赖 OSS 底座：

- 多租户 tenancy
- 商业 RBAC 扩展
- 邀请、计费、订阅、配额
- 企业连接器和云托管后台

Cloud 建议通过私有 repo、私有 package 或私有 monorepo workspace 引用
OSS，保持公开仓库与商业实现的边界清晰。

## 5. 实施约束

### 5.1 允许抽取的内容

- 通用认证壳层
- session / refresh / csrf / email verification 的通用机制
- Dashboard / Integrations / Chat 的通用 UI 容器
- 与 OpenPort 协议有关的通用 API 层

### 5.2 禁止抽取的内容

- Figena 或其他商业产品的具体业务流程
- 业务域 schema、专有字段和运营规则
- 私有基础设施命名和内部环境变量
- 商业品牌文案和内部提示词

## 6. 发布与治理规则

- 公开仓库使用 `AGPL-3.0-or-later`
- 品牌规则使用单独的 `TRADEMARK_POLICY.md`
- `openport-cloud` 维持私有商业许可
- 公开文档中只描述扩展接口和部署方式，不披露云端私有架构细节

## 7. 当前仓库的执行结论

对当前 `openport` 仓库，执行方式如下：

- 当前仓库可作为 `openport-oss` 基线
- 根 `LICENSE` 切换为 `AGPL-3.0-or-later`
- 根目录新增 `TRADEMARK_POLICY.md`
- `apps/web`、`apps/api`、`apps/reference-server` 作为 OSS 可运行产品底座继续保留
- 未来如建设 `openport-cloud`，优先放入独立私有仓库或私有工作区

## 8. 下一步

- 按 OSS / Cloud 边界继续收敛模块归属
- 在后续发布说明中明确 OSS 能力范围
- 确保任何新增云端商业能力先在私有边界中实现，再通过接口接入 OSS
