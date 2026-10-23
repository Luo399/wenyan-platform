# PM2 Cluster + Redis 迁移路线图

> 当前后端单进程（PM2 单实例），满足现阶段需求；本文档记录迁移前置知识、条件、步骤与回滚方案。

## 1. 为什么要迁移

当前后端有 3 处 **单进程假设**，PM2 cluster 模式下会失效或数据不一致：

| 位置 | 问题 | 影响 |
|------|------|------|
| `rateLimitMiddleware.js` | MemoryStore（进程内 Map） | 多进程下每个进程各记各的，实际限流失效 |
| `aiService.js` 并发信号量 | 进程内 semaphore 对象 | 多进程下每个进程各自独立控制，总并发可能翻倍 |
| SQLite WAL 模式 | 单进程写入设计 | 多进程并发写可能触发 `SQLITE_BUSY` 或 WAL checkpoint 冲突 |

## 2. 什么时候迁移（触发条件）

- 日活超过 **5000 DAU**
- API P99 延迟稳定超过 **500ms**
- AI 并发请求经常出现 **排队 >10 秒**
- 宝塔服务器 CPU 平均超过 **70%**

任一条件触发即可启动迁移；全部触发则必须迁移。

## 3. 前置检查清单

- [ ] 阿里云 Redis 实例已创建（最小规格 1GB 即可）
- [ ] 服务器能访问 Redis（内网端口 6379）
- [ ] `.env` 已加 `REDIS_URL=redis://password@host:6379`
- [ ] 当前生产数据库已完整备份（宝塔面板 → SQLite 导出）
- [ ] 安排测试环境先跑一遍完整迁移

## 4. 迁移步骤（1-2 个工作日）

### Step 1：引入 Redis Client

```bash
cd backend
npm install ioredis
```

新建 `backend/src/config/redis.js`：

```js
const Redis = require('ioredis')
const url = process.env.REDIS_URL
const client = url ? new Redis(url, { maxRetriesPerRequest: 3 }) : null
module.exports = client
```

### Step 2：替换 rate-limit MemoryStore

```bash
npm install rate-limit-redis
```

```js
// rateLimitMiddleware.js
const RedisStore = require('rate-limit-redis')
const redisClient = require('../config/redis')

const opts = redisClient
  ? { store: new RedisStore({ sendCommand: (...args) => redisClient.call(...args) }) }
  : {} // 降级：继续用 MemoryStore
```

### Step 3：Redis 分布式 AI 并发信号量

```js
// aiService.js
// 单进程 semaphore（保留降级用）
let currentConcurrency = 0
const MAX_CONCURRENCY = Number(process.env.AI_MAX_CONCURRENCY) || 5

async function acquireSlot() {
  if (redisClient) {
    // Redis SETNX + EXPIRE 实现分布式信号量
    const key = 'ai:semaphore:counter'
    const val = await redisClient.incr(key)
    if (val === 1) await redisClient.expire(key, 3600)
    if (val > MAX_CONCURRENCY) {
      await redisClient.decr(key)
      return false // 满了，稍后重试
    }
    return true
  }
  // 降级：进程内
  if (currentConcurrency >= MAX_CONCURRENCY) return false
  currentConcurrency++
  return true
}

async function releaseSlot() {
  if (redisClient) await redisClient.decr('ai:semaphore:counter')
  else currentConcurrency = Math.max(0, currentConcurrency - 1)
}
```

### Step 4：PM2 Cluster 启动

修改 `backend/ecosystem.config.js`：

```js
module.exports = {
  apps: [{
    name: 'wenyan-backend',
    script: './src/server.js',
    instances: 'max',      // 或具体数字，如 4
    exec_mode: 'cluster',  // ← 关键
    watch: false,
    env_production: { NODE_ENV: 'production' },
  }]
}
```

### Step 5：SQLite → PostgreSQL（可选，重度写入场景）

如果 SQLite WAL 在 cluster 下频繁触发 SQLITE_BUSY，建议迁 PostgreSQL：

- 阿里云 RDS PostgreSQL（最小规格 1 核 2G）
- 阿里云 DTS 数据同步（SQLite → PG）
- 后端 `better-sqlite3` → `pg`，迁移 SQL schema

### Step 6：部署后验证

```bash
# 检查进程
pm2 list
# 预期：wenyan-backend 显示 N 个 cluster worker

# 压测 API
ab -n 1000 -c 50 https://api.classicalab.cn/api/health

# 检查 Redis key
redis-cli KEYS "rate_limit:*" | wc -l
# 预期：有多个限流 key，且不同进程共享计数

# 检查 AI 并发
redis-cli GET ai:semaphore:counter
# 预期：实时并发数
```

## 5. 回滚方案

**触发条件**：cluster 模式下 API 大量 5xx 或 Redis 连接异常。

```bash
# 1. 切回单实例
pm2 delete wenyan-backend
# ecosystem.config.js 改回 instances: 1, exec_mode: 'fork'
pm2 start ecosystem.config.js

# 2. 临时降级 Redis 依赖
# .env 注释掉 REDIS_URL，后端自动 fallback MemoryStore + 进程内 semaphore

# 3. 验证恢复
curl -s https://api.classicalab.cn/api/health
```

## 6. 当前阶段替代方案（不用 cluster）

如果短期不迁 cluster，建议先做这 2 件小事：

1. **只引 Redis，不启 cluster**：用 Redis 做优雅重启的共享状态（限流、信号量），PM2 仍单实例。这样下一次启 cluster 零额外成本。
2. **宝塔面板开启 PM2 reload 脚本**：改完 `.env` 或代码后，`pm2 reload wenyan-backend --update-env` 会平滑重启，不丢请求。

## 7. 时间预估

| 阶段 | 工作内容 | 人天 |
|------|---------|------|
| 前置 | 开 Redis 实例 + 测试环境部署 | 0.5 |
| 代码 | rate-limit-redis + 分布式信号量 + 降级 | 0.5 |
| 部署 | PM2 cluster + 压测 + 观察 | 0.5 |
| 回滚演练 | 写回滚脚本 + 在测试环境演练 | 0.5 |
| 合计 | | **1-2 人日** |
