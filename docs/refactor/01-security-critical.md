# 01 - 安全漏洞修复（P0）

> 返回 [README.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/README.md)

---

## S01. 生产密钥泄露（.env.production 已入 git）
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**: `.env.production`（第 7 行 `VITE_AUTH_SECRET=wenyan-production-secret-2024`）
- **问题描述**: 前端 `.env.production` 含 HMAC 签名密钥明文，已被 git 追踪并推送至远程。攻击者可从公开仓库获取密钥，伪造任意提交 token
- **修复方案**:
  1. 将 `.env.production` 加入根 `.gitignore`
  2. 使用 `git filter-repo` 从历史中清除该文件
  3. 轮换密钥：生成新 `VITE_AUTH_SECRET` 值
  4. 在 deploy-frontend.yml 中通过 GitHub Secrets 注入环境变量
- **验证方式**: `git log --all -- .env.production` 无输出；生产环境功能正常
- **分支建议**: `refactor/security-01`
- **依赖**: 无

## S02. 后端 JWT secret 硬编码兜底
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**: `backend/src/config/app.js`（第 26 行）
- **问题描述**: `secret: process.env.JWT_SECRET || 'wenyan_platform_2026_secret_key'`，生产环境若未设 `JWT_SECRET`，会静默使用可预测弱密钥
- **修复方案**:
  ```js
  const secret = process.env.JWT_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production')
  }
  ```
- **验证方式**: 生产环境不设 JWT_SECRET 时启动直接报错退出
- **分支建议**: `refactor/security-02`
- **依赖**: 无

## S03. 路径穿越漏洞（textId / wenId 未校验）
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**:
  - `backend/src/utils/jsonReader.js`（第 26-28 行 `getDataFilePath`、第 96-113 行 `getCorrectAnswerFromJson`）
  - `backend/src/services/textsService.js`（第 5 行 `${textId}.json`）
  - `backend/src/routes/index.js`（第 47-55 行 `req.params` 传入）
- **问题描述**: `textId`/`wenId` 来自 `req.params`，未做白名单校验直接 `path.join` 拼接路径，攻击者可传 `../../../../etc/passwd` 读取任意文件
- **修复方案**:
  ```js
  // 在 getDataFilePath 和 getCorrectAnswerFromJson 入口处添加
  if (!/^[a-zA-Z0-9_-]+$/.test(textId)) {
    throw new Error('Invalid textId format')
  }
  ```
- **验证方式**: 发送 `textId=../../etc/passwd` 返回 400 而非文件内容
- **分支建议**: `refactor/security-03`
- **依赖**: 无

## S04. 学生 CRUD 接口无鉴权
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**: `backend/src/routes/index.js`（第 39-43 行）
- **问题描述**: `GET/POST/PUT/DELETE /api/students` 全部无任何鉴权中间件，任何人可创建、删除、修改学生
- **修复方案**:
  1. 创建 `requireRoleMiddleware(...roles)` 中间件
  2. 学生 CRUD 路由挂 `requireAuthMiddleware` + `requireRoleMiddleware('teacher', 'admin')`
  3. 答题查询路由同样加鉴权
- **验证方式**: 未登录访问 `/api/students` 返回 401
- **分支建议**: `refactor/security-04`
- **依赖**: 02-routing-auth.md 的 R02（路由守卫激活）

## S05. 登录接口无密码、无频控
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**: `backend/src/controllers/authController.js`（第 4-50 行）、`backend/src/routes/index.js`（第 72 行）
- **问题描述**: `login` 只校验 `student_id` 是 4 位数字，无密码、无验证码、无频控。学号仅 10000 种组合，可暴力枚举
- **修复方案**:
  1. 登录接口加专用 `loginRateLimit`（5 次/分钟/IP）
  2. 增加图形验证码或后端二次验证机制
  3. token payload 增加 `iat` 防重放
- **验证方式**: 同一 IP 1 分钟内登录 6 次返回 429
- **分支建议**: `refactor/security-05`
- **依赖**: 无

## S06. CORS 配置错误（API 域名列为允许源）
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**: `backend/src/config/app.js`（第 15、22-24 行）、`backend/src/app.js`（第 22-24 行）
- **问题描述**:
  1. 默认 `origin: '*'` + `credentials: true` 是 CORS 误配置
  2. 兜底逻辑把 `api.classicalab.cn` 当作允许的前端源（API 域名不应是 CORS 允许源）
  3. `methods` 包含 `PUT/DELETE`，安全规范要求仅 `GET/POST`
- **修复方案**:
  ```js
  origin: (process.env.CORS_ORIGIN || '')
    .split(',').map(s => s.trim()).filter(Boolean),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  ```
- **验证方式**: 从 `api.classicalab.cn` 发起请求被 CORS 拒绝
- **分支建议**: `refactor/security-06`
- **依赖**: 无

## S07. 测试环境密钥硬编码在 workflow
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**: `.github/workflows/deploy-backend-test.yml`（第 47 行）
- **问题描述**: `AUTH_SECRET=wenyan-test-secret-2024` 明文写死在 workflow 中并提交 git
- **修复方案**: 改为 `${{ secrets.TEST_AUTH_SECRET }}`，在 GitHub Settings 中配置
- **验证方式**: workflow 文件中 grep `AUTH_SECRET` 无明文值
- **分支建议**: `refactor/security-07`
- **依赖**: 无

## S08. helmet CSP 被关闭
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**: `backend/src/app.js`（第 15-18 行）
- **问题描述**: `contentSecurityPolicy: false` 和 `crossOriginEmbedderPolicy: false` 被关闭，安全规范要求配置 CSP
- **修复方案**:
  ```js
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "https://*.classicalab.cn", "data:"],
        mediaSrc: ["https://*.classicalab.cn"],
        connectSrc: ["'self'", "https://api.classicalab.cn", "https://*.aliyuncs.com"],
      },
    },
  }))
  ```
- **验证方式**: 响应头含 `Content-Security-Policy`
- **分支建议**: `refactor/security-08`
- **依赖**: 无

## S09. mock 用户名乱码（编码错误）
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**: `src/mock/auth.ts`（第 21-48 行）
- **问题描述**: 用户名为 GBK 被误读为 UTF-8 的乱码（如 `闃夸緷濞滃瓬`），文件保存编码错误
- **修复方案**: 以 UTF-8 重新保存文件，恢复正确中文姓名
- **验证方式**: 开发模式下 mock 用户名显示正确中文
- **分支建议**: `refactor/security-09`
- **依赖**: 无

## S10. rateLimit windowMs 类型隐患
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**: `backend/src/config/app.js`（第 47-50 行）、`backend/src/middleware/rateLimitMiddleware.js`（第 4-14 行）
- **问题描述**: env 读取的 `RATE_LIMIT_*` 是字符串，直接传给 `express-rate-limit` 的 `windowMs`，该库期望 number
- **修复方案**: 所有 env 读取的数值配置加 `Number()` 转换
- **验证方式**: 限流功能在配置字符串环境下正常工作
- **分支建议**: `refactor/security-10`
- **依赖**: 无

## S11. 后端无 unhandledRejection 处理
- **优先级**: P0
- **状态**: [ ] 未开始
- **文件**: `backend/src/app.js`（全文）
- **问题描述**: 无 `process.on('unhandledRejection', ...)` 和 `process.on('uncaughtException', ...)`，未捕获的 async 错误被吞
- **修复方案**:
  ```js
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', reason)
  })
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err)
    process.exit(1)
  })
  ```
- **验证方式**: 制造未捕获 Promise rejection 时日志有记录
- **分支建议**: `refactor/security-11`
- **依赖**: 无
