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

## 3. 前置检查清单

- [ ] 阿里云 Redis 实例已创建（最小规格 1GB 即可）
- [ ] 服务器能访问 Redis（内网端口 6379）
- [ ] `.env` 已加 `REDIS_URL=redis://password@host:6379`
- [ ] 当前生产数据库已完整备份（宝塔面板 → SQLite 导出）
- [ ] 测试环境先跑一遍完整迁移

## 4. 迁移步骤

### Step 1：引入 Redis Client

```bash
cd backend && npm install ioredis
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
const opts = redisClient ? { store: new RedisStore({ sendCommand: (...args) => redisClient.call(...args) }) } : {}
```

### Step 3：Redis 分布式 AI 并发信号量

保留降级：有 REDIS_URL 用 Redis SETNX 信号量，没有继续用进程内 semaphore。

### Step 4：PM2 Cluster 启动

```js
// ecosystem.config.js
module.exports = {
  apps: [{ name: 'wenyan-backend', script: './src/server.js', instances: 'max', exec_mode: 'cluster' }]
}
```

### Step 5：SQLite → PostgreSQL（可选，重度写入场景）

如果 SQLite WAL 在 cluster 下频繁触发 SQLITE_BUSY，建议迁 PostgreSQL。

## 5. 回滚方案

```bash
pm2 delete wenyan-backend
# ecosystem.config.js 改回 instances: 1, exec_mode: 'fork'
pm2 start ecosystem.config.js
# .env 注释 REDIS_URL，后端自动 fallback MemoryStore
```

## 6. 当前阶段替代方案（不用 cluster）

短期不迁 cluster 时，建议先做：
1. **只引 Redis 不启 cluster**：用 Redis 做限流 + 信号量共享状态
2. **宝塔 PM2 reload 脚本**：改 `.env` 后 `pm2 reload wenyan-backend --update-env`

## 7. 时间预估：1-2 人日