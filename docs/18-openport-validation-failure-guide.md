# OpenPort 验证失败指引

本文件记录当前产品化骨架最可能出现的失败点，以及建议处理顺序。

目标不是解释所有可能性，而是降低第一次在 Node 20+ / Docker 环境里验收时的试错成本。

## 1. `npm run preflight:product` 失败

### Node 版本过低

现象：

- 输出 `Node runtime v14... is below required version >=20`

处理：

1. 切换到 Node 20+
2. 重新执行 `npm run preflight:product`

说明：

- 根目录兼容构建仍可在旧环境维护
- `apps/api` / `apps/web` / `apps/reference-server` 不应在 Node 14 下验收

### `.env` 缺失

现象：

- 输出 `No .env file found`

处理：

```bash
npm run env:product
```

然后重新执行预检。

### `.env` 缺关键变量

现象：

- 输出 `.env is missing required key ...`

处理：

- 补齐预检列出的键
- 如果使用 `postgres` 模式，必须补 `OPENPORT_DATABASE_URL`

## 1.1 `npm run acceptance:*` 失败

验收执行器当前支持：

- `npm run acceptance:local`
- `npm run acceptance:apps`
- `npm run acceptance:images`
- `npm run acceptance:services`
- `npm run acceptance:full`
- `npm run acceptance:compose`

处理方式：

1. 先看失败发生在哪个 step：
   - `preflight`
   - `build`
   - `build-reference`
   - `build-api`
   - `build-web`
   - `compose-config`
   - `compose-build`
   - `compose-up`
   - `health`
2. 如果失败在 `preflight`，回到本文件第 1 节处理。
3. 如果失败在 `health`，回到本文件第 6 节处理。
4. 如果是 `compose` 模式下健康检查超时，可提高：
   - `OPENPORT_HEALTH_ATTEMPTS`
   - `OPENPORT_HEALTH_DELAY_MS`

## 2. `apps/api` 启动失败

优先检查：

1. `PORT`
2. `HOST`
3. `OPENPORT_DOMAIN_ADAPTER`
4. `OPENPORT_DATABASE_URL`

当前硬校验：

- 当 `OPENPORT_DOMAIN_ADAPTER=postgres` 时，如果没有 `OPENPORT_DATABASE_URL`，启动会直接失败

健康检查：

- `GET /api/health`

## 3. `apps/reference-server` 启动失败

优先检查：

1. `REFERENCE_PORT` 对应的 `PORT`
2. `REFERENCE_HOST` 对应的 `HOST`
3. `OPENPORT_DOMAIN_ADAPTER`
4. `OPENPORT_DATABASE_URL`

健康检查：

- `GET /healthz`

## 4. `apps/web` 启动正常但页面请求失败

优先检查：

1. `NEXT_PUBLIC_OPENPORT_API_BASE_URL`
2. `apps/api` 是否已启动
3. 浏览器里请求的 `/api/auth/*`、`/api/openport-admin/*`、`/api/ai/*` 是否可访问

健康检查：

- `GET /api/health`

## 5. Docker Compose 启动失败

优先检查：

1. 根目录是否存在 `.env`
2. `compose/docker-compose.yml` 使用的镜像和 Dockerfile 是否存在
3. 本机 Docker 是否可用
4. 端口 `3000`、`4000`、`5432`、`8080` 是否已被占用

当前 compose 约定：

- `compose/docker-compose.yml` 读取根目录 `.env`
- 不是读取 `.env.example`
- `npm run compose:up` 会先自动执行 `npm run env:product`
- `postgres` 现在使用 `pg_isready` 健康检查
- `api` / `reference-server` 依赖健康的 `postgres`
- `web` 依赖健康的 `api`

建议先跑：

```bash
npm run docker:preflight
npm run compose:config
```

如果 `docker:preflight` 失败，优先处理 Docker daemon 或当前 Docker context。
如果 `compose config` 都无法解析，再看 `.env`、端口和 Dockerfile。

如果 Docker Desktop 后台日志出现类似：

- `creating disk folder /Users/<old-user>/...: permission denied`

优先检查本机 Docker Desktop 配置文件：

- `~/Library/Group Containers/group.com.docker/settings-store.json`

确认其中的 `DataFolder` 没有指向历史用户名目录。

## 6. 健康检查失败

检查顺序：

1. 先确认进程是否成功监听端口
2. 再检查健康端点路径是否正确
3. 最后再检查容器内部访问地址是否与 `HEALTHCHECK` 一致

可执行命令：

```bash
npm run health:reference
npm run health:api
npm run health:web
npm run health:product
```

统一执行器：

```bash
npm run acceptance:apps
npm run acceptance:images
npm run acceptance:services
npm run acceptance:full
npm run acceptance:compose
```

当前路径：

- reference runtime: `GET /healthz`
- api: `GET /api/health`
- web: `GET /api/health`

如果使用 `npm run start:product`：

- 先执行 `npm run status:product`
- 再执行 `npm run health:product`

如果使用 `docker compose`：

- 先执行 `docker ps`
- 再执行 `docker logs compose-web-1`
- 确认 `web` 容器没有错误继承根 `.env` 的 `PORT`
- 如需排查详细原因，查看 `.openport-product/logs/`

## 7. 推荐排障顺序

1. `npm run preflight:product`
2. `npm run build`
3. 单独安装并编译 `apps/reference-server`
4. 单独安装并编译 `apps/api`
5. 单独安装并编译 `apps/web`
6. 分别检查健康端点
7. 最后执行 `npm run compose:up`
