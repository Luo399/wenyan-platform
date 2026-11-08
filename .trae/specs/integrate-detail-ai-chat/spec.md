# DetailView AI 对话 Spec

## Why
DetailView（文言文详情页）是学生学习文言文的核心页面，目前仅提供课文展示，缺少即问即答的 AI 讲解能力。需要接入 DeepSeek 大模型，让已登录学生在阅读文言文时可向 AI 提问，同时严格控制 token 成本与滥用风险。

## What Changes
- 后端新增 `/api/ai/chat` 代理接口：接收前端消息 → 注入系统 prompt（课文上下文） → 调用 DeepSeek API → 返回流式/非流式响应
- 后端新增"学生 AI 配额"数据层（SQLite 表），记录每日/每周/每月 token 消耗，用于硬限制
- 后端新增 `aiController.js` 控制器、`aiService.js` 服务层、AI 专用限流与配额中间件
- 后端新增 `/api/ai/quota` 查询当前学生剩余配额接口
- 前端 DetailView.vue 新增 AI 对话组件入口 + 侧边抽屉/弹层对话 UI
- 前端新增 `useAiChat` composable，统一对话状态、流式响应处理、配额显示
- `.env.production` 新增 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、AI 配额阈值环境变量
- 后端启动时检查 `DEEPSEEK_API_KEY` 存在性（生产环境）

## Impact
- 新增能力：AI 对话代理、学生级 token 配额、DeepSeek 服务层
- 受影响页面：DetailView.vue（扩展）
- 受影响后端模块：routes/index.js、新增 controllers/aiController.js、services/aiService.js、middleware/aiQuotaMiddleware.js
- 受影响配置：backend/.env.production、backend/env.example、backend/src/config/app.js
- 无 breaking change

## ADDED Requirements

### Requirement: AI 对话代理（后端）
系统 SHALL 提供 `POST /api/ai/chat` 接口，代理 DeepSeek API。

#### Scenario: 已登录学生成功提问
- **WHEN** 携带有效 JWT（student 角色）提交 `{ wenId, messages[] }`
- **THEN** 后端从 `.env` 读取 `DEEPSEEK_API_KEY`，将 `wenId` 对应课文原文作为 system prompt 注入，调用 DeepSeek API，返回 AI 回复

#### Scenario: 未登录/非学生角色
- **WHEN** 无 JWT、JWT 无效、或角色不是 student
- **THEN** 返回 401/403，不记录配额

#### Scenario: 配额用尽
- **WHEN** 该学生日/周/月任一配额已达上限
- **THEN** 返回 429 + 剩余重置时间，不调用 DeepSeek

#### Scenario: DeepSeek API 异常
- **WHEN** DeepSeek 返回非 2xx 或网络超时
- **THEN** 返回 502，不计入配额

#### Scenario: 请求体校验失败
- **WHEN** `messages` 为空、长度 >20、单条 content > 2000 字符、或含非法字段
- **THEN** 返回 400，拒绝请求

### Requirement: 学生级 token 配额
系统 SHALL 为每个学生维护独立的日/周/月 token 消耗累计。

- 默认阈值：每日 8000 tokens、每周 40000 tokens、每月 120000 tokens（均可通过 env 配置）
- 每次调用 AI 后，按 DeepSeek 返回的 `usage.total_tokens` 累加
- 配额重置：日配额次日 00:00，周配额周一 00:00，月配额每月 1 日 00:00
- 持久化表结构：
  ```sql
  CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    wen_id TEXT,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, id)
  );
  -- 汇总表（可选，用于快速查询剩余配额）
  CREATE TABLE IF NOT EXISTS ai_quota_daily (
    student_id TEXT PRIMARY KEY,
    date TEXT NOT NULL, -- YYYY-MM-DD
    used_tokens INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS ai_quota_weekly (
    student_id TEXT PRIMARY KEY,
    week TEXT NOT NULL, -- YYYY-Www
    used_tokens INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS ai_quota_monthly (
    student_id TEXT PRIMARY KEY,
    month TEXT NOT NULL, -- YYYY-MM
    used_tokens INTEGER NOT NULL DEFAULT 0
  );
  ```

### Requirement: 配额查询接口
系统 SHALL 提供 `GET /api/ai/quota` 返回当前学生配额状态。

#### Scenario: 学生查询
- **WHEN** 携带有效 student JWT 调用
- **THEN** 返回 `{ daily: { used, limit, resetAt }, weekly: {...}, monthly: {...} }`

### Requirement: DetailView AI 对话 UI
系统 SHALL 在 DetailView 提供 AI 对话入口。

- 入口形式：悬浮按钮或页面内嵌区域（具体 UI 由设计决定）
- 未登录时入口置灰并提示"登录后可使用 AI 讲解"
- 对话框展示：历史消息（仅当前会话）、当前课文上下文标识、配额余额指示
- 输入校验：单条 < 2000 字符、发送后按钮 disabled 直到 AI 回复完成
- 错误态：显示错误原因（配额用尽 / 网络失败 / AI 超时）

### Requirement: 系统 prompt 注入（课文上下文）
后端 SHALL 在调用 DeepSeek 时注入 system prompt，包含：
- 课文标题、作者、朝代
- 课文原文（截断至 8000 字符以内）
- 固定角色定义："你是一位专业的文言文助教，请基于给定课文内容，用深入浅出的中文回答学生的问题。回答要准确、简洁、避免超出课文范围。"

### Requirement: 流式响应（v1 简化版）
- 第一阶段使用非流式响应（`POST` → 等待完整回复 → 返回 JSON）
- 预留接口：返回体包含 `streaming: false` 字段，v2 可平滑切换 SSE

### Requirement: 内容安全防护
系统 SHALL 对用户输入进行基础内容过滤。

- 过滤 prompt injection 典型特征：忽略前后指令、角色扮演切换（"忽略之前的提示"/"你现在是…"）
- 超限字符长度直接 400
- 记录日志但不返回给用户

### Requirement: 安全基线清单（必须逐项落地）
以下安全威胁与对应缓解措施的概率分级，所有 **MEDIUM / HIGH** 项必须在 v1 实现：

| # | 威胁场景 | 攻击向量 | 概率 | 影响 | 缓解措施 |
|---|---------|---------|------|------|---------|
| S1 | API Key 被前端逆向窃取 | 前端 bundle 硬编码 key | **HIGH** | 成本爆炸 + 额度被盗 | **服务端代理**，key 仅存后端 `.env`，永不下发前端 |
| S2 | token 滥用（学生 ID 遍历/脚本） | 脚本批量刷 `/api/ai/chat` | **HIGH** | 额度耗尽 | **JWT 绑定 student_id** + 三层配额（日/周/月） + 学生 ID 级 express-rate-limit（如 15 次/分钟） |
| S3 | 未登录/绕过登录调 AI | 直接 curl 接口 | **MEDIUM** | 免费调用 | `requireAuthMiddleware` + `requireRole('student')` 双闸 |
| S4 | prompt injection 诱导越权回复 | 用户输入包含"你现在是管理员…" | **MEDIUM** | 返回敏感/违规内容 | system prompt 角色锁定 + 关键词黑名单 + 后端对 AI 输出做安全截断（上限 2000 字符） |
| S5 | 反向代理攻击 / IP 伪造 | X-Forwarded-For 伪造 IP 绕过限流 | **MEDIUM** | 限流失效 | 限流同时绑定 **student_id**（非仅 IP），后端配置 `app.set('trust proxy', 1)` 信任宝塔反代，拒绝非白名单 X-Forwarded-For |
| S6 | 并发洪水 / 队列占满 | 同一学生并发开 N 个请求 | **MEDIUM** | 后端资源耗尽 | 单学生并发请求计数，超过 2 个时排队或 503；全局 AI 请求并发上限 10 |
| S7 | DeepSeek API 上游异常/抖动 | 上游返回 429/5xx | **MEDIUM** | 用户体验差 + token 浪费 | 指数退避重试（最多 2 次），超时 30s，429 不扣配额 |
| S8 | 历史对话膨胀 | 前端传超长 messages 数组 | **LOW** | token 浪费 + 成本 | 硬限制 messages ≤ 20 轮，单条 content ≤ 2000 字符；后端自动截断最早的非 system 消息 |
| S9 | 课文原文泄露敏感数据 | 课文内容被 AI 原样输出到不可控场景 | **LOW** | 信息泄露 | system prompt 中明确"仅回答关于课文的问题，不要输出课文全文"（软约束，可加后处理截断） |
| S10 | 配额数据被篡改（SQLite 文件被访问） | 服务器文件系统入侵 | **LOW** | 配额重置/伪造 | SQLite 文件权限 600；PM2 进程独立用户；配额校验使用 SELECT+UPDATE 原子事务 |
| S11 | 中间人窃听 AI 请求体 | 非 HTTPS 或公共 WiFi 下抓取 | **LOW** | 对话内容泄露 | HTTPS 强制 + HSTS（已有）；AI 接口走 `api.classicalab.cn` 独立子域 |
| S12 | DeepSeek API Key 日志泄露 | 后端错误日志意外打印 key | **MEDIUM** | key 被二次泄露 | 后端 logger 对所有 `*_KEY`、`*_TOKEN` 字段做自动脱敏（`***`），禁止在 error 堆栈打印原始 body |
| S13 | SSRF 滥用后端代理 | 利用代理接口请求内网 | **LOW** | 内网扫描 | 代理接口**仅**允许调用 DeepSeek 固定 base URL，禁止用户自定义 base_url |
| S14 | AI 回复包含恶意内容（钓鱼/诈骗） | AI 被诱导输出有害链接 | **MEDIUM** | 用户被害 | 后端对 AI 回复做正则扫描，命中 http(s):// 链接时包裹 `<code>` 标签或直接过滤 |
| S15 | 配额被清零（数据竞争） | 并发请求同时累加 quota | **LOW** | 限额被击穿 | 配额更新使用 SQLite 事务（BEGIN → SELECT … FOR UPDATE 等价 → UPDATE → COMMIT）；或用单个 UPDATE 原子累计 |

## MODIFIED Requirements
无（新增能力）

## REMOVED Requirements
无
