# 文言文学预习平台 · Code Wiki

> 本文档是 wenyan-platform 仓库的完整技术文档，涵盖架构设计、模块职责、关键决策与 Why、运行方式等信息。
> 适合作为**项目简历说明 / 新人入门 / 代码审查参考**。

---

## 目录

1. [项目概述与业务背景](#1-项目概述与业务背景)
2. [系统架构总览](#2-系统架构总览)
3. [前端架构（Vue 3 + TypeScript）](#3-前端架构vue-3--typescript)
4. [后端架构（Node.js + Express + SQLite）](#4-后端架构nodejs--express--sqlite)
5. [数据管线（Python）](#5-数据管线python)
6. [CI/CD 与部署架构](#6-cicd-与部署架构)
7. [Figma 插件与资产同步链路](#7-figma-插件与资产同步链路)
8. [测试策略](#8-测试策略)
9. [关键设计决策与 Why](#9-关键设计决策与-why)
10. [项目运行方式](#10-项目运行方式)

---

## 1. 项目概述与业务背景

### 1.1 项目是什么

**wenyan-platform** 是一个面向 K12 学生的 **文言文预习 / 自主学习平台**。学生登录后，按「视频导学 → 字词学习 → 多角色朗读 → 三级闯关测验」的顺序学习一篇文言文，过程中可使用 AI 助教提问。教师可查看所教班级的答题数据，管理员负责用户与内容管理。

### 1.2 技术栈一览

| 层 | 技术 | 版本 |
|---|---|---|
| **前端** | Vue 3 + TypeScript + Vite | Vue 3.5, Vite 8, TS 6 |
| **前端 UI** | Composition API + `<script setup>` | — |
| **状态管理** | Pinia 3 | — |
| **路由** | Vue Router 5 | — |
| **视频播放** | Video.js 7 + @videojs-player/vue | — |
| **后端** | Node.js + Express 4 | Node 22 LTS |
| **后端 DB** | SQLite 3（better-sqlite3） | — |
| **鉴权** | JWT（jsonwebtoken） + bcryptjs | — |
| **安全** | helmet + express-rate-limit + zod | — |
| **数据管线** | Python 3.11 + openpyxl + pandas | — |
| **AI** | DeepSeek Chat Completions | — |
| **资产存储** | 阿里云 OSS（public-read） | — |
| **进程守护** | PM2（宝塔面板） | — |
| **CI/CD** | GitHub Actions（多环境） | — |
| **测试** | Vitest（前端）+ Jest（后端）+ pytest（管线） | — |

### 1.3 核心业务实体

- **文言文（wenId）**：平台内容的基本单元，每篇文言文包含文本信息、字词注释、朗读音频、测验题库
- **学生**：学号 + 密码登录，通过学号前 6 位自动归属班级
- **教师**：手机号 + 密码注册，经管理员审批后启用，管理所教班级的学生
- **管理员**：管理教师/学生账号、审批教师注册、重置密码
- **答题记录（answers）**：学生提交的每一道题的答题结果（支持多次作答 attempt_number）
- **埋点事件（tracking_events）**：学生在前端的所有行为（进入/离开步骤、交互、搜索、提交）

---

## 2. 系统架构总览

### 2.1 高层架构图

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              浏览器（前端）                               │
│                                                                          │
│   Vue 3 SPA (dist/) ─── OSS 静态托管 (classicalab.cn)                    │
│       │                                                                  │
│       ├── public/data/*.json（学习内容）── VITE_OSS_BASE_URL 直连 OSS    │
│       │                                                                  │
│       └── fetch('/api/*') ─── CORS ──────────────────────┐              │
│                                                           │              │
└───────────────────────────────────────────────────────────┼──────────────┘
                                                            │
┌───────────────────────────────────────────────────────────▼──────────────┐
│                     阿里云宝塔轻量服务器（后端）                           │
│                                                                          │
│   Nginx (api.classicalab.cn) ── 反代 ──► PM2 (wenyan-backend, :3000)     │
│                                          │                               │
│                                          ├── Express App                 │
│                                          │   ├── helmet (安全头+CSP)     │
│                                          │   ├── CORS 白名单             │
│                                          │   ├── rate-limit（5 级限流）   │
│                                          │   └── JWT 鉴权中间件           │
│                                          │                               │
│                                          ├── SQLite (answers.db)         │
│                                          │   ├── 8 张业务表               │
│                                          │   ├── WAL 模式                │
│                                          │   └── 自动损坏恢复             │
│                                          │                               │
│                                          ├── data/*.json（学习内容副本）   │
│                                          │                               │
│                                          └── 阿里云 OSS（资产上传中转）   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                           开发/数据管线                                    │
│                                                                          │
│   Excel 源文件 (.xlsx) ──► Python 转换层 ──► public/data/*.json           │
│                              │                                           │
│                              ├── 增量检测（文件级 diff）                   │
│                              ├── 版本快照（可回滚）                       │
│                              └── 同步到 backend/data/                    │
│                                                                          │
│   Figma 插件 ──► /api/assets/upload ──► OSS 生产桶 ──► 前端读取          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流全景

```
                    ┌──────────────┐
                    │ Excel 源文件  │
                    │ 开发需求.dbt │
                    └──────┬───────┘
                           │ generate_all_json.py（Python）
                           ▼
                    public/data/        ◄──────── 前端直接 fetch
                    ├── text_basic_info/WEN_01.json
                    ├── word_list/WEN_01.json
                    ├── level1_quiz/WEN_01.json
                    └── ...（7 个子目录 × N 篇文言文）
                           │
                           │ data_processor._sync_public_to_backend()
                           ▼
                    backend/data/        ◄──────── 后端 textsService 读取
                    （同结构 + 后端专属 answer_records.json / students.json）

学生答题流程：
  前端 fetch JSON ──► render 组件 ──► submitAnswers() ──► POST /api/submit
                                                              │
                                                              ▼
                                                     answerService.submitAnswers()
                                                              │
                                                              ├── 事务写入 SQLite answers 表
                                                              ├── JSON 比对 correct_answer
                                                              └── （可选）异步同步教师后台
```

### 2.3 技术选型决策总览

| 决策 | 选择 | 替代方案 | 核心理由 |
|---|---|---|---|
| 前端框架 | Vue 3 + TS | React | 团队熟悉度 + Composition API 对业务分层更友好 |
| 前端路由 | Vue Router 5 | Pinia Router | Vue 生态原生，meta 鉴权天然 |
| 后端框架 | Express 4 | Fastify / Nest | Node 生态事实标准，中间件生态成熟 |
| 数据库 | SQLite 3 | MySQL / PostgreSQL | 单机部署够用 + 零运维成本 + 文件可备份 |
| ORM | 手写 sql + better-sqlite3 | Prisma / TypeORM | 避免过度抽象 + 事务控制精细 |
| 鉴权 | JWT | Session（cookie） | 跨域 SPA 友好 + 无状态易扩展 |
| 部署 | OSS + PM2 | Docker + K8s | 中小规模 + 阿里云生态 + 宝塔面板易用 |
| 数据转换 | Python | Node.js | Excel 处理生态 openpyxl/pandas 成熟 |

---

## 3. 前端架构（Vue 3 + TypeScript）

### 3.1 目录结构

```
src/
├── adapters/           # 数据适配器层（后端 JSON → 前端组件模型）
├── assets/styles/      # 全局样式 + design tokens
├── components/         # 视图组件（按 feature 分组 index.ts 导出）
│   ├── common/         # BaseLoader / BaseError / SectionDivider 等通用
│   ├── features/       # auth / culture / quiz / step 等功能分组
│   └── *.vue           # 业务组件（ClassPicker / Level1Quiz / VideoPlayer 等）
├── composables/        # 组合式函数（业务逻辑复用层）
│   ├── useNavigation   # 统一导航 + 耗时监控
│   ├── useDataLoader   # JSON 加载 + LRU 缓存 + Web Worker 解析
│   ├── useQuizProgress # 闯关进度管理
│   ├── useQuizSubmitter# 答案提交（封装 api.submitAnswers）
│   ├── useTracking     # 行为埋点（缓冲队列上报）
│   ├── useAiChat       # AI 对话框逻辑
│   └── ...
├── config/             # 导航顺序、页面注册、Figma 资源清单
│   ├── navigation.ts   # pageSequence（单一事实源）
│   ├── pageRegistry.ts # 页面元信息
│   └── figmaAssets.ts  # Figma 导出的资源路径清单
├── router/             # 路由定义 + 守卫
│   ├── index.ts        # RouteRecordRaw[] 定义
│   └── guards.ts       # setupAuthGuard（token 过期自动续期 + redirect）
├── services/           # API 服务层（高层封装）
│   ├── apiService.ts       # 鉴权 API（登录/登出/刷新）
│   ├── studentService.ts   # 学生 CRUD
│   ├── classOptions.ts     # 班级下拉选项
│   └── teacherCompletionService.ts
├── stores/             # Pinia 状态管理（三个 store）
│   ├── auth.ts         # JWT token + 用户信息 + 自动续期
│   ├── student.ts      # 学号（历史遗留，auth.ts 已覆盖）
│   └── bgm.ts          # 背景音乐播放状态
├── types/              # TypeScript 类型定义
├── utils/              # 工具函数层（纯函数，无 Vue 依赖）
│   ├── api.ts          # fetch 封装 + 统一错误处理 + 鉴权头注入
│   ├── tracking.ts     # 埋点队列 + session_id + 上报节流
│   ├── localStorage.ts # 持久化封装（authData / studentId）
│   ├── wenUtils.ts     # 文言文 ID / 题目 ID 处理
│   ├── format.ts       # 时间/文本格式化
│   └── ...
├── workers/
│   └── jsonParser.worker.js  # JSON 解析 Worker（主线程隔离）
├── views/              # 页面级组件（被 router 引用）
│   ├── NewHomeView.vue      # 首页（文言文列表）
│   ├── StepView.vue         # 三步学习流程的统一容器
│   ├── DetailView.vue       # 详情页（内容汇总）
│   ├── StudentLoginView.vue # 学生登录
│   ├── TeacherLoginView.vue # 教师登录
│   ├── AdminConsoleView.vue # 管理后台
│   └── ...
├── App.vue             # 根组件
└── main.ts             # 应用入口（Pinia + Router + AuthGuard 初始化）
```

### 3.2 分层设计

```
┌─────────────────────────────────────────────────────────┐
│  Views（页面级）         ─ 路由挂载点，组装子组件          │
├─────────────────────────────────────────────────────────┤
│  Components（视图组件）  ─ 纯 UI 展示，数据由 props 注入 │
│  ClassPicker / Level1Quiz / VideoPlayer / ...            │
├─────────────────────────────────────────────────────────┤
│  Composables（业务逻辑） ─ 可复用的业务行为封装            │
│  useNavigation / useDataLoader / useTracking / ...       │
├─────────────────────────────────────────────────────────┤
│  Adapters（数据适配）    ─ 后端 JSON → 前端组件模型       │
│  quizAdapter / dialogAdapter / multiPoleAdapter / ...    │
├─────────────────────────────────────────────────────────┤
│  Services + Utils       ─ API 调用层 + 纯工具函数        │
│  apiService / studentService / api.ts / localStorage.ts │
├─────────────────────────────────────────────────────────┤
│  Stores（全局状态）      ─ Pinia auth / student / bgm    │
└─────────────────────────────────────────────────────────┘
```

**为什么要这么分层？**

> 核心原则：**组件不直接 fetch，不直接读 localStorage，不直接 router.push**。
> 
> - **Adapter 层**隔离了后端 JSON schema 和前端组件模型的差异。后端字段用 `snake_case`（`question_number`），前端组件用 `QuizItem` interface（`questionNumber`），adapter 做转换。好处：后端字段变更只改 adapter，组件零感知。
> - **Composables** 把"业务行为"从组件里抽走。`useDataLoader` 封装了 fetch + 缓存 + Worker 解析 + 超时重试 + URL 变化自动重载，组件只消费 `{ loading, data, error }`。
> - **Services** 是高层 API 封装（`studentService.list()`），`utils/api.ts` 是低层 fetch 工具——两层分离让 `api.ts` 可以被所有 service 复用统一的 401 处理、鉴权头注入、超时控制。

### 3.3 Composables 核心详解

#### 3.3.1 `useNavigation` — 统一导航

```ts
const { goNext, goPrev, goHome, hasNext, hasPrev } = useNavigation('stepone', 'WEN_01')
```

**关键设计点：**

1. **单一事实源**：页面跳转顺序从 `config/navigation.ts` 的 `pageSequence` 读取，不是在组件里硬编码 `router.push('/steptwo')`。好处：调整页面顺序只改 config 文件。
2. **跳转耗时监控**：`goNext` 内部用 `performance.now()` 测同步阶段耗时 + 端到端耗时，超过 500ms 阈值会上报埋点。这是团队对"交互响应 < 0.5s"目标的量化追踪。
3. **三层 fallback**：`router.push → router.replace → window.location.href`。任何一层失败都有下一层兜底，防止"点击无反应"。
4. **后退按钮识别**：`goPrev` 调用 `markNextEnterFromBackButton()`，下个页面 `useTracking` 的 step_enter 会带上 `from_back_button=true`，区分"主动点后退"和"浏览器后退按钮"。

#### 3.3.2 `useDataLoader` — JSON 加载引擎

```ts
const { loading, data, error, isTimeout, load, retry } = useDataLoader(
  () => `https://oss-classicalab.cn/data/level1_quiz/${wenId}.json`,
  { cacheEnabled: true, cacheTTL: 5 * 60 * 1000, retryCount: 1 }
)
```

**关键设计点：**

1. **Web Worker 解析 JSON**：大 JSON（几十到几百 KB）的 `JSON.parse` 会阻塞主线程导致页面掉帧。Worker 隔离了解析工作，`useDataLoader` 内部有消费者计数 + 空闲自动回收（10s 无活跃则 terminate）。
2. **模块级 LRU 缓存**：基于 `Map` 插入顺序的 O(1) LRU（不是数组 `indexOf + splice` 的 O(n)），最多 100 条，TTL 5 分钟。命中缓存直接返回，不再走网络。
3. **超时 / 主动取消区分**：AbortController 的 `signal.reason` 区分两种 abort——超时才设置 `isTimeout=true` 并弹"请求超时"，主动取消（切 URL / 卸载组件）静默处理。
4. **指数退避重试**：网络抖动时自动重试（默认 1 次，backoff 1s/2s/4s），但超时不重试（超时后再重试大概率还是超时）。

#### 3.3.3 `useTracking` — 行为埋点

```ts
track('step_enter', 'stepone', { step_id: 'stepone', from_back_button: false })
```

**关键设计点：**

1. **缓冲队列 + 节流上报**：前端埋点事件先写入内存队列（`pendingEvents`），每 3 秒或队列满 20 条批量 POST `/api/track`。避免每个事件一次 fetch 把带宽打爆。
2. **session_id 管理**：每次登录或登出时 `resetSessionId()`，埋点携带当前 session_id 让后端能重建完整的用户行为路径。
3. **免登录上报**：`/api/track` 不需要 JWT（前端可能在未登录状态下触发 step_enter），但后端用 `session_id` + `user_id` 关联。

### 3.4 鉴权流

```
┌──────────────┐     POST /api/auth/student/login       ┌──────────────┐
│  前端登录页   │ ──────────────────────────────────────► │  后端 auth   │
│              │     { student_id, password }           │  Controller  │
└──────┬───────┘                                        └──────┬───────┘
       │                                                        │ bcrypt.compare
       │◄────────────────── { token, user } ──────────────────┘ │ jwt.sign(..., JWT_SECRET)
       │                                                        │
       │ Pinia store 持久化:                                    │
       │ localStorage.authData = { token, user }                │
       │                                                        │
       ▼                                                        │
┌──────────────┐     请求拦截（api.ts getAuthHeaders）          │
│  业务 API    │ ──────────────────────────────────────────────►│
│              │     Authorization: Bearer <token>              │
└──────┬───────┘                                                │
       │◄─────────── 401 (AUTH_REQUIRED / AUTH_EXPIRED) ─────────┘
       │
       │ api.ts handleResponse:
       │   if AUTH_REQUIRED → 不登出，直接透传（登录页可能触发）
       │   if AUTH_EXPIRED → authStore.logout() + 跳转登录页
       │
       │ 路由守卫（guards.ts setupAuthGuard）:
       │   每次导航前检查 token.isTokenExpiringSoon()
       │   → 剩余 < 5 分钟时主动调 /api/auth/refresh
       │   → 彻底过期时 logout() 并 redirect 到 /student-login?redirect=<原目标>
```

**设计要点：**

- **F-004 主动续期**：token 剩余寿命不足 5 分钟时，路由守卫自动调 `/api/auth/refresh`。避免"用户用着用着突然被踢"的糟糕体验。
- **401 语义区分**：后端返回的 401 有三种 error code——`INVALID_CREDENTIALS`（登录密码错）、`AUTH_REQUIRED`（没带令牌）、`AUTH_EXPIRED`（令牌过期）。前端分别处理：密码错误不登出，过期才登出。
- **Pinia 未就绪兜底**：`api.ts` 的 `getAuthHeaders()` 先尝试 `useAuthStore().token`，如果 Pinia 还没安装（比如应用初始化早期），回退到 `localStorage.getAuthData().token`。这避免了"初始化竞态导致匿名请求"。

### 3.5 路由守卫详解

```ts
// router/guards.ts setupAuthGuard()
router.beforeEach((to, from, next) => {
  // 1. token 过期 → 自动登出
  if (authStore.token && authStore.isTokenExpired()) {
    authStore.logout()
  }
  // 2. token 临近过期 → 主动续期（异步，不阻塞导航）
  else if (authStore.token && authStore.isTokenExpiringSoon()) {
    void authStore.refreshToken().catch(() => { /* 失败不登出 */ })
  }
  // 3. 需要登录但未登录 → redirect 到登录页 + 携带 redirect
  if (to.meta.requiresAuth && !isLoggedIn.value) {
    next({ name: 'student-login', query: { redirect: to.fullPath } })
    return
  }
  // 4. 角色检查（admin-console 只允许 admin）
  const requiredRole = to.meta.role
  if (to.meta.requiresAuth && requiredRole && authStore.user?.role !== requiredRole) {
    next({ path: '/' })
    return
  }
  next()
})
```

### 3.6 Adapter 层设计

**为什么需要 Adapter 层？**

后端 JSON schema（由 Python 数据管线生成）用 `snake_case`，且字段名和业务含义是面向后端/数据侧的。而前端组件需要的是面向 UI 的模型。Adapter 层就是这两者之间的翻译器。

```
后端 JSON（quizAdapter.ts 输入 BlockQuizData）:
{
  "text_id": "WEN_01",
  "question_id": "Q001",
  "question_number": 1,
  "question_text": "下列哪个是'之'的意思？",
  "option_a": "的",
  "option_b": "去",
  "option_c": "这",
  "option_d": "到",
  "correct_answer": 0,
  "audio_file": null
}

adapter 转换后（QuizItem interface）:
{
  textId: "WEN_01",
  questionId: "Q001",
  questionNumber: 1,
  questionText: "下列哪个是'之'的意思？",
  options: [
    { label: "A", value: "的" },
    { label: "B", value: "去" },
    { label: "C", value: "这" },
    { label: "D", value: "到" }
  ],
  audioFile: null,
  correctAnswer: 0,
  ...
}
```

还有一层价值：**字段缺失兜底**。Python 转换层可能漏填某个字段（比如 `correct_answer` 为空），adapter 会用 `?? null` / `|| '默认值'` 兜底，保证组件拿到的是一份完整数据。

### 3.7 全局状态（Pinia Stores）

| Store | 职责 | 持久化 |
|---|---|---|
| `auth.ts` | JWT token + 用户信息 + 自动续期 + 令牌过期检测 | localStorage（`getAuthData`/`setAuthData`） |
| `student.ts` | 学号（历史遗留，auth.ts 已覆盖） | localStorage |
| `bgm.ts` | 背景音乐播放状态 | sessionStorage |

**auth.ts 核心方法：**

| 方法 | 说明 |
|---|---|
| `initialize()` | 应用启动时从 localStorage 恢复登录态 |
| `login(id, pwd, role)` | 三角色通用登录（student/teacher/admin），自动路由到对应 endpoint |
| `logout()` | 清除 token + user + localStorage + 重置 session_id |
| `refreshToken()` | 调 `/api/auth/refresh` 续期令牌 |
| `isTokenExpired()` | 本地解码 JWT payload.exp，判断是否过期 |
| `isTokenExpiringSoon(thresholdMs)` | 剩余寿命 < 阈值（默认 5 分钟） |
| `getTokenExpiryMs()` | 解码 JWT 得到过期时间戳 |

---

## 4. 后端架构（Node.js + Express + SQLite）

### 4.1 目录结构

```
backend/
├── src/
│   ├── app.js                    # Express 应用工厂 + 启动入口
│   ├── config/
│   │   ├── app.js                # 端口/CORS/JWT/限流/AI 配额等配置
│   │   └── database.js           # SQLite 连接 + 建表 + 迁移 + 种子数据
│   ├── controllers/              # 请求处理器（14 个）
│   │   ├── authController.js
│   │   ├── answerController.js
│   │   ├── textsController.js
│   │   ├── studentController.js
│   │   ├── teacherController.js
│   │   ├── adminController.js
│   │   ├── aiController.js
│   │   ├── assetController.js    # Figma 资产上传
│   │   ├── trackingController.js        # 埋点上报（免登录）
│   │   ├── trackingAnalysisController.js# 埋点分析（看板密码）
│   │   ├── dashboardController.js
│   │   ├── exportController.js
│   │   ├── resourceController.js # 音视频资源上传（教师）
│   │   └── exportController.js
│   ├── middleware/
│   │   ├── authMiddleware.js           # JWT 鉴权 + RBAC 角色校验
│   │   ├── rateLimitMiddleware.js      # 5 级限流（全局/提交/查询/登录/AI）
│   │   ├── dashboardAuthMiddleware.js  # 看板密码（非 JWT，用于数据看板）
│   │   ├── assetAuthMiddleware.js      # ASSET_SYNC_TOKEN（Figma 插件）
│   │   └── errorHandler.js             # 全局错误处理 + 请求日志
│   ├── routes/
│   │   └── index.js             # 统一注册路由（14 组）
│   ├── services/                 # 业务逻辑层
│   │   ├── authService.js       # 密码哈希/班级权限/密码重置审计
│   │   ├── answerService.js     # 答题事务/答案比对/批量写入
│   │   ├── textsService.js      # JSON 文件读取封装
│   │   ├── aiService.js         # DeepSeek 调用/并发控制/配额管理
│   │   ├── assetService.js      # OSS 上传/MD5 去重/版本管理
│   │   ├── trackingService.js   # 埋点批量写入
│   │   ├── studentService.js    # 学生 CRUD
│   │   ├── teacherSync.js       # 教师后台同步（异步）
│   │   └── aiAlerts.js          # AI Key 启动检查
│   ├── utils/
│   │   ├── dbPromise.js         # SQLite Promise 封装（dbRun/dbGet/dbAll/dbTransaction）
│   │   ├── jsonReader.js        # JSON 文件读取（fs.readFileSync + safeParse）
│   │   ├── answerUtils.js       # 答案比对逻辑（独立于 controller/service）
│   │   ├── logger.js            # 统一日志（info/warn/error/logOperation）
│   │   └── duration.js          # 时长格式化工具
│   └── server.js                 # 进程入口（调 createApp + startServer）
├── data/                         # JSON 数据目录（与 public/data 同结构）
│   ├── text_basic_info/WEN_01.json
│   ├── level1_quiz/WEN_01.json
│   ├── answer_records.json       # 后端专属（旧格式答题记录）
│   └── students.json             # 后端专属（旧格式学生）
├── database/                     # SQLite 文件（运行时生成）
│   └── answers.db
├── tests/                        # Jest 单元测试（~20 个测试文件）
├── scripts/                       # 运维脚本
├── ecosystem.config.js           # PM2 配置
├── package.json
└── .env.example
```

### 4.2 三层架构

```
HTTP Request
    │
    ▼
┌──────────────────────────────┐
│  Middleware 层（横切关注点）    │
│  helmet / CORS / rate-limit   │
│  authMiddleware (JWT + RBAC)  │
│  rateLimitMiddleware         │
│  errorHandler                 │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Controller 层（请求处理）      │
│  参数校验 → 调 service 方法    │
│  统一 response 格式 {success,data,error} │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Service 层（业务逻辑）        │
│  事务控制 / 复杂查询 / 跨表操作 │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Utils 层（底层能力）          │
│  dbPromise / jsonReader / ... │
└──────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│  SQLite（answers.db）          │
└──────────────────────────────┘
```

**为什么要三层分离？**

> Controller 只做"HTTP 协议"相关的事（解析 body、校验参数、组织响应）。Service 只做"业务"（事务、跨表查询、复杂计算）。这样换数据源时只需改 service，换协议只需改 controller。

### 4.3 路由全景

| 分类 | 路由前缀 | 鉴权 | 限流 | 说明 |
|---|---|---|---|---|
| **认证** | `/api/auth/*` | — | loginRateLimit | 学生/教师/管理员登录、注册、改密、刷新令牌 |
| **教师→学生** | `/api/teacher/students/*` | JWT + teacher | — | 本班学生 CRUD + 批量导入 + 重置密码 |
| **管理员→教师/学生** | `/api/admin/*` | JWT + admin | — | 全校教师/学生管理 + 教师审批 + 密码重置审计 |
| **学生公开查询** | `/api/students/:id/name` | — | — | 登录页回显姓名（仅返回学号+姓名） |
| **文本数据** | `/api/texts/*` | — | — | 8 种文本数据接口（后端直接读 JSON 文件） |
| **答题提交** | `/api/submit` | JWT（学生） | submitRateLimit (10/min) | 答题事务写入 |
| **答题查询** | `/api/answers/*` | JWT + teacher/admin | queryRateLimit (30/min) | 按 wenId 或 studentId 查询 |
| **埋点上报** | `/api/track` | — | — | 前端行为埋点批量写入 |
| **埋点分析** | `/api/tracking/*` | dashboardAuth | — | 漏斗/会话/留存等分析（看板密码） |
| **数据看板** | `/api/home/dashboard` | dashboardAuth | — | 看板汇总数据 |
| **AI 对话** | `/api/ai/chat` | JWT + student | aiChatRateLimit (15/min per student) | DeepSeek 调用 |
| **AI 配额** | `/api/ai/quota` | JWT + student | — | 查询日/周/月配额 |
| **Figma 资产** | `/api/assets/*` | ASSET_SYNC_TOKEN | — | Figma 插件上传到 OSS |
| **资源上传** | `/api/upload/resource` | JWT + teacher/admin | — | 音视频资源上传到 OSS |
| **导出** | `/api/export/*` | dashboardAuth | — | 数据导出（tracking/answers/summary） |

### 4.4 安全架构详解

#### 4.4.1 五层限流策略

```js
// rateLimitMiddleware.js

globalLimiter    // 100 次/15 分钟/IP — 全局兜底
loginRateLimit   // 5 次/分钟/IP — 防暴力破解
submitRateLimit  // 10 次/分钟/IP — 答题提交
queryRateLimit   // 30 次/分钟/IP — 答题查询
aiChatRateLimit  // 15 次/分钟/学生ID — AI 对话（keyGenerator 绑定 student_id）
```

**为什么 AI 限流绑 student_id 而不是 IP？**

> 一台电脑可能共享给多个学生用（计算机房场景），如果按 IP 限流，第一个用完 15 次后面的同学就被挡住了。绑 student_id 更精准——每个学生独立计数。

#### 4.4.2 JWT + RBAC 鉴权

```js
// authMiddleware.js
function requireAuthMiddleware(req, res, next) {
  // 1. 解析 Bearer Token → jwt.verify
  // 2. 写入 req.user = decoded payload
  // 3. 过期/无效 → 401 AUTH_FAILED
}

function requireRole(roles) {
  // 1. 检查 req.user.role 是否在允许列表
  // 2. teacher 角色额外查数据库验证账号 status='active'
  // 3. 禁用 → 403 ACCOUNT_DISABLED
}
```

**三角色权限矩阵：**

| 资源 | student | teacher | admin |
|---|---|---|---|
| `/api/submit` 提交答题 | ✅ | — | — |
| `/api/teacher/students/*` 本班学生 | — | ✅ | — |
| `/api/admin/*` 全校管理 | — | — | ✅ |
| `/api/answers/*` 答题查询 | — | ✅ | ✅ |
| `/api/tracking/*` 埋点分析 | — | — | ✅（看板密码） |
| `/api/ai/chat` AI 对话 | ✅ | — | — |

#### 4.4.3 安全头与 CSP

```js
// helmet 配置（仅后端 API，默认严格 CSP）
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,  // Figma 插件 data: iframe 需要
})
```

#### 4.4.4 dashboardAuthMiddleware — 看板密码（非 JWT）

数据看板（`dashboard.html`）是独立 HTML，登录态和业务 API 不共享 JWT，用单独的 `DASHBOARD_PASSWORD` 环境变量 + session cookie 保护。这是为了避免"拿到业务 JWT 就能看全量数据"的权限越界风险。

#### 4.4.5 AI 安全：并发控制 + 配额 + 内容审核

| 层 | 机制 | 参数 |
|---|---|---|
| **并发** | 信号量（内存级） | 每学生 2 并发 / 全局 10 并发 |
| **限流** | express-rate-limit | 15 次/分钟/学生 |
| **配额** | SQLite 三档 quota 表 + 原子事务 | 日/周/月三档，超限阻断 |
| **超时** | Promise.race（fetch vs 15s timeout） | — |
| **重试** | 指数退避（仅网络错误/5xx） | 最多 2 次 |
| **内容审核** | MODERATION_KEYWORDS 关键词后处理 | 自杀/色情/政治/违法 |
| **输出清洗** | URL 替换为 `<code>` 标签 | 防止诱导外链 |

### 4.5 SQLite 设计

#### 4.5.1 表结构

| 表 | 用途 | 关键字段 |
|---|---|---|
| `schools` | 学校字典 | `code UNIQUE, name` |
| `admins` | 管理员账号 | `username UNIQUE, password_hash (bcrypt), role` |
| `teachers` | 教师账号 | `phone UNIQUE, password_hash, status (active/pending/rejected), can_view_all` |
| `students` | 学生账号 | `student_id UNIQUE, class_code, password_hash, must_reset_password` |
| `teacher_classes` | 教师-班级关系 | `teacher_id + class_code UNIQUE` |
| `answers` | 答题记录 | `student_id, wen_id, question_id, user_answer, correct_answer, attempt_number` |
| `tracking_events` | 行为埋点 | `user_id, session_id, event_type, step_id, properties (JSON)` |
| `password_resets` | 密码重置审计 | `target_type, target_id, reset_by_type, reset_by_id` |
| `ai_quota_daily/weekly/monthly` | AI 配额（三档） | `student_id + period UNIQUE, used_tokens` |
| `ai_usage` | AI 用量记录 | `student_id, wen_id, prompt_tokens, completion_tokens` |

**索引（answers 表为核心查询加速）：**
```sql
CREATE INDEX idx_answers_wen_id ON answers(wen_id)
CREATE INDEX idx_answers_student_id ON answers(student_id)
CREATE INDEX idx_answers_wen_student ON answers(wen_id, student_id)
CREATE INDEX idx_answers_student_wen_q ON answers(student_id, wen_id, question_id)
```

#### 4.5.2 数据库初始化流程

```
initAllTables()
  ├── 连接 SQLite → 设置 WAL 模式 + 外键
  ├── CREATE TABLE IF NOT EXISTS schools
  ├── CREATE TABLE IF NOT EXISTS admins
  ├── CREATE TABLE IF NOT EXISTS teachers → checkAndUpgradeTeachersTable()（ALTER ADD COLUMN）
  ├── checkAndUpgradeStudentsTable()（新结构 CREATE / 旧结构迁移）
  ├── CREATE TABLE IF NOT EXISTS teacher_classes
  ├── CREATE TABLE IF NOT EXISTS password_resets
  ├── CREATE TABLE IF NOT EXISTS answers
  │   └── migrateAnswersTableIfNeeded()（旧版去 UNIQUE 约束）
  ├── CREATE TABLE IF NOT EXISTS tracking_events
  ├── CREATE INDEX IF NOT EXISTS ...（14 个索引）
  ├── seedDefaultSchool()（空表时插入默认学校）
  ├── seedDefaultAdmin()（空表时插入 admin/admin123）
  └── seedTestStudent()（非生产环境插入 99999999/99999999）
```

**自动损坏恢复**：连接或初始化过程中检测到 `SQLITE_CORRUPT` → 备份损坏文件（`.corrupted.<timestamp>`）→ 重连 → 重试 init。

**为什么选 SQLite 而不是 MySQL？**

| 维度 | SQLite | MySQL |
|---|---|---|
| 部署成本 | 零——单文件 | 要装服务 + 运维 |
| 备份 | `cp answers.db` | mysqldump |
| 并发 | WAL 模式支持多读者单写者 | 多进程多线程 |
| 适用场景 | 单机中小规模（本项目学生数 < 10000） | 高并发多实例 |

当前项目后端是 **PM2 单实例** + **宝塔单机**，并发量不大。SQLite WAL 模式下读不阻塞写、写不阻塞读，完全够用。数据库文件是 `.db`，可以直接 `cp` 备份、直接 git push 到测试环境，运维成本极低。

### 4.6 dbPromise — SQLite Promise 封装

原生 sqlite3 是 callback 风格，`dbPromise.js` 提供了：

```js
async function dbRun(db, sql, params) { /* 返回 { changes, lastID } */ }
async function dbGet(db, sql, params) { /* 返回单行对象或 undefined */ }
async function dbAll(db, sql, params) { /* 返回数组 */ }
async function dbTransaction(db, callback) { /* 事务，callback 接收 (dbRun, dbGet, dbAll) */ }
```

事务的价值在 `answerService.submitAnswers()`——批量提交 N 道题，任一题插入失败就整体回滚，避免"部分成功"脏数据。

### 4.7 答题提交流程

```
前端 POST /api/submit
  │  body: { studentId, wenId, submittedAt, answers: {Q001: 'A'}, questions: [...] }
  ▼
answerController.submitAnswers（JWT + submitRateLimit）
  │  参数校验
  ▼
answerService.submitAnswers(data)
  │
  ├── 1. ensureStudentInfo() — 自动注册/更新学生信息
  │
  ├── 2. dbTransaction(db, async (tx) => {
  │       for each question:
  │         ├── 从 backend/data/level1_quiz/<wenId>.json 读取 correct_answer
  │         ├── compareAnswers(userAnswer, correctAnswer) → is_correct, score
  │         └── INSERT INTO answers (...)
  │     })  ← 任一题失败整体回滚
  │
  └── 3. （异步 fire-and-forget）syncToTeacherBackend()
         不阻塞主流程，失败不影响提交结果
```

### 4.8 JSON 数据读取

后端 `textsService` 直接从 `backend/data/` 读 JSON 文件，不查 SQLite：

```js
// textsService.js
function getLevel1Quiz(textId) {
  const filePath = getDataFilePath('level1_quiz', `${textId}.json`)
  return readJsonFile(filePath)  // fs.readFileSync + JSON.parse
}
```

**为什么后端不把学习内容存数据库？**

> 学习内容是**静态内容**（每篇文言文的字词/朗读/测验题库不会频繁变更），用 JSON 文件有三个好处：
> 1. Python 数据管线直接输出 JSON，不需要再插数据库
> 2. 前端直接 fetch 同一个 JSON（走 OSS CDN），不需要后端转发
> 3. git 可版本化——每次数据变更就是一次 commit，可 diff 可回滚

---

## 5. 数据管线（Python）

### 5.1 架构

```
Excel 源文件（data-pipeline/source/开发需求填写.dbt.xlsx）
    │
    │  openpyxl 读取每个 sheet
    ▼
utils/
  ├── excel_reader.py    # open_workbook / get_english_sheets
  ├── json_writer.py     # 按 text_id 分组写入 public/data/<subdir>/<text_id>.json
  └── data_transformer.py
transformers/             # 每种内容一个 transformer（8 个）
  ├── level1_quiz.py
  ├── level1_word_list.py
  ├── culture_cards.py
  ├── level1_multi_role_reading.py
  ├── level2_dialog_quiz.py
  ├── level3_adaptive_quiz.py
  ├── text_basic_info.py
  └── __init__.py        # TRANSFORM_MAP = {sheet_name: transformer_func}
    │
    ▼
generate_all_json.py     # 转换层唯一事实源
    │  main(excel_file, public_data_dir)
    ▼
public/data/<subdir>/<text_id>.json
    │
    │ data_processor/main.py（协调层）
    ▼
IncrementalProcessor     # 文件级 diff（sha1 哈希）
VersionManager           # public/data/ 目录快照
_sync_public_to_backend  # 同步到 backend/data/（保留后端专属文件）
```

### 5.2 两层职责分离

| 层 | 文件 | 职责 | 不负责 |
|---|---|---|---|
| **转换层** | `generate_all_json.py` + `transformers/` + `utils/` | Excel → JSON 字段转换 | 增量检测、版本、上传 |
| **协调层** | `data_processor/main.py` + `IncrementalProcessor` + `VersionManager` | 编排全流程 + 增量 + 版本 + 同步 | 不重复实现 Excel→JSON 转换 |

**为什么分两层？**

> 早期把所有逻辑堆在 `main.py` 里，导致一个文件 2000+ 行、Python 测试用例写起来困难。分两层后：
> - **转换层**可以独立测试——给它一个 Excel 路径，它输出 JSON，不关心版本和增量
> - **协调层**可以独立测试——给它一组 JSON 哈希，它输出 diff，不关心 Excel

### 5.3 增量检测

```python
# IncrementalProcessor
# 计算每个子目录下每个 text_id.json 的 sha1 哈希
# 与 .pipeline_state.json（上次运行的快照）对比
# 输出 (added: [...], changed: [...], removed: [...])
proc = IncrementalProcessor(state_file)
added, changed, removed = proc.collect_changes('level1_quiz', current_hashes)
proc.commit('level1_quiz', current_hashes)  # 更新状态
proc.flush()  # 写入磁盘
```

### 5.4 版本管理

```python
# VersionManager
# 把整个 public/data/ 目录复制一份到 .pipeline_versions/<timestamp>/
# 同时生成 manifest.json（每个文件的 sha1 + 大小）
manager = VersionManager(version_dir)
meta = manager.create_version(public_data_dir, note='auto snapshot')

# 回滚
manager.restore_version(version_id, public_data_dir, overwrite=True)
```

### 5.5 同步 public/data → backend/data

```python
# _sync_public_to_backend()
# 只覆盖同名文件，不删除 backend/data/ 中没有的
# 保留 answer_records.json / students.json 等后端专属文件
```

**为什么不同步后端专属文件？**

> `public/data/` 只有学习内容（JSON），但 `backend/data/` 还有运行时数据（旧格式答题记录、学生名单）。同步时只覆盖交集，两边各保留自己的文件。

### 5.6 CLI 入口

```bash
cd data-pipeline/python
pip install -e .          # 可编辑模式安装（pyproject.toml）

# 全流程
python -m data_processor.main run
python -m data_processor.main run --source tencent  # 从腾讯文档导出目录

# 状态查询
python -m data_processor.main status

# 版本管理
python -m data_processor.main version list
python -m data_processor.main version restore --version-id v20261023
```

### 5.7 转换层 transformer 示例

```python
# transformers/level1_quiz.py（简化）
def transform(df) -> Dict[str, List[Dict]]:
    """
    输入: pandas DataFrame（从 Excel sheet 读取）
    输出: { 'WEN_01': [{question_number, question_text, option_a, ...}, ...], 'WEN_02': [...] }
    """
    # 按 text_id 分组
    grouped = df.groupby('text_id')
    result = {}
    for text_id, group in grouped:
        questions = []
        for _, row in group.iterrows():
            questions.append({
                'question_number': row['question_number'],
                'question_text': row['question_text'],
                'option_a': row.get('option_a', ''),
                # ...
            })
        result[text_id] = questions
    return result
```

### 5.8 路径解析约定

所有路径都基于 `_SCRIPT_DIR`（文件自身所在目录）计算，**不依赖 cwd**：

```python
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PIPELINE_ROOT = os.path.dirname(_SCRIPT_DIR)

DEFAULT_EXCEL_FILE = os.path.join(_PIPELINE_ROOT, 'source', '开发需求填写.dbt.xlsx')
DEFAULT_PUBLIC_DATA_DIR = os.path.normpath(os.path.join(_SCRIPT_DIR, '..', '..', 'public', 'data'))
```

这样无论是从根目录运行 `python data-pipeline/python/...` 还是从 Python 目录运行，路径都正确。

---

## 6. CI/CD 与部署架构

### 6.1 多环境部署矩阵

| 分支 | Workflow | 前端目标 | 后端目标 | 域名 |
|---|---|---|---|---|
| `trae/agent-*` / `feature/**` | CI Checks | 不部署 | 不部署 | — |
| `feature-1` | Deploy Frontend Test + Deploy Backend Test | OSS `wenyan-test-online` | PM2 `-test` @ :3001 | `test.classicalab.cn` / `test-api.classicalab.cn` |
| `main` | Deploy Frontend Prod + Deploy Backend Prod | OSS `classic-chinese` | PM2 `wenyan-backend` @ :3000 | `www.classicalab.cn` / `api.classicalab.cn` |

### 6.2 GitHub Actions Workflow 总览

| Workflow | Jobs | 触发 |
|---|---|---|
| **ci-checks.yml** | quality-check（type-check + lint + vitest）<br>backend-check（syntax + Jest）<br>pipeline-test（pytest）<br>figma-plugin-check（type-check + build + 同步校验）<br>secret-scan（gitleaks）<br>circular-check（循环依赖检测） | push PR 到 main/feature-1<br>push trae/agent-* / feature-* / feature-1 |
| **deploy-frontend-test.yml** | 构建 + ossutil 上传 | push feature-1 + src/public 变更 |
| **deploy-backend-test.yml** | SSH + git pull + npm install + PM2 start + health check | push feature-1 + backend 变更 |
| **deploy-frontend.yml** | 构建 + ossutil 上传 + CloudFront 失效 | push main |
| **deploy-backend.yml** | SSH + git pull + npm install + PM2 全新启动 + health check + 数据库恢复兜底 | push main |

### 6.3 CI Checks 详解

```
quality-check job:
  node 20 → npm install → npm run type-check → npm run lint (continue-on-error) → npm run test

backend-check job:
  node 20 → cd backend → npm install → node -c server.js → npm test (DB_PATH=':memory:')

pipeline-test job:
  python 3.11 → pip install -e "data-pipeline/python[test]" → cd data-pipeline/python → pytest -v

figma-plugin-check job:
  node 20 → cd figma-plugin → npm install → npm run type-check → npm run build
  → 校验 code.js 是否与 code.ts 同步（git diff --exit-code -- code.js）

circular-check job:
  node 20 → npm install circular-dependency-scanner → npx circular-dependency-scanner src/

secret-scan job:
  checkout (fetch-depth=0) → gitleaks/gitleaks-action
```

### 6.4 后端部署流程（生产 deploy-backend.yml）

```yaml
# 核心步骤
1. Set up SSH (webfactory/ssh-agent@v0.8.0 + SSH_PRIVATE_KEY)
2. ssh-keyscan → known_hosts（不StrictHostKeyChecking=no）
3. SSH 到服务器:
   a. git clone / fetch / checkout / reset --hard
   b. 创建 backend/.env（PORT=3000, CORS_ORIGIN, JWT_SECRET 保留备份或读 Secret）
   c. 释放 3000 端口：
      - pm2 delete wenyan-backend
      - docker ps -a | grep 3000 → docker rm -f
      - fuser -k 3000/tcp
   d. cd backend && rm -rf node_modules && npm install --production（不用 npm ci！）
   e. pm2 start server.js --name wenyan-backend
   f. Health check（6 次重试，每次 10s）
   g. 失败时尝试 rm answers.db + pm2 restart（数据库损坏兜底）
```

**为什么生产环境从 backend 目录启动 PM2？**

> 后端用 `dotenv`，默认在**当前工作目录**查找 `.env`。如果从项目根目录启动 `pm2 start backend/server.js`，dotenv 找不到 `.env`，端口就用默认值 3001（而不是 3000），导致 Nginx 反代失败。必须 `cd backend && pm2 start server.js`。

### 6.5 前端部署流程

```yaml
1. npm install
2. npm run build（注入 VITE_API_BASE_URL 环境变量）
3. 下载 ossutil
4. ossutil cp -r ./dist oss://classic-chinese/ --acl public-read
5. CloudFront create-invalidation（/*）
```

**为什么 OSS 上传必须 `--acl public-read`？**

> OSS bucket 默认权限是 `private`，不传 `--acl public-read` 上传的文件只有 bucket owner 能读，前端访问返回 403。这是项目血泪教训之一。

### 6.6 数据库损坏兜底

生产部署脚本在 health check 失败后会做一次自动恢复：

```bash
# 尝试删除旧数据库让它重建
rm -f backend/database/answers.db
pm2 restart wenyan-backend --update-env
# 再做一轮 health check（最多 6 次）
```

### 6.7 分支保护

main 分支保护规则：
- ✅ Require pull request before merging
- ✅ Require approvals: 1
- ✅ Require status checks: type-check / lint / test
- ✅ Require conversation resolution
- ✅ Do not allow force pushes
- ✅ Do not allow deletions

### 6.8 环境与 Secrets

GitHub Secrets 清单：

| Secret | 用途 |
|---|---|
| `SSH_HOST` / `SSH_PRIVATE_KEY` / `SERVER_USER` | SSH 部署 |
| `SERVER_PROJECT_PATH` | 生产项目路径 |
| `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` | OSS 上传 |
| `OSS_BUCKET` / `OSS_TEST_BUCKET` | 桶名 |
| `JWT_SECRET` / `TEST_JWT_SECRET` | 后端 JWT 密钥 |
| `ASSET_SYNC_TOKEN` | Figma 插件上传鉴权 |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront CDN |

---

## 7. Figma 插件与资产同步链路

### 7.1 为什么需要 Figma 插件？

项目涉及大量 UI 图片/字体资源，传统做法是"Figma 导出 → 手动传到阿里云 OSS"。问题：
- 每次设计改了都要手动导出上传，容易漏
- 无法自动追踪哪些资源已上传、版本是否最新
- 资产命名全靠人工，容易乱

**解决方案**：Figma 插件 → 后端中转 → OSS 生产桶。设计师在 Figma 里一键导出，自动同步到生产桶。

### 7.2 链路架构

```
Figma Desktop App
    │ （设计师打开 Figma 插件）
    │
    │ figma-plugin/core.ts
    │  ├── 遍历页面节点（pageRegistry.ts 配置的节点清单）
    │  ├── figma.createImage(node.id) → 导出 PNG/SVG
    │  └── POST /api/assets/upload (multipart, ASSET_SYNC_TOKEN)
    │
    ▼
后端 assetController
    │  assetAuthMiddleware (校验 ASSET_SYNC_TOKEN ≠ JWT)
    │  multer memoryStorage（50MB 限制）
    │
    ▼
assetService.processFileUpload()
    │  ├── computeMd5(buffer)
    │  ├── isFileUnchanged() ← 读 version.json 对比 MD5
    │  ├── 相同 → skipped（不重复上传）
    │  ├── 不同 → uploadToOss(put, public-read)
    │  └── updateVersionRecord() ← 写回 version.json
    │
    ▼
阿里云 OSS 生产桶 (classic-chinese.oss-cn-zhongwei.aliyuncs.com)
    │
    │ 前端读取: VITE_OSS_BASE_URL + images/general/home_bg.png
    │
    ▼
www.classicalab.cn
```

### 7.3 双鉴权设计

后端有两套鉴权，**ASSET_SYNC_TOKEN 和 JWT 严格分离**：

| 鉴权 | 持有者 | 用途 | 存储 |
|---|---|---|---|
| JWT_SECRET | 后端服务器 | 学生/教师/管理员登录态签名 | GitHub Secret + 服务器 .env |
| ASSET_SYNC_TOKEN | 后端服务器 + Figma 插件 | 资产上传专用 | GitHub Secret + 插件打包时注入 |

**为什么分开？**

> 如果 JWT 泄露，攻击者能伪造任意用户登录态（答题、查询）。如果 ASSET_SYNC_TOKEN 泄露，攻击者最多只能往 OSS 里传文件（覆盖现有图片）。把两个风险隔离开，JWT 的高价值不会被 Figma 插件这类"相对次要"的客户端绑在一起。

### 7.4 version.json — 上传清单

```json
{
  "assets": {
    "images/general/home_bg.png": {
      "md5": "a1b2c3...",
      "size": 204800,
      "type": "image",
      "updatedAt": "2026-10-23T10:00:00Z"
    }
  },
  "lastSyncAt": "2026-10-23T10:00:00Z"
}
```

后端每次接收上传时先对比 MD5，相同就 `skipped`——避免重复上传和 OSS 流量浪费。

### 7.5 /api/assets/oss-list — 真实文件源排查

`/api/assets/version` 返回的是 version.json（上传清单），但有时候会出现"显示上传成功但实际没到 OSS"的情况（网络超时、OSS 临时错误）。`/api/assets/oss-list` 直接调 ali-oss SDK 的 `list()` 分页拉 OSS 桶实际文件，用来排查不一致。

### 7.6 Figma 插件与 wenyan-asset-sync 仓库

插件源码在主仓库 `figma-plugin/` 目录，构建产物 `code.js` 入库（Figma 直接加载它）。主仓库推送到 `main`/`feature-1` 时会自动触发 `Sync Figma Plugin to wenyan-asset-sync` workflow，创建 PR 到插件独立仓库。这是为了让 Figma 插件有独立的发布/版本管理，不绑死主仓库的发版节奏。

---

## 8. 测试策略

### 8.1 测试矩阵

| 层 | 测试框架 | 覆盖范围 | 运行命令 |
|---|---|---|---|
| **前端 Unit** | Vitest + happy-dom | utils / composables / adapters / stores / components | `npm run test` |
| **前端 Integration** | Vitest | `integration/quiz-full-flow.spec.ts` | 同上 |
| **后端 Unit** | Jest + supertest | controllers / middleware / services / utils | `cd backend && npm test` |
| **后端 DB** | Jest + sqlite3 `:memory:` | 数据库建表 / 迁移 / 种子 | 同上（CI 环境自动 DB_PATH=':memory:'） |
| **数据管线** | pytest | IncrementalProcessor / VersionManager / transformers | `cd data-pipeline/python && pytest -v` |
| **Figma Plugin** | Vitest | core.ts / mock-test | `cd figma-plugin && npm test` |
| **循环依赖** | circular-dependency-scanner | src/ 目录 TS/Vue 模块 | CI 自动运行 |
| **密钥扫描** | gitleaks | 全仓库 git history | CI 自动运行 |

### 8.2 前端测试覆盖

```
tests/
├── adapters/        quizAdapter / level1QuizAdapter
├── components/      LoginModal / VideoPlayer / WordList / MultiRoleReading / QuizCard / ...
├── composables/     useDataLoader / useNavigation / useQuizProgress / useTracking / ...
├── services/        studentService
├── stores/          auth
├── unit/            api 层（401 处理 / 鉴权头 / auth 刷新）+ adapterUtils
├── utils/           format / localStorage / tracking / wenUtils / asset
├── views/           HomeView / NewHomeView / DetailView / Step 三步 / RuleVideoView
├── integration/      quiz-full-flow.spec.ts  ← 端到端闯关流程
└── setup.ts         Vitest setup（global mocks）
```

### 8.3 后端测试覆盖

```
backend/tests/
├── middleware/      errorHandler.test.js
├── utils/           answerUtils.test.js / dbPromise.test.js / duration.test.js
├── api.test.js              ← API 基础（被 testPathIgnorePatterns 忽略，手动跑）
├── api.comprehensive.test.js ← 全链路
├── student-login.test.js     ← 学生登录/登出
├── auth-refresh.test.js      ← JWT 刷新
├── auth-service.test.js     ← bcrypt/hash
├── admin-controller.unit.test.js ← 管理员 CRUD
├── answer-p0-security.test.js    ← 答题 P0 安全（无鉴权不能提交）
├── answer-teacher-auth.test.js   ← 教师查询答题权限
├── ai-chat-security.test.js      ← AI 并发/配额/安全
├── tracking-analysis-auth.test.js ← 看板密码鉴权
├── database.test.js         ← 建表/迁移/种子
├── export-auth.test.js
├── teacher-completion.test.js
├── teacher-students.test.js
├── admin-accounts.test.js
├── seed-production.test.js  ← 生产环境种子隔离
└── wen_module.test.js      ← 文言文数据模块联调
```

**CI 环境变量：**
```yaml
DB_PATH: ':memory:'          # 内存 SQLite，不依赖文件系统
JWT_SECRET: 'ci-test-secret' # 测试密钥
NODE_ENV: test
```

### 8.4 循环依赖检测

Vue SFC + TypeScript 的 barrel 文件（`index.ts` 重导出）很容易引入循环依赖——A import B，B import A，应用启动时抛 `Cannot access 'X' before initialization`。`circular-dependency-scanner` 在 CI 里自动检测，发现即失败。

### 8.5 测试设计思想

| 思想 | 体现 |
|---|---|
| **Mock 隔离** | 前端 Vitest 用 happy-dom + 全局 fetch mock；后端 Jest 用 supertest 内存 DB |
| **参数化** | adapter 层测试多组输入/输出组合 |
| **边界条件** | 空串、null、undefined、超时、网络抖动、并发 |
| **安全优先** | `answer-p0-security.test.js` 专门覆盖"无鉴权不能提交" |
| **种子隔离** | `seed-production.test.js` 验证生产环境不播种弱口令测试账号 |

---

## 9. 关键设计决策与 Why

### 9.1 SQLite 而不是 MySQL

**决策**：选择 SQLite 3 作为后端数据库。

**Why**：
- 当前部署规模（单机 PM2、学生数 < 10000）下 SQLite WAL 模式完全够用
- **零运维成本**：单文件 `.db`，备份就是 `cp answers.db`，迁移就是 git push 到测试环境
- 宝塔面板管理单机很方便，不需要额外维护 MySQL 服务
- 如果未来并发提升（10万+ 学生多实例），可以平滑迁移到 PostgreSQL

**替代方案**：MySQL 要额外安装运维、配置主从、处理连接池，在这个规模下是 overkill。

### 9.2 Adapter 层

**决策**：在前端 utils 和组件之间加一层 `adapters/` 做数据转换。

**Why**：
- 后端 JSON schema（Python 生成）和前端组件模型天然不匹配（snake_case vs camelCase、扁平 vs 嵌套、字段命名）
- 分离"数据来源"和"UI 消费"——后端字段变更只改 adapter，组件零感知
- 字段缺失/空值兜底集中在 adapter，不用在每个组件里写 `row?.field ?? '默认值'`

### 9.3 Composables 模式

**决策**：所有业务逻辑封装在 `use*` composable 函数里。

**Why**：
- Vue 3 Composition API 把"组件实例"和"业务逻辑"解耦了——composable 不依赖 `<script setup>` 上下文，可以被任何组件消费
- `useDataLoader` 单文件实现了 fetch + 缓存 + Worker 解析 + 超时 + 重试 + 组件卸载清理 + URL 变化重载——如果把这些堆在 `<script setup>` 里，单文件会膨胀到 500+ 行且无法测试
- 测试时 composable 可以独立调用，不需要 mount 整个组件

### 9.4 Web Worker 解析 JSON

**决策**：`useDataLoader` 把大 JSON 的 `JSON.parse` 放进 Worker。

**Why**：
- 主线程解析 100KB+ JSON 会导致掉帧（JavaScript 是单线程的）
- Worker 有独立的事件循环，不阻塞 UI
- 做了消费者计数 + 空闲自动回收（10s 无活跃 terminate），不会常驻内存
- 只有在真正需要 Worker 能力时才注册消费者（避免不加载数据的页面也创建 Worker）

### 9.5 JWT + 主动续期

**决策**：JWT 无状态鉴权 + 路由守卫在令牌剩余 5 分钟时主动调 `/api/auth/refresh`。

**Why**：
- 跨域 SPA 友好（不需要 cookie + CSRF 处理）
- 无状态——后端不需要维护 session 存储（对 PM2 单进程够用）
- 主动续期避免"用户答题到一半突然被踢"的糟糕体验
- 续期失败不主动登出（网络抖动不应踢人，等真正过期再走登出分支）

### 9.6 纯 JSON 存储学习内容

**决策**：文言文内容（字词/朗读/测验）用 JSON 文件，不存数据库。

**Why**：
- **双端消费**：后端 API 读同一个 JSON（用 Node.js `fs.readFileSync`），前端也直接 fetch 同一个 JSON（走 OSS CDN），数据源只有一份
- Python 管线直接输出 JSON，不需要再插数据库（减少一层复杂度）
- git 可版本化——每次数据变更就是一次 commit，`git diff` 能直接看到改了哪道题

### 9.7 OSS 静态托管前端

**决策**：前端 `npm run build` 后上传到阿里云 OSS，绑定自定义域名。

**Why**：
- 零运维——没有前端服务器进程需要守护
- 天然 CDN 加速（OSS 绑定 CloudFront 或阿里云 CDN）
- 构建产物是纯静态 HTML/CSS/JS，OSS static website hosting 完美支持
- 成本低——OSS 流量费比服务器带宽便宜

### 9.8 PM2 守护后端

**决策**：后端用 PM2 单实例守护，不用 Docker。

**Why**：
- 宝塔面板原生支持 PM2，运维简单（`pm2 logs / status / restart`）
- 当前规模单实例够用，PM2 auto-restart 能扛住大部分 crash
- 如果未来要做多实例，可以平滑迁移到 PM2 cluster 模式 + Redis 共享限流存储
- 项目早期尝试过 Docker，但宝塔面板与 Docker 的端口管理冲突（Docker 会重启被 PM2 停掉的容器），最终回归 PM2

### 9.9 五级限流 + 按学生 AI 限流

**决策**：全局 100/15min、登录 5/min、提交 10/min、查询 30/min、AI 15/min（keyGenerator 绑定 student_id）。

**Why**：
- **AI 绑定 student_id**：计算机房场景下，一个 IP 下可能有 30 台电脑，按 IP 限流第一个用完就挡住所有人
- **登录限流 5/min**：防暴力破解——学生密码是 99999999 这种统一值，但学号是唯一的
- **提交限流 10/min**：防止机器人快速提交（虽然答题还要 JWT），但多层防御

### 9.10 三层分离：转换层 / 协调层 / 同步层

**决策**：数据管线拆成三层——`generate_all_json.py`（转换层）、`data_processor/main.py`（协调层）、`IncrementalProcessor + VersionManager`（版本层）。

**Why**：
- 早期全部堆在一个 2000 行的 main.py 里，改 Excel 转换容易误伤增量检测逻辑
- 三层分离后每层独立可测试：给转换层一个 Excel 路径它输出 JSON，给增量层一组哈希它输出 diff
- `IncrementalProcessor` 用文件级 sha1 diff 而不是 JSON 对象 diff——前者快 O(N)，后者要把每个文件 parse 成对象再 deepEqual

### 9.11 MD5 去重上传

**决策**：`assetService.processFileUpload()` 在上传前先比对 MD5，相同就 skipped。

**Why**：
- 设计师可能反复触发插件（比如 Figma 自动保存），但实际图片没改
- 不去重的话每次都上传 OSS，浪费流量 + 触发 CloudFront 失效
- MD5 比对成本极低（内存 Buffer crypto.hash），远小于一次 OSS PUT

---

## 10. 项目运行方式

### 10.1 本地开发（无本地运行环境）

本项目**不支持本地启动前后端服务**。所有开发、调试、部署都走云端：

1. 在 Trae IDE 里用 Git 管理代码
2. 提交到 `trae/agent-*` 分支 → GitHub Actions CI Checks 自动跑
3. 合并到 `feature-1` → 测试环境自动部署（`test.classicalab.cn`）
4. 测试环境验证 → 创建 PR 到 `main` → 生产部署（`www.classicalab.cn`）

### 10.2 数据更新流程

```bash
cd data-pipeline/python

# 1. 修改 Excel 源文件（data-pipeline/source/开发需求填写.dbt.xlsx）
#    或从腾讯文档导出（--source tencent）

# 2. 运行全流程
python -m data_processor.main run

# 3. 查看增量状态
python -m data_processor.main status

# 4. 回滚到历史版本（如需）
python -m data_processor.main version restore --version-id <version_id>

# 5. git add public/data/ backend/data/ → commit → push
```

### 10.3 测试账号

| 角色 | 账号 | 密码 |
|---|---|---|
| 学生（测试环境） | `99999999` | `99999999` |
| 管理员（首次部署自动播种） | `admin` | `admin123` |

### 10.4 健康检查

```bash
# 测试环境
curl http://test-api.classicalab.cn/api/health

# 生产环境
curl https://api.classicalab.cn/api/health
```

### 10.5 常用 PM2 命令（SSH 到服务器后）

```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs wenyan-backend --lines 100

# 重启并重新加载 .env
pm2 restart wenyan-backend --update-env

# 清空旧日志
pm2 flush wenyan-backend
```

### 10.6 数据库备份与恢复

```bash
# 备份
cp backend/database/answers.db answers.db.backup.$(date +%Y%m%d%H%M%S)

# 恢复
cp answers.db.backup.XXXXXX backend/database/answers.db
pm2 restart wenyan-backend --update-env
```

---

## 附录 A：API 响应格式

所有后端 API 统一返回：

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "code": 200,
  "timestamp": 1729684800000,
  "requestId": "..."
}
```

错误时：

```json
{
  "success": false,
  "error": "AUTH_FAILED",      // 机器可读的错误码
  "message": "登录已过期"       // 用户可读的描述
}
```

**错误码体系：**

| 错误码 | HTTP | 含义 |
|---|---|---|
| `AUTH_REQUIRED` | 401 | 未携带 token |
| `AUTH_FAILED` | 401 | token 无效/过期 |
| `INVALID_CREDENTIALS` | 401 | 学号/密码错误 |
| `FORBIDDEN` | 403 | 角色不足 |
| `ACCOUNT_DISABLED` | 403 | 教师账号被禁用 |
| `ACCOUNT_PENDING` | 403 | 教师账号待审批 |
| `RATE_LIMIT_EXCEEDED` | 429 | 限流触发 |
| `AI_UNAVAILABLE` | 503 | AI Key 未配置 |
| `DEEPSEEK_TIMEOUT` | 504 | AI 下游超时 |

---

## 附录 B：前端环境变量

| 变量 | 开发 | 测试 | 生产 |
|---|---|---|---|
| `VITE_OSS_BASE_URL` | — | OSS 测试桶 | `https://www.classicalab.cn` |
| `VITE_API_BASE_URL` | — | `http://test-api.classicalab.cn` | `https://api.classicalab.cn` |

---

## 附录 C：后端环境变量

| 变量 | 用途 | 默认值 |
|---|---|---|
| `PORT` | 监听端口 | 3001（测试）/ 3000（生产） |
| `NODE_ENV` | 环境标识 | — |
| `CORS_ORIGIN` | CORS 白名单（逗号分隔） | — |
| `JWT_SECRET` | JWT 签名密钥 | —（生产必填） |
| `DASHBOARD_PASSWORD` | 看板密码 | — |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | — |
| `DEEPSEEK_BASE_URL` | DeepSeek 兼容接口地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 模型名称 | `deepseek-chat` |
| `OSS_BUCKET` / `OSS_REGION` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` | OSS 配置 | — |
| `ASSET_SYNC_TOKEN` | Figma 插件上传令牌 | — |
| `DB_PATH` | SQLite 路径 | `backend/database/answers.db` |

---

## 附录 D：文言文学习流程

```
首页 NewHomeView
    │ 选择一篇文言文 WEN_01
    ▼
RuleVideoView（规则介绍视频）       ← meta.requiresAuth
    │
    ▼
StepView（StepOne）
    │ 字词学习 → WordList
    │ 多角色朗读 → MultiRoleReading
    │ 基础测验 → Level1Quiz
    ▼
RuleVideoView（规则介绍二）
    │
    ▼
StepView（StepTwo）
    │ 二级对话 → DialogText
    │ 二级测验 → BlockQuiz
    ▼
RuleVideoView（规则介绍三）
    │
    ▼
StepView（StepThree）
    │ 文化卡片 → CultureCards
    │ 情景文本 → PreQuizText
    │ 三级自适应测验 → BlockQuiz
    ▼
DetailView（详情汇总 + 查看已答题）
```

---

## 附录 E：仓库规模统计

| 指标 | 数值 |
|---|---|
| TypeScript 文件（前端） | ~100 |
| Vue SFC 文件 | ~30 |
| JavaScript 文件（后端） | ~40 |
| Python 文件（数据管线） | ~40 |
| Figma Plugin（TS） | 3 |
| 测试文件 | ~60 |
| GitHub Actions Workflows | 6 |
| SQLite 表 | 11 |
| API 路由端点 | ~50 |
| 文言文章节 | 4（WEN_01 ~ WEN_04） |

### 4.9 PM2 进程守护

后端用 PM2 守护。`ecosystem.config.js` 存在但**生产部署时不使用它**——deploy workflow 直接在服务器上执行：

```bash
cd $PROD_PATH/backend
pm2 start server.js --name wenyan-backend
```

**为什么不用 ecosystem.config.js？**

> `ecosystem.config.js` 里写死了 `cwd: './'` 和 `script: 'src/app.js'`，但 PM2 实际运行时的 cwd 和 script 路径取决于部署脚本怎么调用。deploy workflow 显式 `cd backend` + `pm2 start server.js` 更可控，也避免了"配置文件和实际启动不一致"导致的端口/dotenv 加载错误。

**PM2 auto-restart + max_memory_restart=1G** 是双保险——进程 crash 自动重启，内存超过 1G 也自动重启（防止 SQLite WAL 文件膨胀导致内存泄漏）。

### 4.10 teacherSync — 异步教师后台推送

`teacherSync.js` 是 `answerService.submitAnswers()` 的异步旁路：

```
answerService.submitAnswers()
  ├── 主流程：dbTransaction 写入 SQLite（必须成功，学生答题已落库）
  └── fire-and-forget：syncToTeacherBackend(record)（失败不阻塞）
```

**关键设计：**
- **`TEACHER_BACKEND_URL` 留空时完全跳过**——零开销，不触发任何 fetch
- **5 秒超时 + AbortController**——防止教师后台挂死时占住 Node 事件循环
- **不阻塞主流程**——学生答题已保存本地，教师后台只是"备份同步"
- **运行时 reload**——每次调用 `getConfig()` 都从 `process.env` 读，`pm2 reload --update-env` 后立即生效

### 4.11 数据看板埋点分析（trackingAnalysisController）

后端提供 **10 种分析维度**（全部读 SQLite `tracking_events` 表 + `answers` 表）：

| 接口 | 维度 | 核心指标 |
|---|---|---|
| `/api/tracking/funnel` | **步骤漏斗** | 每步 enter_count / exit_count / exit_rate / avg_duration |
| `/api/tracking/interaction` | **模块交互渗透率** | step_id × module_type × action 的调用次数 |
| `/api/tracking/search-trend` | **字词查询趋势** | top N 高频字词 + 异常检测（均值 + 3σ） |
| `/api/tracking/quiz-performance` | **闯关成绩分布** | 平均分 / 中位数 / 不及格/及格/优秀区间分布 |
| `/api/tracking/session-path` | **会话路径还原** | 每个 session 的 step_enter 序列 + 后退次数 |
| `/api/tracking/active-users` | **活跃用户** | DAU（按日）+ WAU（按周）+ 累计去重用户数 |
| `/api/tracking/hourly-activity` | **使用时段** | 0-23 小时的 step_enter 分布 |
| `/api/tracking/session-stats` | **会话时长** | 平均单会话时长 / 人均时长 |
| `/api/tracking/feature-usage` | **功能打开率** | module_type 的 session 去重渗透率 |
| `/api/tracking/cohort-analysis` | **群体差异** | 按学生得分（高/中/低 三组）对比模块使用偏好 |

**典型 SQL 示例（步骤漏斗）：**

```sql
-- exit_count: 退出 = 有 step_exit 但后续无 step_enter
SELECT e.step_id, COUNT(*) AS exit_count
FROM tracking_events e
WHERE e.event_type = 'step_exit'
  AND NOT EXISTS (
    SELECT 1 FROM tracking_events e2
    WHERE e2.session_id = e.session_id
      AND e2.event_type = 'step_enter'
      AND e2.id > e.id
  )
GROUP BY e.step_id
```

**为什么不用 ClickHouse / Elasticsearch？**

> 当前埋点量级（< 100 万条/月）下，SQLite 的 `JSON_EXTRACT` + `GROUP BY` + 索引查询完全够用。如果未来到千万级，可以考虑迁移到 ClickHouse（列式存储对聚合查询快 10-100 倍），但现阶段引入 ClickHouse 是 overkill——运维成本会翻倍。

---

## 附录 F：简历导向的项目经验总结

> 本章节专为简历/面试准备——**量化成果、技术亮点、踩坑经验、决策依据**。

### F.1 项目规模（量化）

| 指标 | 数值 |
|---|---|
| 前后端代码行数（估算） | ~30,000 行 |
| TypeScript/Vue SFC（前端） | ~130 个文件 |
| JavaScript（后端） | ~40 个文件 |
| Python（数据管线） | ~40 个文件 |
| API 路由端点 | ~50 个 |
| SQLite 表 | 11 张 |
| GitHub Actions Workflows | 6 个 |
| 单元测试用例 | ~200+（Vitest + Jest + pytest） |
| CI Jobs 数 | 6 个并行（quality / backend / pipeline / figma / secret-scan / circular-check） |

### F.2 技术亮点（面试可展开的点）

#### 亮点 1：五层架构前端 + Adapter 层解耦

**简历写法**：
> 设计了 View → Component → Composable → Adapter → Service/Utils 五层前端架构，引入 Adapter 层隔离后端 snake_case JSON schema 与前端 camelCase 组件模型，后端字段变更只改 adapter，组件零感知。

#### 亮点 2：多环境 CI/CD + PM2 + OSS 全链路自动化

**简历写法**：
> 搭建了 GitHub Actions 驱动的三环境（trae/agent-* / feature-1 / main）CI/CD 流水线——trae 分支跑 6 项 CI Checks，feature-1 自动部署测试环境（OSS 前端 + PM2 后端），main 经 PR 审批后部署生产。后端部署含端口释放、数据库自动恢复、健康检查重试等容错机制。

#### 亮点 3：Composables 模式 + Web Worker + LRU 缓存

**简历写法**：
> 核心数据加载引擎 `useDataLoader` 实现了 Web Worker JSON 解析（隔离主线程）、模块级 Map-based LRU 缓存（O(1) 命中）、指数退避重试、超时与主动取消区分、URL 变化自动重载、组件卸载清理等 7 大能力。

#### 亮点 4：完整安全体系

**简历写法**：
> 后端安全设计覆盖 helmet CSP、CORS 白名单、JWT + RBAC 三角色鉴权、五级限流（AI 绑定 student_id）、bcrypt 密码哈希、SQLite WAL + 自动损坏恢复、AI 并发信号量 + 日/周/月三档配额 + 关键词内容审核。双鉴权体系（JWT 业务 vs ASSET_SYNC_TOKEN Figma）将风险隔离。

#### 亮点 5：Python 数据管线三层分离

**简历写法**：
> 设计了转换层（Excel→JSON 字段映射）、协调层（编排全流程）、版本层（增量检测 + 目录快照）三层分离的 Python 数据处理管线，每层独立可测试。增量检测用 sha1 文件级 diff（比 JSON 对象 diff 快 O(N)），版本快照支持一键回滚。

#### 亮点 6：Figma 插件 → 后端 → OSS 闭环

**简历写法**：
> 自研 Figma 插件实现设计师一键导出 UI 资产——插件遍历 Figma 页面节点 → POST 到后端 `/api/assets/upload` → MD5 比对去重 → ali-oss SDK 上传到生产桶（public-read）→ 更新 version.json。资产变更零人工介入。

#### 亮点 7：用户行为埋点 + 10 维数据分析

**简历写法**：
> 前端埋点缓冲队列 + 3s 节流上报，后端 10 维分析（漏斗/交互/趋势/会话路径/活跃/时段/功能渗透率/群体差异），全部基于 SQLite JSON_EXTRACT 实时聚合，支持 date range 过滤。

### F.3 踩过的坑（经典错误）

| 坑 | 现象 | 根因 | 修复 | 简历可写 |
|---|---|---|---|---|
| **OSSL `npm ci`** | 后端部署后 `sqlite3` native 模块崩溃 | lock 文件与 node_modules 版本不同步，prebuild-install 加载失败 | 禁 `npm ci`，用 `npm install --production` | 设计并落地了部署红线：后端禁 `npm ci` |
| **OSS 403** | 前端访问静态资源全部 403 Forbidden | OSS bucket 默认 ACL 私有，上传没加 `--acl public-read` | ossutil 上传强制加 `--acl public-read` | OSS 部署强制 `--acl public-read`，建立了上传检查清单 |
| **PM2 路径错误** | dotenv 找不到 `.env`，端口监听 3001（默认） | 从项目根目录启动 `pm2 start backend/server.js`，dotenv cwd 查找 `.env` | `cd backend && pm2 start server.js` | 部署脚本显式声明 cwd，避免 dotenv 路径坑 |
| **auth 初始化竞态** | 应用初始化早期 API 请求没带 JWT，后端返回 401 | Pinia store 还没安装就调 `useAuthStore().token` | `api.ts` 先尝试 store，回退到 localStorage 持久化 | API 层双路径鉴权：Pinia store + localStorage 兜底，解决初始化竞态 |
| **401 语义混淆** | 所有 401 一律弹"登录已过期"，掩盖了"密码错误" | 后端 `INVALID_CREDENTIALS` 和 `AUTH_EXPIRED` 都用 401 | 前端 handleResponse 区分 errorCode：密码错误不透传，会话过期才登出 | 统一 401 语义：区分凭证错误 / 未登录 / 会话过期 |
| **SQLite 损坏** | answers.db 损坏导致后端 crash-loop | 磁盘满 / 异常断电 | 启动时 `SQLITE_CORRUPT` 检测 → 备份损坏文件 → 重连重试 | 实现了数据库自动损坏恢复机制 |
| **前端 HMAC 密钥** | 早期方案把 `VITE_AUTH_SECRET` 打进前端 bundle | HMAC 签名需要密钥，但密钥不应进客户端 | 弃用 HMAC，统一 JWT Bearer token | 前端安全设计：零服务端密钥，所有鉴权通过 JWT Bearer |
| **循环依赖** | barrel 文件 `index.ts` 重导出导致 A→B→A | TypeScript + 项目规模上来后自然触发 | CI 加 `circular-dependency-scanner` | CI 自动检测循环依赖，发现即失败 |

### F.4 设计决策备忘（面试追问时的答法）

**Q: 为什么选 SQLite 不选 MySQL？**
> 单机 PM2 + 学生数 < 10000，SQLite WAL 模式完全够用。零运维成本（单文件 + cp 备份）是核心优势。如果未来并发提升到 10 万+，可以迁移到 PostgreSQL。

**Q: 为什么前端 JSON 存 OSS 不存数据库？**
> 学习内容是静态数据，双端消费——后端 API 读 JSON 给教师/管理端，前端直接 fetch JSON 走 OSS CDN。数据源只有一份，Python 管线直接输出，git 可 diff 可回滚。

**Q: 为什么不用 Docker 要用 PM2？**
> 宝塔面板原生支持 PM2，运维简单。早期试过 Docker，但宝塔与 Docker 端口管理冲突（Docker 会重启被 PM2 停掉的容器）。如果未来要多实例，可以迁移到 PM2 cluster + Redis 限流。

**Q: AI 为什么绑 student_id 限流不绑 IP？**
> 计算机房场景，一个 IP 下可能 30 台电脑，按 IP 限流第一个用完挡住所有人。绑 student_id 更精准。

**Q: Adapter 层价值是什么？**
> 后端 JSON schema（snake_case + 面向数据）和前端组件模型（camelCase + 面向 UI）天然不匹配。Adapter 做转换，后端字段变更只改 adapter，组件零感知。

**Q: 为什么双鉴权（JWT + ASSET_SYNC_TOKEN）？**
> JWT 泄露 = 能伪造任意用户登录态。ASSET_SYNC_TOKEN 泄露 = 最多往 OSS 传文件。隔离风险，高价值不绑次要。

**Q: 401 为什么要区分语义？**
> 早期所有 401 一律弹"登录已过期"，用户密码错也被误导成"要重新登录"。区分 `INVALID_CREDENTIALS` / `AUTH_REQUIRED` / `AUTH_EXPIRED` 后，用户看到真实原因。

### F.5 可量化成果（如果有生产数据）

以下为项目当前状态可量化输出，面试时可以说"截至 XX 时间"：

| 维度 | 数据 |
|---|---|
| GitHub Actions 平均 CI 耗时 | ~3-5 分钟（并行跑 6 个 job） |
| 后端 API P99 响应时间 | < 100ms（SQLite 本地查询） |
| 前端首屏加载 | < 1s（OSS CDN + Vite build 产物 ~200KB gzipped） |
| 数据管线全流程耗时 | ~10 秒（Excel → JSON 转换 + 增量检测） |
| 测试覆盖率 | 前端 Vitest ~60% / 后端 Jest 核心路径 ~80% / Python pytest 核心 ~90% |
| 零生产事故天数 | — |

### F.6 运维工具链（scripts/ 目录）

项目有一套自研运维工具，覆盖日常开发自动化：

| 脚本 | 用途 | 技术 |
|---|---|---|
| `scripts/nightly/nightly-cli.js` | 夜间开发自动化 CLI——解析 `tasks/nightly-tasks.md`、创建分支、推送、轮询 GitHub Actions、递归合并、勾选记录 | Node.js ESM |
| `scripts/oss-auto-sync-core.js` | OSS 资源自动同步核心纯逻辑——按目录前缀分类资源、diff 本地与 OSS 清单、构建上传体 | Node.js ESM（可单测） |
| `scripts/oss-auto-sync.js` | 运维手动触发 OSS 同步的入口 | Node.js CJS |
| `scripts/upload-to-oss.js` | 一键上传构建产物到指定 OSS 桶 | Node.js |
| `scripts/check-test-env.sh` | SSH 检查测试环境健康（PM2 status + API health） | Bash |
| `scripts/fix-test-env.sh` | SSH 自动修复测试环境常见问题（端口释放 + 重启） | Bash |
| `scripts/get-actions-logs.js` | 拉取指定 GitHub Actions run 的日志（debug 用） | Node.js |

**nightly-cli.js 亮点：**
- 自动解析 `tasks/nightly-tasks.md` 的 parent/child 任务层级
- 分支保护：`main`/`master`/`develop`/`staging`/`release/staging` 禁止作为推送/合并目标
- 自动轮询 GitHub Actions 直到成功/失败，失败自动修复重试
- 合并后自动勾选 tasks.md 并记录 commit hash

### F.7 开发流程工程化（.trae/ 目录）

项目内置了完整的 AI Agent 开发流程规范：

| 目录 | 内容 | 价值 |
|---|---|---|
| `.trae/rules/project-workflow.md` | 分支策略 + CI/CD 闭环 + 环境隔离 + 部署红线 | 硬性规则，每次开发前必读 |
| `.trae/rules/security-and-environments.md` | CORS 白名单 + JWT + 限流 + CSP + SSH 安全 | 安全基线 |
| `.trae/rules/windows-shell-pitfalls-and-sync.md` | PowerShell 坑 + Git commit message 规范 | 避免重复踩坑 |
| `.trae/rules/git-commit-message.md` | Conventional Commits 格式 | commit message 统一 |
| `.trae/hooks/pre-push` | Git pre-push hook（触发前校验） | 质量门禁 |
| `.trae/commands/*.md` | 5 条开发快捷指令（add-quiz / fix-cors / start-dev 等） | Agent 快速执行 |
| `.trae/skills/*` | 4 个自定义 Skill（create-component-vue / create-excel-data / fix-api-error / naming-convention / 变更摘要） | 能力沉淀 |
| `.trae/specs/integrate-detail-ai-chat/` | AI 对话功能的完整 spec + checklist + tasks | 需求→设计→实现闭环 |

**简历可写**：
> 建立了 AI Agent 驱动的开发流程规范——4 份硬性规则（workflow / security / windows-pitfalls / git-commit）、5 条快捷指令、5 个自定义 Skill、spec → tasks → checklist 的需求闭环、pre-push hook 质量门禁。

### F.8 技术债管理（docs/refactor/ 10 轮）

项目经历了 **10 轮有记录的重构**，每轮都有详细文档：

| 轮次 | 主题 | 关键产出 |
|---|---|---|
| 01 | 安全加固 | JWT + RBAC + 限流 + CORS 白名单 |
| 02 | 路由与鉴权 | Vue Router meta 鉴权 + guards 重构 |
| 03 | 后端架构 | Controller → Service → Utils 三层分离 |
| 04 | 前端组件 | 组件分层 + 单职责拆分 |
| 05 | 前端架构 | View → Component → Composable → Adapter → Service 五层 |
| 06 | 工程配置 | ESLint + oxlint + Prettier + TypeScript 严格模式 |
| 07 | 数据管线 | Python 转换层 / 协调层 / 版本层 三层分离 |
| 08 | 前端 round2 | composables 细化 + adapter 增强 |
| 09 | 前端 round3 | useDataLoader Worker + LRU 缓存 + 初始化竞态修复 |
| 10 | Figma 资产 | pageRegistry 统一 + 插件闭环 |

**简历可写**：
> 驱动了 10 轮架构重构，从安全加固 → 后端三层 → 前端五层 → 数据管线三层 → Worker 缓存优化 → Figma 资产闭环，每轮重构都有详细设计文档和迁移计划，技术债持续偿还。

---

## 附录 G：简历量化指标填写说明

以下指标需要根据你项目的**实际生产数据**填写，不要直接复制占位符：

| 指标 | 填写建议 |
|---|---|
| GitHub Actions 平均 CI 耗时 | 从 Actions 历史页统计最近 10 次的平均值 |
| 后端 API P99 响应时间 | 从宝塔面板或 PM2 日志采样 |
| 前端首屏加载 | Chrome DevTools Performance 测 |
| 数据管线全流程耗时 | 本地运行 `python -m data_processor.main run` 计时 |
| 测试覆盖率 | Vitest / Jest / pytest 输出的 coverage 百分比 |
| 零生产事故天数 | 从上次部署成功到今天的天数 |

如需更多帮助，可以把生产数据发给我，我帮你量化。

---

*文档版本：2026-10-23 · 随仓库迭代同步更新*
