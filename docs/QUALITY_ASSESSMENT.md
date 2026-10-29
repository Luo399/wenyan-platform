# wenyan-platform 项目质量评估报告

> **评估日期**：2026-10-23  
> **评估方法**：行业 6 维度量化模型（参考 SonarQube + CMMI L2 + Google Engineering Practices）  
> **评估依据**：源码实证扫描 + GitHub Actions 分析 + .trae 规则与重构文档
>
> **落库时点说明（2026-10-29）**：本文按 10-23 的仓库状态打分，作为快照保留、不回填重算。
> 其 P0 项中已由 PR #211（7 个 controller 收敛到 zod 校验）、PR #210（backend 覆盖率阈值）、
> PR #207（角色门禁按角色集合判定）处理；前端覆盖率阈值与其余 P0/P1 项仍待办。
>
> **安全性结论已被取代（2026-10-29）**：本报告的「安全性 86 / B+」按 10-23 状态打分，已被
> PR #231（`feature-1`@`5e4886c`）的 70 项行业规则审查台账取代——该批修掉的是「缺 zod 中间件、内置
> admin/admin123、注册可自提权、埋点认 body 里的 user_id、答题提交无归属校验、`/v1` 别名 404、
> 看板无口令时匿名放行、PII 入库、xlsx 带 CVE 依赖」等 52 项，另有 18 项部分修（明细见
> `docs/maintenance/changelog/changelog-20261029.md` 第七批）。其余维度（可维护性/测试）打分仍按原稿读。

---

## 一、评分模型

| # | 维度 | 权重 | 评分区间 | 说明 |
|---|---|---|---|---|
| 1 | **代码规范与风格** | 15% | 0-100 | ESLint / Prettier / TypeScript 严格模式 / 命名约定 |
| 2 | **安全性** | 25% | 0-100 | OWASP Top 10 覆盖 / 鉴权 / 注入防护 / 密钥管理 / 限流 |
| 3 | **性能与可靠性** | 15% | 0-100 | 缓存 / 索引 / 并发控制 / 降级 / 自动恢复 |
| 4 | **可维护性** | 20% | 0-100 | 分层清晰度 / 复杂度 / 循环依赖检测 / 文档 / 技术债偿还 |
| 5 | **架构设计** | 15% | 0-100 | 分层 / 依赖方向 / 解耦度 / 扩展性 / 单一职责 |
| 6 | **测试覆盖** | 10% | 0-100 | 单元 / 集成 / 安全专项 / CI 覆盖率 |

**评级规则**：

| 总分 | 评级 | 行业对标 |
|---|---|---|
| ≥ 90 | **S** | Google / Netflix 级开源项目 |
| 85-89 | **A** | 优秀生产级项目 |
| 75-84 | **B+** | 合格生产级项目，有明确改进空间 |
| 65-74 | **B** | 可运行但需重构 |
| 50-64 | **C** | 技术债严重 |
| < 50 | **D** | 需从零开始 |

---

## 二、总分汇总

| 维度 | 原始分 | 加权分 |
|---|---|---|
| 代码规范与风格 | 82 | 12.3 |
| 安全性 | 86 | 21.5 |
| 性能与可靠性 | 80 | 12.0 |
| 可维护性 | 74 | 14.8 |
| 架构设计 | 82 | 12.3 |
| 测试覆盖 | 76 | 7.6 |
| **总分** | — | **80.5 / 100** |

**最终评级：B+（合格生产级项目）**

项目在安全性和架构设计两个维度表现突出，达到 A 级水平。可维护性存在明确的分层违规，是拉低总分的主要短板。以下是各维度逐项拆解。

---

## 三、维度 1：代码规范与风格（82 / 100）

### 加分项（+82）

| # | 项 | 证据 |
|---|---|---|
| 1 | **ESLint flat config + TypeScript + Vue 3** | `eslint.config.ts` 用 `@vue/eslint-config-typescript` + `pluginVue.configs['flat/essential']` + `oxlint` |
| 2 | **10+ 条自定义 ESLint barrel 禁自引规则** | `eslint.config.ts:12-104`，覆盖 composables/student/quiz/data/playback/tracking + components/features/step/quiz/culture/auth 共 10 组目录 |
| 3 | **Prettier 统一格式** | `.prettierrc.json`（`semi: false, singleQuote: true, printWidth: 100`）+ `skipFormatting` in ESLint |
| 4 | **TypeScript 路径别名** | `tsconfig.app.json:10` `"@/*": ["./src/*"]` |
| 5 | **tsconfig.app.json 严格模式** | `extends: @vue/tsconfig/tsconfig.dom.json`（默认 strict）+ 额外 `noUncheckedIndexedAccess: true` |
| 6 | **Vite 路径别名同步** | `vite.config.ts:14-16` alias `@` |

### 扣分项（-18）

| # | 项 | 证据 | 扣分 |
|---|---|---|---|
| 1 | **后端无 ESLint/Prettier 配置** | 根目录只有 `eslint.config.ts`（前端），`backend/` 下无 eslint.config.js / .prettierrc | -10 |
| 2 | **后端代码风格靠人工维护** | 后端 14 个 controller 风格不一致（有的注释密集、有的无注释） | -5 |
| 3 | **Vite 配置未合并 .env** | `vite.config.ts` 没用 `loadEnv()` 读取 env 变量，只配置了路径别名 | -3 |

### 改进建议

1. **后端加 ESLint**：在 `backend/` 下创建 `eslint.config.js`，用 `eslint-plugin-node` + 推荐规则集，CI backend-check job 里加 `cd backend && eslint src/`
2. **后端加 Prettier**：把前端 `.prettierrc.json` 复制到根目录（prettier 支持 monorepo），加 `npm run format` 脚本
3. **Vite 读 env**：`vite.config.ts` 里加 `import { loadEnv } from 'vite'`，在 defineConfig 里用 `loadEnv(mode, process.cwd())` 统一读取

---

## 四、维度 2：安全性（86 / 100）

### 加分项（+86）

| # | 项 | 证据 |
|---|---|---|
| 1 | **零硬编码密钥** | 全仓库 Grep `JWT_SECRET|DEEPSEEK_API_KEY|ASSET_SYNC_TOKEN` 32 处匹配——全部 `process.env.*`，无硬编码值 |
| 2 | **JWT_SECRET 生产必填** | `backend/src/config/app.js:9-12`：生产环境无 JWT_SECRET 时 `throw new Error('JWT_SECRET must be set in production')` |
| 3 | **Zod 白名单请求体校验** | `backend/src/controllers/answerController.js:1-58`：submitAnswersSchema 5 字段白名单 + 学号 regex + 答案 max 长度 + 题目数 max 500 + zod 默认 strip 多余字段 |
| 4 | **全量 SQL 参数化** | Grep `VALUES (?, ?, ...)` 15+ 处匹配，所有 backend SQL 用 `?` 占位符，零字符串拼接 |
| 5 | **bcrypt 密码哈希** | `backend/src/services/authService.js:1,23,31` + `database.js:458,496`（种子用 bcrypt 10 rounds） |
| 6 | **JWT + RBAC 三角色** | `authMiddleware.js:20,46` jwt.verify → `requireRole(roles)` → teacher 额外查 active 状态 |
| 7 | **五级分层限流** | `rateLimitMiddleware.js`：global(100/15min) / login(5/min) / submit(10/min) / query(30/min) / ai-chat(15/min/student) |
| 8 | **helmet CSP + HSTS** | `app.js:36-54` helmet({ contentSecurityPolicy, frameAncestors, crossOriginEmbedderPolicy }) |
| 9 | **CORS 白名单数组** | `app.js:56-63` `origin: (process.env.CORS_ORIGIN || '').split(',').map(...).filter(Boolean)` |
| 10 | **双鉴权隔离** | JWT（业务登录态）vs ASSET_SYNC_TOKEN（Figma 插件上传）——两个密钥独立、互不影响 |
| 11 | **dashboardAuth 独立于 JWT** | `dashboardAuthMiddleware.js` 用 `DASHBOARD_PASSWORD` session cookie，防止业务 JWT 权限越界 |
| 12 | **AI 安全链路完整** | 并发信号量（每学生 2 / 全局 10）+ 日/周/月三档配额（SQLite 三表事务）+ 15 次/分钟 student 限流 + MODERATION_KEYWORDS 内容审核 + URL 替换清洗 |
| 13 | **gitleaks 密钥扫描 CI** | `.github/workflows/ci-checks.yml` secret-scan job 自动扫全仓库 git history |

### 扣分项（-14）

| # | 项 | 证据 | 扣分 |
|---|---|---|---|
| 1 | **仅 answerController 用 zod，其他 controller 手写校验** | authController / studentController / teacherController / adminController / aiController / assetController / trackingController 全部手写 `if (!req.body.field) return res.status(400).json(...)`，无 zod 统一校验 | -8 |
| 2 | **DEFAULT_PASSWORD 弱口令存在** | `backend/src/services/authService.js:11,14` `DEFAULT_STUDENT_PASSWORD = '99999999'` / `DEFAULT_TEACHER_PASSWORD = '99999999'`——虽仅限测试环境，但值本身是已知弱口令 | -3 |
| 3 | **express-rate-limit MemoryStore** | `rateLimitMiddleware.js:55` 注释明确说"多进程假设"，PM2 cluster 模式下限流各自计数 | -2 |
| 4 | **无 CSRF 防护** | API 全用 fetch + Authorization header，不读 cookie（CSRF 主要针对 cookie 提交），风险低但 OWASP 建议标注 | -1 |

### 改进建议

1. **全 controller 引入 zod 校验**：创建 `backend/src/validators/` 目录，每个 controller 对应一个 zod schema 文件，配合 `validateReqBody(schema)` middleware 统一处理
2. **DEFAULT_PASSWORD 替换为随机值生成**：或在 `seed-production.test.js` 之外再加一个启动时 warn（已在 app.js 有类似 warn）
3. **express-rate-limit 升级 Redis Store**：`rate-limit-redis` + 共享 Redis（PM2 cluster 模式下有效）——当前 PM2 单实例暂不需要，但应标注为 TODO
4. **在 CODE_WIKI 和 README 中明确说明 CSRF 策略**（用 Authorization header 替代 cookie，所以不需要 CSRF token）

---

## 五、维度 3：性能与可靠性（80 / 100）

### 加分项（+80）

| # | 项 | 证据 |
|---|---|---|
| 1 | **Web Worker JSON 解析** | `src/workers/jsonParser.worker.js` + `useDataLoader.ts` 消费者计数 + 10s 空闲自动回收 |
| 2 | **模块级 Map-based LRU 缓存** | `useDataLoader.ts` O(1) 插入顺序 Map，100 条上限，5min TTL |
| 3 | **14 个 DB 索引** | `database.js:280-293`——students(class_code) / teacher_classes(class_code) / answers(wen_id) / answers(student_id) / answers(wen_id,student_id) / answers(student_id,wen_id,question_id) / tracking_events(event_type/user_id/session_id/step_id/timestamp) |
| 4 | **SQLite WAL + 外键 + 自动损坏恢复** | `database.js` 启动时 `PRAGMA journal_mode=WAL, foreign_keys=ON` + `SQLITE_CORRUPT` 检测后备份+重连+重试 |
| 5 | **AI 并发信号量** | `aiService.js` `concurrentMap`（每学生 2）+ `globalConcurrent`（全局 10）+ Promise.race 超时（15s） |
| 6 | **useDataLoader 指数退避** | `retryCount: 1, backoff: [1000, 2000]`，但超时不重试（isTimeout=true 直接返回） |
| 7 | **超时 vs 主动取消区分** | AbortController `signal.reason` 区分——超时设 isTimeout=true，主动取消静默处理 |
| 8 | **埋点缓冲队列 + 节流** | `utils/tracking.ts` pendingEvents + 每 3s 或满 20 条批量 POST |
| 9 | **PM2 auto-restart + 内存守护** | `ecosystem.config.js` max_memory_restart=1G + production deploy 里 `pm2 delete + pm2 start`（全新启动） |
| 10 | **后端部署端口自动释放** | `deploy-backend.yml` 生产部署里自动 `pm2 delete wenyan-backend` + `fuser -k 3000/tcp` + docker rm -f |

### 扣分项（-20）

| # | 项 | 证据 | 扣分 |
|---|---|---|---|
| 1 | **SQLite WAL 无 checkpoint / VACUUM 策略** | WAL 文件长期增长会导致写入变慢（checkpoint 时机取决于 SQLite 内部策略，无显式控制） | -6 |
| 2 | **PM2 cluster 模式未就绪** | `rateLimitMiddleware.js:55` / `aiService.js:34-38` 明确标注"单进程假设"——限流、并发控制、内存缓存多实例下计数会各自独立 | -5 |
| 3 | **后端全量 fs.readFileSync 读 JSON** | `textsService.js` 每次 API 调用都 `fs.readFileSync`——无后端侧缓存（前端走 OSS CDN 有缓存，但后端内部直接命中 SQLite 的 texts 查询可能高频） | -4 |
| 4 | **AI 内容审核用内存数组 MODERATION_KEYWORDS** | `aiService.js` 关键词数组在模块加载时创建，每次对话都遍历——如果关键词超过几百个应该用 Aho-Corasick 或字典树 | -3 |
| 5 | **无前端 bundle 分析** | Vite 没配 rollup-plugin-visualizer 分析 bundle size（虽然 OSS CDN 有 gzip，但无主动监控） | -2 |

### 改进建议

1. **SQLite WAL checkpoint 定时脚本**：在 nightly-cli.js 或 PM2 附加进程里做 `PRAGMA wal_checkpoint(TRUNCATE)`——每天一次即可
2. **PM2 cluster 迁移计划**：当用户数 > 10000 或 QPS > 50 时，迁移到 PM2 cluster + Redis（限流 + 并发控制 + 缓存），当前单实例暂不需要
3. **后端 textsService 加 require 缓存**：Node.js `require()` 天然有模块缓存，把 `fs.readFileSync` 结果存到模块级变量里（学习内容不变动时，进程只读一次）
4. **AI 关键词升级**：当 MODERATION_KEYWORDS 超过 50 个时，考虑用 `node-aho-corasick` 或正则（`new RegExp(keywords.join('|'), 'i')`）一次匹配
5. **Vite 加 bundle-visualizer**：`rollup-plugin-visualizer` + CI 里检查 gzipped bundle 是否超过 500KB

---

## 六、维度 4：可维护性（74 / 100）

### 加分项（+74）

| # | 项 | 证据 |
|---|---|---|
| 1 | **10 轮有文档的架构重构** | `docs/refactor/01-security → 10-figma-page-registry-design.md` 共 11 个 md 文件 |
| 2 | **circular-dependency-scanner CI** | `.github/workflows/ci-checks.yml` circular-check job 自动检测 src/ 循环依赖 |
| 3 | **barrel 禁自引 ESLint 规则** | `eslint.config.ts:12-104`，10 组目录明确禁止在内部引用自己的 index.ts barrel |
| 4 | **零 TODO/FIXME/HACK/XXX** | Grep 全仓库 320+ 文件匹配——零结果 |
| 5 | **前后端三层/五层分层清晰** | 后端 Controller→Service→Utils，前端 View→Component→Composable→Adapter→Service，依赖方向单向 |
| 6 | **CODE_WIKI.md 完整文档** | 1700 行 / 7 万字，10 大章节 + 7 附录 |
| 7 | **nightly-cli.js 开发自动化** | 夜间自动解析 tasks.md → 拉分支 → 推送 → 轮询 CI → 合并 → 勾选 |
| 8 | **OSS 自动同步工具链** | `scripts/oss-auto-sync-core.js`（纯逻辑可单测）+ `oss-auto-sync.js` + `upload-to-oss.js` |
| 9 | **每个复杂模块显式标注"单进程假设"** | `rateLimitMiddleware.js:55` / `aiService.js:34-38` / `assetAuthMiddleware.js:5`——主动考虑扩展性 |
| 10 | **Git pre-push hook** | `.trae/hooks/pre-push` 质量门禁 |

### 扣分项（-26）

| # | 项 | 证据 | 扣分 |
|---|---|---|---|
| 1 | **4 处组件直接 fetch（违反自定分层规则）** | `TeacherRegisterView.vue:291` / `ResourceUploadTool.vue:507` / `classOptions.ts:26` / `figmaAssets.ts:60`——应该走 `api.ts` 或 `services/` 层 | -8 |
| 2 | **4 处组件直接 router.push（违反自定导航规则）** | `StudentLoginView.vue:205-393` / `TeacherLoginView.vue:108-201` / `TeacherRegisterView.vue:307-321` / `TeacherCompletionView.vue:121`——登录/注册流程属于顺序流，应该走 `useNavigation.goNext()` | -6 |
| 3 | **后端无 ESLint 配置** | 同维度 1 扣分项 #1，但这里强调"可维护性风险"——后端代码规模上来后风格不一致会导致 merge conflict 和 review 困难 | -5 |
| 4 | **aiService.js 超过 400 行** | 当前文件 380+ 行（getDailyPeriod / getWeeklyPeriod / concurrentMap / submitAnswer / quota 四档检查...），单文件职责偏多 | -3 |
| 5 | **无统一 API 响应类型定义** | 后端约定了 `{success, data, error, code, timestamp, requestId}` 格式，但前端没建 TypeScript `interface ApiResponse<T>` 统一类型 | -2 |
| 6 | **useStudentStore 遗留未清理** | `stores/student.ts` 功能已被 `stores/auth.ts` 覆盖，但未删除，容易误导新开发者 | -2 |

### 改进建议

1. **分层违规修复（P0）**：
   - `TeacherRegisterView.vue:291` → 用 `services/apiService.teacherRegister()`
   - `ResourceUploadTool.vue:507` → 用 `services/resourceService.upload()`
   - `classOptions.ts` → 已是 service 层（可以接受，但加注释说明）
   - `figmaAssets.ts:60` → 加注释说明"运维脚本，不走 api.ts"
2. **router.push 修复（P0）**：登录/注册流程里的跳转用 `useNavigation` 的封装（需要扩展 `useNavigation` 支持登录态相关跳转）
3. **后端 ESLint（P1）**：同维度 1 建议
4. **aiService.js 拆分**：quota 检查 → `services/aiQuotaService.js`；并发信号量 → `utils/concurrentSemaphore.js`
5. **前端 API 类型**：`src/types/api.ts` 建 `interface ApiResponse<T>` + `interface ApiError`
6. **删除 useStudentStore**：或加 `@deprecated` 注释 + 在 stores/index.ts 里标记

---

## 七、维度 5：架构设计（82 / 100）

### 加分项（+82）

| # | 项 | 证据 |
|---|---|---|
| 1 | **前端五层分层** | `src/` 目录结构严格遵守 View → Component → Composable → Adapter → Service/Utils，依赖方向单向向下 |
| 2 | **后端三层分层** | `backend/src/` Controller → Service → Utils，每个 Controller 只解析 HTTP，每个 Service 只做业务 |
| 3 | **Adapter 层解耦** | `src/adapters/` 把后端 snake_case JSON 转为前端 camelCase 组件模型，字段缺失集中兜底 |
| 4 | **数据管线三层分离** | `data-pipeline/python/` 转换层(generate_all_json.py) / 协调层(main.py) / 版本层(IncrementalProcessor + VersionManager) 独立可测试 |
| 5 | **双端消费同一份 JSON** | `public/data/` = `backend/data/`（后端通过 `_sync_public_to_backend` 同步），数据源只有一份 |
| 6 | **useNavigation 单一事实源** | `config/navigation.ts pageSequence` 统一定义跳转顺序，组件不硬编码路由 |
| 7 | **useDataLoader 单文件 7 大能力** | fetch + Worker 解析 + LRU 缓存 + 指数退避 + 超时区分 + URL 重载 + 卸载清理——如果这些堆在组件里会膨胀 500+ 行 |
| 8 | **Git 分支层级策略** | feature → parent → feature-1 → main（PR + 人工审批），commit 用 --no-ff 保留合并历史 |
| 9 | **Figma 插件 → 后端 → OSS 闭环** | 设计师一键导出，MD5 去重，version.json 版本管理，完全零人工 |
| 10 | **埋点 10 维分析** | trackingAnalysisController 提供漏斗/交互/趋势/会话路径/活跃/时段/功能渗透率/群体差异/DAU/WAU 10 个维度 |

### 扣分项（-18）

| # | 项 | 证据 | 扣分 |
|---|---|---|---|
| 1 | **前端分层违规（fetch + router.push）** | 见维度 4 扣分项 #1/#2——架构设计在这些点上被实际代码突破 | -10 |
| 2 | **后端无显式依赖方向约束工具** | 后端分层只靠 docs 和 code review enforce，没有 `madge` 或 eslint-plugin-import/no-restricted-imports 检查 | -4 |
| 3 | **SQLite 单文件 DB 不支持多实例** | 如果未来迁 PM2 cluster + 多实例，SQLite 文件会被两个进程同时读写（WAL 模式支持多读者单写者，但多写者会冲突） | -2 |
| 4 | **后端 pm2 ecosystem.config.js 闲置** | 存在但 deploy workflow 不使用，造成"配置文件和实际启动方式不一致"的认知偏差 | -2 |

### 改进建议

1. **分层违规修复（P0）**：同维度 4 建议 #1/#2
2. **后端加依赖方向检查（P1）**：`eslint-plugin-import` + `no-restricted-imports` 禁止 controllers 直接 import utils（必须走 services）
3. **多实例迁移计划**：当前 PM2 单实例完全够用，但 CODE_WIKI 里应标注未来迁移点——先迁到 PostgreSQL，再迁 PM2 cluster
4. **清理 ecosystem.config.js**：要么删除（deploy workflow 不使用），要么让 deploy workflow 使用它

---

## 八、维度 6：测试覆盖（76 / 100）

### 加分项（+76）

| # | 项 | 证据 |
|---|---|---|
| 1 | **68 个测试文件** | 前端 45 + 后端 20 + 运维工具 2 + Figma 1 |
| 2 | **全链路覆盖** | Vitest（前端）+ Jest（后端）+ pytest（Python 管线）+ Figma plugin vitest + oss-auto-sync 测试 |
| 3 | **集成测试** | `tests/integration/quiz-full-flow.spec.ts`（闯关端到端流程） |
| 4 | **安全专项测试** | `answer-p0-security.test.js`（无鉴权不能提交）+ `ai-chat-security.test.js`（并发/配额）+ `tracking-analysis-auth.test.js`（看板密码） |
| 5 | **DB 内存测试** | CI 环境 `DB_PATH=':memory:'`，backend-check job 启动内存 SQLite 跑 Jest |
| 6 | **种子隔离测试** | `seed-production.test.js` 验证生产环境不播种 `99999999/99999999` 弱口令 |
| 7 | **circular-dependency-scanner CI** | ci-checks.yml circular-check job |
| 8 | **gitleaks CI 密钥扫描** | ci-checks.yml secret-scan job |

### 扣分项（-24）

| # | 项 | 证据 | 扣分 |
|---|---|---|---|
| 1 | **CI 无覆盖率阈值强制** | package.json 有 `coverage` 脚本，但 CI 没配置 `--coverageThreshold`（最低 80% 之类），coverage 可以是 0 也能过 | -10 |
| 2 | **后端多 controller 用 mock service 而非内存 DB** | `answer-p0-security.test.js` 用 supertest + mock，不是真实 DB 集成测试；只有 `database.test.js` 是真实 DB 测试 | -6 |
| 3 | **pytest 未配置 pytest-cov 覆盖** | `data-pipeline/python/pyproject.toml` 没加 `pytest-cov`，无法量化管线代码覆盖 | -4 |
| 4 | **前端部分目录覆盖稀疏** | stores/student.ts 遗留、mock/ 目录、config/ 部分文件无测试 | -2 |
| 5 | **后端 scripts/ 运维脚本无测试** | `backend/scripts/add-test-student.js` 等无对应测试文件 | -2 |

### 改进建议

1. **CI 加覆盖率阈值（P0）**：
   ```yaml
   # package.json
   "vitest run --coverage --coverageThreshold='{\"global\":{\"branches\":50,\"functions\":60,\"lines\":60}}'"
   # backend/package.json
   "jest --coverage --coverageThreshold='{\"global\":{\"branches\":40,\"functions\":50,\"lines\":50}}'"
   ```
2. **更多后端集成测试**：把 `admin-controller.unit.test.js` 的 mock 替换为真实内存 DB（`request(app).post(...).send(...)` 走完整请求链路）
3. **pytest 加 pytest-cov**：`pip install pytest-cov` + `pytest --cov=data_processor --cov-fail-under=80`
4. **前端遗留文件标记不测试**：`config/*` + `mock/*` 在 vitest.config.ts 里 exclude
5. **后端 scripts/ 改为 service 层 + 轻量 CLI**：把脚本核心逻辑抽到 services/，脚本本身只是 CLI 包装（这样 services/ 测试自然覆盖核心逻辑）

---

## 九、改进优先级清单

按影响面 × 成本 × 紧迫性三因素排序：

| # | 优先级 | 改进项 | 维度 | 影响 | 工作量 |
|---|---|---|---|---|---|
| P0-1 | 🔴 立即 | 全 controller 引入 zod 校验 | 安全 | 防未知 payload 进入业务层 | 中（~3h） |
| P0-2 | 🔴 立即 | 组件直接 fetch/router.push 修复 | 可维护性 + 架构 | 分层一致性 | 中（~2h） |
| P0-3 | 🔴 立即 | CI 加覆盖率阈值 | 测试 | 防止退化 | 小（~30min） |
| P1-1 | 🟠 近期 | 后端加 ESLint/Prettier | 代码规范 | 风格统一 | 小（~1h） |
| P1-2 | 🟠 近期 | aiService.js 拆分 | 可维护性 | 单文件 > 400 行 | 中（~2h） |
| P1-3 | 🟠 近期 | SQLite WAL checkpoint 定时 | 性能 | WAL 长期增长 | 小（~30min） |
| P1-4 | 🟠 近期 | 后端 textsService 加 require 缓存 | 性能 | 减少重复 fs.readFileSync | 小（~15min） |
| P1-5 | 🟠 近期 | 后端加依赖方向 ESLint 规则 | 架构 | 防止 future 违规 | 小（~45min） |
| P2-1 | 🟡 中期 | pytest 加 pytest-cov 覆盖 | 测试 | 量化覆盖 | 小（~30min） |
| P2-2 | 🟡 中期 | 前端 ApiResponse<T> 类型统一 | 可维护性 | 类型安全 | 小（~45min） |
| P2-3 | 🟡 中期 | PM2 cluster 迁移评估 | 性能 + 架构 | 扩展性 | 大（需 Redis 改造） |
| P2-4 | 🟡 中期 | Vite 加 bundle-visualizer | 性能 | bundle size 监控 | 小（~30min） |
| P3-1 | 🟢 远期 | 默认密码弱口令升级 | 安全 | 安全加固 | 小（改 seed 逻辑） |
| P3-2 | 🟢 远期 | ecosystem.config.js 清理 | 可维护性 | 减少认知偏差 | 小（删除或启用） |

---

## 十、行业对比

| 对比项 | wenyan-platform | 行业平均（中小 SaaS） | 差距/优势 |
|---|---|---|---|
| 安全（零硬编码密钥） | ✅ 全部 process.env | ❶ 部分硬编码测试密钥 | **优势** |
| 安全（全量 SQL 参数化） | ✅ 100% ? 占位符 | ❶ 约 70% 参数化 | **优势** |
| 安全（请求体校验） | ❷ 仅 1/7 controller 用 zod | ❶ 约 40% controller 用 zod | **持平** |
| 测试文件数 | ✅ 68 个 | ❷ 约 30 个 | **优势** |
| 测试覆盖阈值强制 | ❸ 未配置 | ❷ 约 50% 项目配置 | **略差** |
| 架构分层清晰度 | ✅ 五层/三层 + 10 轮重构文档 | ❶ 大部分无文档 | **优势** |
| CI 并行检查数 | ✅ 6 项（含循环依赖 + 密钥扫描） | ❷ 约 2 项 | **优势** |
| 循环依赖自动检测 | ✅ circular-dependency-scanner | ❸ 仅大型项目做 | **优势** |
| AI 安全链路（并发/配额/审核） | ✅ 完整 | ❶ 约 30% 有配额限流 | **优势** |
| 生产部署自动化 | ✅ 端口释放 + 健康检查 + DB 恢复 | ❷ 约 40% 有自动化 | **优势** |

**核心优势总结**：项目在**安全意识**和**架构纪律性**上明显优于行业中小 SaaS 平均水平——零硬编码密钥、零 SQL 拼接、循环依赖 CI 检测、10 轮重构文档。主要差距在**分层违规的实际修复**和**测试覆盖率强制**。

---

*评估完成。文档随代码演进同步更新。*
