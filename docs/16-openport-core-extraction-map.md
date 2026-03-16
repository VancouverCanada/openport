# OpenPort Core 抽包迁移清单

本文件用于指导把当前仓库根目录 `src/` 逐步迁移到 `packages/openport-core/`。

原则：

- 先抽“协议内核”，后抽“启动器和产品壳层”。
- 先迁移纯逻辑和类型，后迁移依赖运行路径的文件。
- 迁移过程中必须保证根目录现有 build/test 可继续工作。

## 1. 迁移目标

最终目标：

- `packages/openport-core/src/` 成为协议内核唯一实现位置。
- `packages/openport-product-contracts/src/` 成为 `apps/api` 与 `apps/web` 的共享产品契约位置。
- 根目录或 `apps/reference-server/` 仅保留 demo server / bootstrap 逻辑。
- 后续 `apps/api` 可以直接依赖 `openport-core`。

## 2. 第一批优先迁移文件

这些文件最适合第一轮迁移，因为它们主要是纯逻辑、类型和协议规则：

- `src/types.ts`
- `src/error-codes.ts`
- `src/errors.ts`
- `src/utils.ts`
- `src/ip-policy.ts`
- `src/policy.ts`
- `src/rate-limit.ts`
- `src/audit.ts`
- `src/store.ts`
- `src/auth.ts`

迁移方式：

- 先复制到 `packages/openport-core/src/`
- 再让根目录 `src/` 通过 re-export 或薄包装兼容
- 等所有入口切换完成后，再删除旧实现

当前状态：

- 已完成复制到 `packages/openport-core/src/`
- 已完成切换根目录 `src/` 的导入来源
- 已完成建立 re-export 兼容层

## 3. 第二批迁移文件

这些文件是核心运行时的一部分，但依赖更多内部模块关系：

- `src/tool-registry.ts`
- `src/agent-engine.ts`
- `src/admin-engine.ts`
- `src/runtime.ts`
- `src/index.ts`

迁移要求：

- 保持对外 API 名称不变
- `createOpenPortRuntime()` 的调用方式不变
- 测试需在迁移前后等价通过

当前状态：

- 已完成：
  - `src/tool-registry.ts`
  - `src/agent-engine.ts`
  - `src/admin-engine.ts`
- 已完成：
  - `src/runtime.ts`
  - `src/adapters/postgres-domain-adapter.ts`
  - `src/adapters/prisma-domain-adapter.ts`
- 未完成：
  - 根目录 `src/app.ts` 与 `src/reference-server.ts` 的最终迁移
  - `apps/reference-server/` 的独立化

## 4. 暂缓迁移文件

这些文件应在 core 抽包稳定后再处理：

- `src/app.ts`
- `src/reference-server.ts`

原因：

- 它们更接近 demo/reference runtime，而不是协议内核
- 未来更适合移动到 `apps/reference-server/`

## 5. 适配器文件策略

以下文件保留在 core 内，但要继续保持 adapter 边界清晰：

- `src/domain.ts`
- `src/adapters/postgres-domain-adapter.ts`
- `src/adapters/prisma-domain-adapter.ts`

要求：

- 不引入产品级用户认证或工作区模型
- 继续作为嵌入式 runtime 的公开能力

## 6. 当前状态

- 已完成：目录占位 `packages/openport-core/`
- 已完成：新增 `packages/openport-product-contracts/` 共享契约包
- 已完成：迁移顺序定义
- 已完成：共享 TypeScript 基线 `tsconfig.base.json`
- 已完成：`packages/openport-core/package.json`
- 已完成：`packages/openport-product-contracts/package.json`
- 已完成：第一批文件复制与独立编译验证
- 已完成：第二批主要运行时文件复制与独立编译验证
- 已完成：`runtime.ts` 与 adapters 迁移及独立编译验证
- 已完成：根目录 `src/` 兼容层与入口切换
- 已完成：根目录 `build/dev/test` core-first 脚本调整
- 已验证：`npm run build` 通过
- 已阻塞记录：`npm test` 受本机 Node 14 限制，需切换到 Node 20+ 后再验证
- 已完成：`apps/api` 产品 API 工程骨架初始化，并通过 provider 接入 `openport-core`
- 已完成：`apps/api` 认证、工作区、RBAC、AI 与 OpenPort 管理模块壳层
- 已完成：`apps/web` auth / dashboard / chat 工程骨架初始化
- 已完成：`apps/web` auth / dashboard / integrations / chat 与 `apps/api` 路由契约接通
- 已完成：`apps/reference-server` 独立工程骨架初始化
- 已完成：根级 env / compose / docker / 多应用脚本骨架
- 已完成：根目录 reference runtime 已隔离为 legacy compatibility layer
- 已完成：运行时 env 校验与 healthcheck 骨架
- 已完成：统一运行规范文档与产品预检脚本
- 已完成：compose `.env` 路径修正与失败指引文档
- 已完成：`apps/api` / `apps/web` 共享产品契约抽取与类型对齐
- 已完成：产品验收执行器与重试型健康检查链路
- 已完成：Node 20+ 产品应用编译验收模式与 GitHub Actions 工作流
- 已完成：产品环境引导脚本与 Node 版本声明文件
- 已完成：compose 配置预检入口与自动 `.env` 准备
- 已完成：compose 健康门控依赖链
- 已完成：Docker daemon 预检入口与 `.dockerignore`
- 已完成：compose 镜像构建验收入口与 CI 工作流
- 已验证：`npx tsc -p packages/openport-product-contracts/tsconfig.json` 通过
- 已验证：`npm run build` 继续通过，且默认先构建 contracts + core
- 已阻塞记录：`npm run acceptance:local` 已验证会在 Node 14 环境准确停在 `preflight:product` 的版本检查
- 已验证：`npm run acceptance:apps` 已在 Node 22 环境完整通过
- 已完成：`apps/web` Next 构建配置与 `JSX.Element` 兼容性修正
- 已验证：`npm run acceptance:services` 与 `npm run acceptance:full` 已在 Node 22 环境通过
- 已完成：默认环境自动切换现代 Node 的脚本包装层 `scripts/with-modern-node.sh`
- 已完成：受管产品栈脚本 `start:product` / `status:product` / `stop:product`
- 已验证：`npm run start:product` 已可在默认 Node 14 shell 下自动切到 Node 22 并成功启动产品栈
- 已验证：`npm run status:product` 与 `npm run health:product` 已可读取动态端口并确认三应用存活
- 已验证：当前本机可直接使用产品入口 `http://127.0.0.1:3100`
- 已完成：Compose 宿主机端口参数化与 `.env` host-port 约定
- 已完成：共享包 Docker 构建依赖补齐（`typescript` / `@types/node` / `@types/pg`）
- 已完成：三个 Dockerfile 补齐 `tsconfig.base.json` 复制
- 已验证：`npm run docker:preflight` 已通过
- 已验证：`npm run acceptance:images` 已在 Node 22 + Docker daemon 环境完整通过
- 已验证：`npm run compose:config` 可正常解析当前 Docker Compose 编排
- 已验证：`npm run acceptance:compose` 已在 Node 22 + Docker daemon 环境通过
- 已验证：当前 Docker Compose 产品栈可直接使用：
  - `reference-server`: `http://127.0.0.1:8080`
  - `api`: `http://127.0.0.1:4100/api`
  - `web`: `http://127.0.0.1:3100`
- 下一步：当前“直接启动和使用”与 Docker 产品验收目标都已完成，后续只剩发布级硬化与真实业务能力补全
