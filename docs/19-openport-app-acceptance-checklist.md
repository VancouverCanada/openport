# OpenPort 应用验收清单

本文件把 `api` / `web` / `reference-server` 的安装、启动、健康检查命令固定下来。

目标是让 Node 20+ 环境里的第一次验收可以按顺序执行，而不是手工拼装命令。

## 1. 安装命令

```bash
npm run env:product
npm --prefix packages/openport-product-contracts install
npm --prefix packages/openport-core install
npm --prefix apps/reference-server install
npm --prefix apps/api install
npm --prefix apps/web install
```

根目录也提供统一入口：

```bash
npm run install:product
```

## 2. 构建命令

```bash
npm run build:contracts
npm run build
npm run build:reference
npm run build:api
npm run build:web
```

## 3. 启动命令

```bash
npm run dev:reference
npm run dev:api
npm run dev:web
```

一键启动：

```bash
npm run start:product
npm run status:product
npm run health:product
npm run stop:product
```

## 4. 健康检查命令

单独检查：

```bash
npm run health:reference
npm run health:api
npm run health:web
```

统一检查：

```bash
npm run health:product
```

统一执行器：

```bash
npm run acceptance:local
npm run acceptance:apps
npm run acceptance:images
npm run acceptance:services
npm run acceptance:full
npm run acceptance:compose
```

Node 20+ CI 入口：

```bash
npm run env:product
npm run install:product
npm run acceptance:apps
```

## 5. 期望端点

| 应用 | 健康端点 |
| --- | --- |
| reference-server | `http://127.0.0.1:8080/healthz` |
| api | `http://127.0.0.1:4000/api/health` |
| web | `http://127.0.0.1:3000/api/health` |

这些地址可以通过环境变量覆盖：

- `OPENPORT_REFERENCE_HEALTH_URL`
- `OPENPORT_API_HEALTH_URL`
- `OPENPORT_WEB_HEALTH_URL`
- `OPENPORT_HEALTH_ATTEMPTS`
- `OPENPORT_HEALTH_DELAY_MS`

## 6. Compose 验收

```bash
npm run env:product
npm run docker:preflight
npm run compose:config
npm run compose:build
npm run preflight:product
npm run compose:up
npm run health:product
```

当前 compose 启动顺序已经健康门控：

- `postgres` 先通过 `pg_isready`
- `api` / `reference-server` 再启动
- `web` 最后等待 `api` 健康

## 7. 通过标准

至少满足：

1. `npm run preflight:product`
2. `npm run build`
3. 三个单独 build 通过
4. 三个健康检查通过
5. `npm run compose:up` 后健康检查仍然通过
