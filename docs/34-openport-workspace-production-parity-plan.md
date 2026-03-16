# OpenPort Workspace 生产态对齐方案

## 目标

在已完成 Workspace CRUD、collection 组织、prompt 版本历史、tool valves 编辑的前提下，继续向 Open WebUI 的更完整工作区产品态靠拢：

- `Prompts`：引入 production version 语义，区分历史版本与当前生产版本
- `Tools`：把 `valves` 从单纯运行时键值扩展成可描述的 schema 结构
- `Models`：补默认模型策略和更快的默认切换入口

本轮优先参考本地 `open-webui-main` 的这些实现，而不逐文件照搬：

- `backend/open_webui/models/prompts.py`
- `src/lib/components/workspace/Prompts/PromptEditor.svelte`
- `src/lib/apis/prompts/index.ts`
- `backend/open_webui/models/tools.py`
- `src/lib/components/workspace/Tools/ToolkitEditor.svelte`

## 设计原则

### 1. 继续保留 OpenPort 的资源命名

本轮不改名：

- `Workspace`
- `Models`
- `Knowledge`
- `Prompts`
- `Tools`

### 2. 优先补强已有资源模型，不新增平行系统

本轮继续扩展：

- `packages/openport-product-contracts`
- `apps/api/src/storage`
- `apps/api/src/workspace-resources`
- `apps/web/src/components/workspace-*`

### 3. 优先做真正影响产品使用心智的能力

本轮不再继续做纯视觉微调，重点是：

- prompt 生产版本
- tool schema 化配置
- default model 策略收口

## 具体实施

### Step 1. Prompts 增加 production version

参考 Open WebUI `PromptModel.version_id` 和 `setProductionPromptVersion`：

- 在 `OpenPortWorkspacePrompt` 上新增 `productionVersionId`
- prompt 创建首个版本时默认设为 production
- prompt 更新时支持 `setAsProduction`
- 新增显式接口：
  - `POST /workspace/prompts/:id/versions/:versionId/production`
- 前端编辑器支持：
  - 保存时 `Set as production`
  - 历史版本里 `Set production`
  - 对 production version 给出明确标识

### Step 2. Tools 增加 valve schema

参考 Open WebUI `Tool.meta/specs/valves` 分层思路：

- 在 `OpenPortWorkspaceTool` 上新增 `valveSchema`
- `valveSchema` 存结构化字段：
  - `key`
  - `label`
  - `type`
  - `description`
  - `defaultValue`
  - `required`
- 继续保留现有 `valves` 作为实际默认值容器
- 编辑器里把 schema 和 runtime valves 分开

### Step 3. Models 收口默认策略

补一层真正可用的 default strategy：

- 第一个 model 自动成为 default
- 更新时不允许工作区进入“完全没有 default model”的状态
- 删除 default model 时自动把剩余第一个 model 升为 default
- list 页补：
  - `Default strategy` filter
  - `Make default` 快捷动作

### Step 4. 验证和文档收口

完成后必须验证：

- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`

运行态至少检查：

- prompt production version 设置接口
- tool schema 的创建和读取
- model 默认切换和删除 default 后的自动回退

## 验收标准

完成后应满足：

- `Prompts` 有明确 production version
- `Prompts` 支持显式切换 production version
- `Tools` 支持 schema 化 valves 编辑
- `Tools` 列表能看出 schema 信息
- `Models` 永远存在一个 default model
- `Models` 列表支持默认模型筛选和快捷切换

## 本轮边界

本轮仍不实现：

- Open WebUI 那套完整 prompt 权限和共享矩阵
- tool marketplace / remote registry
- model provider 级远程同步
- prompt branching / multi-branch version graph
