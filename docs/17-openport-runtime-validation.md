# OpenPort 运行与验证规范

本文件定义当前产品化骨架的统一启动入口、健康检查端点和验证顺序。

只记录已经在仓库落地的入口，不描述未来假设中的命令。

## 1. 运行矩阵

| 应用 | 目录 | 默认端口 | 启动命令 | 健康端点 |
| --- | --- | --- | --- | --- |
| Reference Runtime | `apps/reference-server` | `8080` | `npm run dev:reference` | `GET /healthz` |
| Product API | `apps/api` | `4000` | `npm run dev:api` | `GET /api/health` |
| Product Web | `apps/web` | `3000` | `npm run dev:web` | `GET /api/health` |

## 2. 根目录统一命令

当前根包已经提供以下入口：

```bash
npm run build:contracts
npm run build:core
npm run build:reference
npm run build:api
npm run build:web

npm run dev:reference
npm run dev:api
npm run dev:web
npm run start:product
npm run status:product
npm run stop:product

npm run compose:up
npm run compose:down
npm run compose:config
npm run compose:build
npm run docker:preflight
npm run preflight:product
npm run acceptance:local
npm run acceptance:apps
npm run acceptance:images
npm run acceptance:services
npm run acceptance:full
npm run acceptance:compose
npm run health:product
```

相关失败排查请同时参考：

- `docs/18-openport-validation-failure-guide.md`

## 3. 启动前要求

### Node 版本

- `apps/api`
- `apps/web`
- `apps/reference-server`

都要求 `Node >=20`。

如果仍在 Node 14，本地只能继续维护根目录兼容构建，不能作为产品化验证环境。

### 环境变量

最小要求：

```bash
npm run env:product
```

`compose/docker-compose.yml` 当前读取的是根目录 `.env`，不是 `.env.example`。

`npm run env:product` 会：

- 在 `.env` 缺失时按 `.env.example` 创建
- 在 `.env` 已存在时补齐缺失 key

关键变量：

- `NEXT_PUBLIC_OPENPORT_API_BASE_URL`
- `PORT`
- `HOST`
- `OPENPORT_DOMAIN_ADAPTER`
- `OPENPORT_DATABASE_URL`
- `REFERENCE_PORT`
- `REFERENCE_HOST`

当 `OPENPORT_DOMAIN_ADAPTER=postgres` 时：

- `apps/api`
- `apps/reference-server`

都会在启动前强制校验 `OPENPORT_DATABASE_URL`。

## 4. 健康检查要求

### Reference Runtime

- 路径：`GET /healthz`
- 用途：reference runtime 容器和本地 demo 运行探针

### Product API

- 路径：`GET /api/health`
- 当前响应：
  - `status`
  - `service`
  - `phase`
  - `domainAdapter`

### Product Web

- 路径：`GET /api/health`
- 当前响应：
  - `status`
  - `service`
  - `apiBaseUrl`

## 5. Docker 骨架要求

当前仓库已落地：

- `compose/docker-compose.yml`
- `docker/reference-server.Dockerfile`
- `docker/api.Dockerfile`
- `docker/web.Dockerfile`

并且三个容器都已经声明 `HEALTHCHECK`。

当前状态：

- Docker 骨架已存在
- 端到端 compose 启动尚未在当前环境执行验证
- `npm run compose:config` 可先验证编排是否可被 Docker 正常解析
- compose 依赖链已切到 health-gated 启动：
  - `postgres` 使用 `pg_isready`
  - `api` / `reference-server` 等待健康的 `postgres`
  - `web` 等待健康的 `api`

## 6. 统一验证顺序

推荐顺序：

1. `npm run preflight:product`
2. `npm run build`
3. 在 Node 20+ 环境执行：
   - `npm run env:product`
   - `npm --prefix packages/openport-product-contracts install`
   - `npm --prefix packages/openport-core install`
   - `npm --prefix apps/reference-server install`
   - `npm --prefix apps/api install`
   - `npm --prefix apps/web install`
4. 执行：
   - `npm run build:reference`
   - `npm run build:api`
   - `npm run build:web`
5. 分别启动三个应用，检查健康端点。
6. 执行：
   - `npm run health:reference`
   - `npm run health:api`
   - `npm run health:web`
6. 最后执行：
   - `npm run compose:up`
7. 再次执行：
   - `npm run health:product`

也可以直接使用统一执行器：

- `npm run acceptance:local`
  - 执行 `preflight:product + build`
- `npm run acceptance:apps`
  - 执行 `preflight:product + build + build:reference + build:api + build:web`
- `npm run acceptance:images`
  - 执行 `env:product + preflight:product + docker:preflight + compose:config + compose:build`
- `npm run acceptance:services`
  - 仅检查已经启动的 `reference + api + web`
- `npm run acceptance:full`
  - 执行 `preflight:product + build + health:product`
- `npm run acceptance:compose`
  - 执行 `env:product + preflight:product + docker:preflight + compose:up + health:product`

健康重试参数：

- `OPENPORT_HEALTH_ATTEMPTS`
- `OPENPORT_HEALTH_DELAY_MS`

一键托管启动：

- `npm run start:product`
  - 自动切换到 Node >=20
  - 自动选择非冲突端口
  - 自动写入 `.openport-product/runtime.json`
- `npm run status:product`
  - 查看当前 URL、PID、日志路径
- `npm run health:product`
  - 当存在 `.openport-product/runtime.json` 时，会优先检查当前托管实例的动态端口
- `npm run stop:product`
  - 停止由 `start:product` 启动的托管实例

CI 基线：

- `.github/workflows/product-validation.yml` 在 GitHub Actions 的 Node 20 环境执行：
  - `npm ci`
  - `npm run install:product`
  - `npm run env:product`
  - `npm run acceptance:apps`
- `.github/workflows/compose-build-validation.yml` 在 GitHub Actions 的 Node 20 环境执行：
  - `npm ci`
  - `npm run env:product`
  - `npm run docker:preflight`
  - `npm run acceptance:images`

## 7. 当前阻塞

当前仓库已无仓库级运行阻塞。

已实际验证通过：

- `npm run acceptance:apps`
- `npm run acceptance:images`
- `npm run acceptance:compose`

当前 Docker Compose 验收端口：

- `reference-server`: `http://127.0.0.1:8080`
- `api`: `http://127.0.0.1:4100/api`
- `web`: `http://127.0.0.1:3100`

## 8. 通过标准

产品化运行基线视为通过，至少需要满足：

- `npm run preflight:product` 通过
- `npm run build` 通过
- `apps/api` / `apps/web` / `apps/reference-server` 在 Node 20+ 环境独立编译通过
- 三个健康端点都返回 `200`
- `docker compose up -d` 能完成启动
