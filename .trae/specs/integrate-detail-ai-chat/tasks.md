# Tasks

- [ ] Task 1: 后端数据层与启动检查
  - [ ] SubTask 1.1: 在 `backend/init_db.js` 或新迁移脚本 `backend/scripts/migrate_ai.js` 中创建 `ai_usage`、`ai_quota_daily`、`ai_quota_weekly`、`ai_quota_monthly` 四张表（SQLite，用 `CREATE TABLE IF NOT EXISTS` 幂等）
  - [ ] SubTask 1.2: 在 `backend/src/config/app.js` 新增 AI 配置段：`deepseek.apiKey`（生产环境缺失抛错）、`deepseek.model`（默认 `deepseek-chat`）、`deepseek.baseUrl`（默认 `https://api.deepseek.com`）、`quota.daily/weekly/monthly`（默认 8000/40000/120000）、`ai.maxConcurrent`（默认 10）、`ai.timeoutMs`（默认 30000）
  - [ ] SubTask 1.3: 更新 `backend/env.example` 增加 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`AI_QUOTA_DAILY`、`AI_QUOTA_WEEKLY`、`AI_QUOTA_MONTHLY`、`AI_MAX_CONCURRENT` 占位
  - [ ] SubTask 1.4: 在 `backend/src/utils/logger.js` 增加敏感字段脱敏，对所有 `*_KEY` / `*_TOKEN` / `API_SECRET` 键的值自动替换为 `***`

- [ ] Task 2: AI 服务层（DeepSeek 代理 + 配额原子操作）
  - [ ] SubTask 2.1: 新建 `backend/src/services/aiService.js`，封装 `callDeepSeek(messages, options)`：超时、指数退避重试（最多 2 次）、仅请求固定 `config.deepseek.baseUrl`、抛错不泄漏 API key
  - [ ] SubTask 2.2: 封装 `buildSystemPrompt(wenId)`：查 DB 或直接从 textsController 取得课文原文 + 标题/作者，按 spec 组装 system prompt（截断至 8000 字符）
  - [ ] SubTask 2.3: 封装 `checkAndConsumeQuota(studentId, tokens)`：原子事务（BEGIN → 读三档 quota → 加总 → 判断是否超限 → UPDATE → COMMIT），返回 `{ ok, daily/weekly/monthly: { used, limit, resetAt } }`；超限时返回剩余信息但**不**扣配额
  - [ ] SubTask 2.4: 封装 `logAiUsage({ studentId, wenId, promptTokens, completionTokens, totalTokens })` 写入 `ai_usage` 表
  - [ ] SubTask 2.5: 实现并发信号量：模块级 Map 记录 `studentId → activeCount`，超限返回 503

- [ ] Task 3: AI 控制器与路由
  - [ ] SubTask 3.1: 新建 `backend/src/controllers/aiController.js`：
    - `chat(req, res)`：JWT 校验 → student 角色 → 请求体 schema 校验（messages 非空、≤20 轮、单条 content ≤2000 字符、wenId 必填）→ 关键词黑名单过滤 prompt injection → 注入 system prompt → 并发检查 → 配额预检 → 调 DeepSeek → 消费配额 → 记录 usage → 安全过滤回复中的 URL → 返回 `{ reply, usage, quota }`
    - `getQuota(req, res)`：返回当前学生三档配额详情
  - [ ] SubTask 3.2: 在 `backend/src/middleware/rateLimitMiddleware.js` 新增 `aiChatRateLimit`（默认 15 次/分钟，按 student_id）
  - [ ] SubTask 3.3: 在 `backend/src/routes/index.js` 注册路由：
    ```js
    const aiAuth = [requireAuthMiddleware, requireRole('student')]
    app.post('/api/ai/chat', aiAuth, aiChatRateLimit, aiController.chat)
    app.get('/api/ai/quota', aiAuth, aiController.getQuota)
    ```

- [ ] Task 4: 前端 AI 对话组件与 composable
  - [ ] SubTask 4.1: 新建 `src/composables/useAiChat.ts`：状态机（idle/loading/error）、messages ref、发送消息走 `POST /api/ai/chat`（复用 `fetch` 或封装的 api.ts）、错误态分类（401 未登录 / 429 配额用尽 / 502 AI 异常）、配额余额单独 ref 定期刷新
  - [ ] SubTask 4.2: 新建 `src/components/AiChatPanel.vue`：对话面板 UI（消息气泡、输入框、发送按钮、loading 态、配额角标），未登录时显示占位提示
  - [ ] SubTask 4.3: 修改 `src/views/DetailView.vue`：在底部导航上方或侧边引入 `<AiChatPanel :wen-id="wenId" :article="article" />`，未登录时 `AiChatPanel` 自行降级为"登录后可用"提示
  - [ ] SubTask 4.4: 更新 `.env.production`（本地）与 `env.example` 注释（无新增前端 env 变量，AI 请求走同一后端 API）

- [ ] Task 5: 安全加固与测试
  - [ ] SubTask 5.1: 关键词黑名单实现（忽略之前的提示 / 你现在是管理员 / system prompt 覆盖等），在 `aiController.chat` 入口拦截
  - [ ] SubTask 5.2: AI 回复 URL 包裹正则（`/https?://[^\s)]+/g`）匹配到则用 `<code>…</code>` 包裹
  - [ ] SubTask 5.3: 后端单元测试（新建 `backend/tests/ai-chat-security.test.js`）覆盖：未登录 401、非 student 角色 403、messages 空 400、单条超长 400、配额用尽 429、配额扣减原子性、并发超限 503、DeepSeek 502 不扣配额、prompt injection 关键词拦截
  - [ ] SubTask 5.4: npm run lint + type-check 双绿
  - [ ] SubTask 5.5: 提交到 `feature/ai-chat-integration` 分支并 push，等 CI 全绿后合并回 feature-1

# Task Dependencies
- Task 2 依赖 Task 1（数据库表 + config）
- Task 3 依赖 Task 2（服务层）
- Task 4 可与 Task 2/3 并行（前端 UI 与后端接口各自独立开发）
- Task 5 依赖 Task 3 + Task 4（完整链路）
