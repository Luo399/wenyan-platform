# PM2 Cluster + Redis 迁移路线图

> 本文档为未来规模增长后，从 PM2 单实例迁移到 PM2 cluster（多进程）+ Redis 共享存储的参考方案。
> 非当前立即执行项——当前规模（单机 PM2 + SQLite + 学生数 < 10000）完全够用。

---

## 一、为什么要迁

当前后端运行在 **PM2 单实例** + **SQLite WAL** 模式下。单进程假设覆盖了以下 3 处代码：

| 模块 | 单进程假设 | 多进程后果 |
|---|---|---|
| `rateLimitMiddleware.js` | express-rate-limit MemoryStore 每进程独立计数 | 2 个进程 = 每个 IP 实际可用 200/min（不是 100/min） |
| `aiService.js` | 内存级 `concurrentMap` / `globalConcurrent` 只控当前进程 | 2 个进程 = 全局实际并发 20（不是 10） |
| `useDataLoader.ts` | （前端）模块级 LRU 缓存仅浏览器内存 | 无影响（前端天然多实例） |

**什么时候必须迁？**

| 触发条件 | 说明 |
|---|---|
| 日活学生 > 5000 | 单进程 Node.js event loop 开始出现 lag |
| API P99 > 500ms | SQLite 读不阻塞但写会（单写者）；PM2 多进程写 SQLite 会冲突 |
| 并发 AI 对话 > 10 | 单进程内存级信号量不能跨进程协调 |
| 运维要零停机部署 | PM2 cluster 支持 graceful reload（滚动更新） |

---

## 二、迁移条件检查清单

在开始前确认以下准备就绪：

- [ ] 阿里云 Redis 实例已开通（或自建 Redis）
- [ ] Redis 网络可达（宝塔服务器安全组放行 6379）
- [ ] `backend/.env` 已加 `REDIS_URL=redis://host:6379`
- [ ] 已在测试环境（test.classicalab.cn）验证 Redis 连通性
- [ ] 数据备份（`cp backend/database/answers.db answers.db.backup.$(date)`）

---

## 三、迁移步骤

### 步骤 1：引入 Redis 客户端

```bash
cd backend
npm install ioredis --save
```

新增 `backend/src/config/redis.js`：

```js
const Redis = require('ioredis')
const { logger } = require('../utils/logger')

let client = null

function getRedis() {
  if (!client) {
    const url = process.env.REDIS_URL
    if (!url) {
      throw new Error('REDIS_URL not set in production')
    }
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    })
    client.on('error', (err) => logger.error('[redis] error:', err.message))
    client.on('ready', () => logger.info('[redis] connected'))
  }
  return client
}

module.exports = { getRedis }
```

### 步骤 2：限流从 MemoryStore 迁移到 Redis

```bash
cd backend
npm install rate-limit-redis --save
```

修改 `rateLimitMiddleware.js`：

```js
// Before（单进程）
const limiter = rateLimit({ store: new MemoryStore(), max: 100, windowMs: 15*60*1000 })

// After（多进程共享）
const { RedisStore } = require('rate-limit-redis')
const { getRedis } = require('../config/redis')

const limiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => getRedis().call(...args) }),
  max: 100,
  windowMs: 15 * 60 * 1000,
})
```

**注意**：`express-rate-limit` 7.x 用 `store`，6.x 用 `store` 参数名不同——按实际版本调整。

### 步骤 3：AI 并发控制从内存信号量迁移到 Redis 分布式锁

```bash
cd backend
npm install ioredis --save  # 已在步骤 1 安装
```

修改 `aiService.js`，内存级 `concurrentMap` → Redis 分布式计数器：

```js
// Before（单进程内存）
const concurrentMap = new Map()  // studentId → count
const globalConcurrent = { count: 0 }

// After（Redis）
const { getRedis } = require('../config/redis')

async function acquireStudentSlot(studentId) {
  const redis = getRedis()
  const key = `ai:concurrent:student:${studentId}`
  const count = await redis.incr(key)
  await redis.expire(key, 300)  // 5 分钟后自动释放
  return count <= 2
}
```

同理 `globalConcurrent` → `ai:concurrent:global`。

### 步骤 4：PM2 启动 cluster 模式

```bash
# ecosystem.config.js 新增 cluster 配置
module.exports = {
  apps: [{
    name: 'wenyan-backend',
    script: 'src/server.js',
    cwd: './backend',
    exec_mode: 'cluster',
    instances: 2,        // 或 'max' 自动使用所有 CPU 核
    wait_ready: true,
    listen_timeout: 10000,
    max_memory_restart: '1G',
    max_restarts: 10,
    restart_delay: 4000,
  }]
}
```

### 步骤 5：SQLite 迁移到 PostgreSQL（可选但推荐）

SQLite WAL 模式支持多读者单写者，PM2 cluster 2 进程 = 2 写者，会冲突。**必须在 cluster 模式前先切 PostgreSQL**，或者 cluster 进程数保持 1。

**推荐顺序**：先迁 PostgreSQL → 再开 cluster。

```bash
# PostgreSQL 迁移步骤（参考）
# 1. pgloader 从 SQLite 迁移数据
pgloader sqlite:///path/to/answers.db postgresql://user:pass@host/dbname

# 2. backend/src/config/database.js 改为 pg.Pool
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
```

### 步骤 6：部署验证

```bash
# 1. 停止旧单实例
pm2 delete wenyan-backend

# 2. 用 cluster 模式启动
cd backend && pm2 start ../ecosystem.config.js --update-env

# 3. 确认进程数
pm2 status
# 应看到 2 个 instances

# 4. 健康检查
curl http://localhost:3000/api/health

# 5. 验证 Redis 限流生效（多进程累加正确）
for i in {1..200}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health; done
# 100 次后应出现 429

# 6. 验证 AI 并发控制（多进程全局生效）
# 开 3 个浏览器同时发 AI 请求，第 3 个应被拒绝（2 并发上限）
```

---

## 四、回滚方案

任何步骤失败都可以快速回退：

```bash
# 回到单实例
pm2 delete wenyan-backend
cd backend && pm2 start server.js --name wenyan-backend

# SQLite 恢复
cp answers.db.backup.XXXXXX answers.db
pm2 restart wenyan-backend --update-env
```

Redis 出问题时降级回 MemoryStore：

```js
const useRedis = process.env.REDIS_URL && process.env.NODE_ENV === 'production'
const store = useRedis ? new RedisStore(...) : new MemoryStore()
```

---

## 五、时间表预估

| 阶段 | 工作量 | 依赖 |
|---|---|---|
| 步骤 1-2（Redis + 限流） | 2h | Redis 实例就绪 |
| 步骤 3（AI 并发） | 1h | 步骤 1 |
| 步骤 4（PM2 cluster） | 30min | 步骤 5（PostgreSQL 迁移完成）|
| 步骤 5（PostgreSQL 迁移）| 4-8h | 数据量决定，需要全量测试 |
| 联调 + 测试 | 4h | 以上全部 |
| 生产部署 + 冒烟 | 1h | 测试环境验证通过 |
| **合计** | **1-2 工作日** | — |

---

## 六、当前阶段替代方案

如果还没准备好迁 PostgreSQL + Redis，但想利用 PM2 cluster 做零停机部署，可以：

1. **保持 SQLite 单实例 + Redis**：PM2 不开 cluster（`instances: 1`），只用 Redis 共享限流和并发控制。这样可以跑 graceful reload（滚动重启）但始终只有 1 个进程在写 SQLite。

2. **PM2 exec_mode='fork' + Redis**：显式用 fork 模式（不是 cluster），只做单进程守护，但已经用上 Redis 限流，为未来 cluster 铺路。

---

*文档版本：2026-10-23 · 随架构演进同步更新*
