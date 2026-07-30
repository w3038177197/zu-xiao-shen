# Redis 额度持久化生产验收指南

> 本文档说明如何在微信云托管配置 Upstash Redis REST，使小程序联网 AI 的每日额度和幂等缓存跨服务重启保留。
>
> 适用范围：`server/` 部署到微信云托管后，生产环境的额度持久化验收。
> 本机开发无需配置 Redis，额度存储自动降级为 `memory` 模式。

## 安全红线

- **不要把 Redis 凭据写进仓库**（`.env`、`render.yaml`、`server/` 代码、配置文件）
- **不要把 Redis 凭据粘贴到聊天记录或 TRAE 对话**
- **不要截图包含 Redis 凭据的控制台页面**
- `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN` 只在微信云托管控制台的环境变量中填写
- 仓库中的 `.env.example` 仅作占位说明，不包含真实值

## 当前实现链路

| 组件 | 文件 | 作用 |
|------|------|------|
| 额度存储 | [server/miniapp-usage-store.mjs](file:///e:/web-dev/contract-guardian/server/miniapp-usage-store.mjs) | 双模式：`redis-rest`（生产）/ `memory`（开发）；原子脚本预占/回滚/缓存 |
| 服务端调用 | [server/ai-proxy.mjs](file:///e:/web-dev/contract-guardian/server/ai-proxy.mjs) | 读取环境变量创建 store；`/api/health` 暴露三字段 |
| 部署验收 | [scripts/check-miniapp-deployment.mjs](file:///e:/web-dev/contract-guardian/scripts/check-miniapp-deployment.mjs) | 健康检查 + 生产验收开关 `MINIAPP_DEPLOY_REQUIRE_PERSISTENT=1` |
| 本地测试 | [scripts/test-miniapp-usage-store.mjs](file:///e:/web-dev/contract-guardian/scripts/test-miniapp-usage-store.mjs) | 覆盖 memory 和 redis-rest 模式（mock fetch） |

## `/api/health` 暴露的额度字段

| 字段 | 含义 | 取值 |
|------|------|------|
| `miniappUsageStore` | 当前存储模式 | `redis-rest` / `memory` / 旧版无此字段 |
| `miniappUsagePersistent` | 是否持久化 | `true`（redis-rest 且读写探测成功）/ `false`（memory） |
| `miniappUsageHealthy` | 读写探测是否成功 | `true` / `false` |

## 配置步骤

### 1. 在 Upstash 创建 Redis 数据库

- 访问 https://console.upstash.com/
- 创建 Redis 数据库，区域选择离微信云托管最近的可用区
- 记录 `REST URL` 和 `REST Token`

### 2. 在微信云托管配置环境变量

进入微信云托管控制台 → 服务设置 → 环境变量，添加：

| 变量名 | 值 |
|--------|----|
| `UPSTASH_REDIS_REST_URL` | Upstash 提供的 REST URL（`https://xxx.upstash.io`） |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash 提供的 REST Token |

### 3. 重新部署微信云托管

`server/` 的环境变量改动需要重新部署微信云托管服务才会生效。

### 4. 配置完成后验收

在 PowerShell 中执行：

```powershell
$env:MINIAPP_DEPLOY_REQUIRE_PERSISTENT='1'
npm run check:miniapp-deployment
```

生产验收模式下，以下三项必须全部通过：

- 额度存储模式为 `redis-rest`
- 额度存储已持久化（`miniappUsagePersistent = true`）
- 额度存储读写探测成功（`miniappUsageHealthy = true`）

任意一项失败会输出具体原因并退出非零码。

## 失败排查

| 失败信息 | 可能原因 | 处理 |
|----------|----------|------|
| 额度存储为 `memory` | 环境变量未配置或未重新部署 | 检查微信云托管环境变量，重新部署 |
| 额度存储未持久化 | `miniappUsagePersistent = false` | 同上 |
| 额度存储读写探测失败 | Redis REST 凭据错误、网络不通、Upstash 服务异常 | 核对凭据（不要粘贴到对话），检查微信云托管到 Upstash 的网络 |
| Redis REST 503 | 连接超时（4 秒）或 Upstash 不可达 | 检查 Upstash 状态页，确认微信云托管可访问外网 |

## 降级行为

当 Redis 不可用时，服务端会返回明确的 503 错误（`usage-store-unavailable`），不会静默切换到 memory 模式：

```
联网额度服务暂时不可用，请使用本地分析后稍后重试
```

客户端收到 503 后自动使用本地分析，不会让用户卡住。

## 本地开发

本地开发无需配置 Redis：

- `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN` 留空
- 额度存储自动为 `memory` 模式
- `npm run test:miniapp-usage` 覆盖 memory 和 redis-rest（mock fetch）两种模式
- 不要在本地设置 `MINIAPP_DEPLOY_REQUIRE_PERSISTENT=1`（memory 会被判为未完成）

## 验证命令

| 命令 | 用途 |
|------|------|
| `npm run test:miniapp-usage` | 本地测试额度存储双模式（mock fetch，不依赖真实 Redis） |
| `npm run check:miniapp-deployment` | 线上部署验收（默认提示 memory 模式） |
| `$env:MINIAPP_DEPLOY_REQUIRE_PERSISTENT='1'; npm run check:miniapp-deployment` | 生产验收（强制要求 redis-rest） |
| `npm run verify:miniapp` | 全量本地验证链路（不含线上部署验收） |
