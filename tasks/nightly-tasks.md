# 夜间任务清单

> **格式约定（夜间自动化脚本依赖，请勿改动结构）**
> - `##` = 父功能，`###` = 子功能；标题行尾的 `(slug)` 为分支名片段（全小写 + 连字符）。
> - `[ ]` = 未完成，`[x]` = 已完成。完成后在标题下方追加「分支 / commit / CI」记录行。
> - 分支规则：父功能从 `feature-1` 拉 `feature/<父slug>/main`；子功能从父分支拉 `feature/<父slug>/<子slug>`。
>   （父分支占一层叶子名 `main` 是 git 的硬性要求：ref 以文件存放，若存在 `refs/heads/feature/X` 就无法创建 `refs/heads/feature/X/Y`。
>   这与仓库既有先例 `data-pipeline/main` + 子分支一致。）
> - 开发完成后子分支 `--no-ff` 合并回父分支，父功能全部子功能完成后 `--no-ff` 合并回 `feature-1`。
> - 合并目标以 `.trae/rules/project-workflow.md` 为准（`feature-1`），**禁止把 `feature-1` 推或合并到 `main`**。
>
> **规则来源**：`.trae/rules/project-workflow.md`、`.trae/rules/security-and-environments.md`、
> `.trae/rules/windows-shell-pitfalls-and-sync.md`、`docs/refactor-branches.md`、`rules/maintenance_standards.md`。

---

## [x] 登录过期与会话中断修复 (auth-session-expiry)

- 目标：修复「登录已过期，请重新登录」相关的会话缺陷（详见 `docs/网页故障说明清单.md` F-001 ~ F-005）。
- 关联文件：`backend/src/config/app.js`、`backend/src/controllers/authController.js`、`backend/src/middleware/authMiddleware.js`、`src/utils/api.ts`、`src/stores/auth.ts`、`src/router/guards.ts`
- 红线：鉴权改动不得放宽后端校验；学生身份走 `useStudentStore` / `useAuthStore`；后端新增 controller 方法必须同步加入 `module.exports`。
- 分支 / commit / CI：父分支 `feature/auth-session-expiry/main`；并入 `feature-1` 的合并提交 `2516365`；**CI 未运行**（缺少推送凭证，已通过本地等价校验）。

### [x] 登录401语义分流与提示修正 (auth-error-mapping)

- 目标：修正 F-002 —— 前端把**所有** 401 一律当作「登录已过期」而丢弃后端真实消息；改为 `INVALID_CREDENTIALS` 原样透传，仅 `AUTH_REQUIRED` / `AUTH_FAILED` 判定为会话问题。
- 验收：输错密码提示「学号或密码错误」；令牌过期仍提示「登录已过期，请重新登录」；补 `tests/utils/api.spec.ts` 覆盖两类 401。
- 关联文件：`src/utils/api.ts`、`src/stores/auth.ts`
- 分支 / commit / CI：`feature/auth-session-expiry/auth-error-mapping` @ `bba94b6`；单测 `tests/unit/apiAuth401.spec.ts`（4 项）通过；CI 未运行（缺少推送凭证）。
- R02 注：验收里写的 `tests/utils/api.spec.ts` 在仓库中不存在，实际落在 `tests/unit/apiAuth401.spec.ts`；仓库既有的 `tests/unit/api.spec.ts` 用的是旧版 `ApiError(message, code)` 签名，属历史失败，未改动。

### [x] 令牌有效期与自动续期 (token-refresh-lifecycle)

- 目标：修复 F-001 / F-003 / F-004 —— 令牌有效期写死 3600s、`JWT_EXPIRES_IN=7d` 被 `toNumber()` 静默吞掉、`refreshToken()` 无调用方。
- 验收：支持秒数与单位写法（或在解析失败时启动即报错）；在 `src/router/guards.ts` 或请求层接入过期前自动续期；补单测覆盖续期与解析失败分支。
- 关联文件：`backend/src/config/app.js`、`src/stores/auth.ts`、`src/router/guards.ts`、`backend/.env.example`
- 分支 / commit / CI：`feature/auth-session-expiry/token-refresh-lifecycle` @ `3f1ef4e`；新增 `backend/src/utils/duration.js` 与 `/api/auth/refresh` 路由；单测 `backend/tests/duration.test.js`、`backend/tests/auth-refresh.test.js`、`tests/unit/authTokenRefresh.spec.ts` 通过；后端 130 项测试全绿；CI 未运行（缺少推送凭证）。

### [x] 初始化竞态鉴权头兜底 (auth-header-race)

- 目标：修复 F-005 —— `getAuthHeaders()` 在 Pinia 未就绪时静默返回空头，导致无令牌请求被判为「登录已过期」。
- 验收：区分「未登录」与「初始化竞态」，初始化完成前不发鉴权请求或对 `AUTH_REQUIRED` 重试而非直接登出；补单测。
- 关联文件：`src/utils/api.ts`、`src/main.ts`
- 分支 / commit / CI：`feature/auth-session-expiry/auth-header-race` @ `4a6f06f`；单测 `tests/unit/apiAuthHeader.spec.ts`（4 项）通过；CI 未运行（缺少推送凭证）。

---

## [ ] 继续按钮点击延迟优化 (continue-button-latency)

- 目标：统计不同浏览器环境下点击「继续」按钮的响应延迟，并把响应时间优化到 0.5 秒以内。
- 关联文件：`src/components/BackContinue.vue`、`src/composables/useNavigation.ts`、`tests/components/BackContinue.spec.ts`
- 红线：跳转必须走 `useNavigation`，组件内禁止直接 `router.push`；生产构建禁止 `console.log`。

### [ ] 各浏览器延迟数据统计埋点 (browser-latency-metrics)

- 目标：在点击「继续」到视图切换之间打点，按浏览器/UA 维度统计耗时，产出可查的延迟数据。
- 验收：新增埋点不引入 `console.log`；统计逻辑走 `utils/` 或 `composables/` 封装；补 `tests/` 单测。
- 关联文件：`src/utils/tracking.ts`、`src/composables/useTracking.ts`

### [ ] 点击响应逻辑优化至0.5秒内 (optimize-continue-response)

- 目标：定位并消除点击「继续」时的阻塞（同步重计算、重复请求、非必要重渲染），使响应 < 0.5s。
- 验收：`tests/components/BackContinue.spec.ts` 覆盖点击路径；不破坏 `useNavigation` 现有行为。
- 关联文件：`src/components/BackContinue.vue`、`src/composables/useDataLoader.ts`

---

## [ ] 学生登录失败排查修复 (student-login-failure)

- 目标：排查不同浏览器环境下测试账密 `99999999` 学生登录失败的原因并修复。
- 关联文件：`src/views/StudentLoginView.vue`、`src/components/StudentLogin.vue`、`src/components/LoginModal.vue`、`backend/src/controllers/authController.js`、`backend/src/services/authService.js`、`backend/src/middleware/authMiddleware.js`
- 红线：学生身份必须走 `useStudentStore` / `useAuthStore`，禁止组件内直接读 `localStorage`。

### [ ] 登录失败统计与复现 (login-failure-diagnostics)

- 目标：梳理各浏览器下失败分支（网络、401、账号不存在、大小写/空白、缓存），形成可复现路径与日志。
- 验收：补 `tests/` 单测覆盖失败分支；不新增 `console.log`。
- 关联文件：`src/stores/auth.ts`、`tests/stores/auth.spec.ts`

### [ ] 修复99999999登录失败 (fix-student-login-99999999)

- 目标：按上一子功能定位的根因修复，保证 `99999999` 在 Chrome / Edge / Firefox 均可登录。
- 验收：后端 `npm test` 通过；新增 controller 方法必须同步加入 `module.exports`（见 Windows 坑规则 B 节）。
- 关联文件：`backend/src/services/authService.js`、`backend/tests/auth-service.test.js`

---

## [ ] 管理员账密管理界面 (admin-credential-management)

- 目标：完成管理员界面的教师/学生账密增删查改功能开发。
- 关联文件：`src/views/AdminLoginView.vue`、`backend/src/controllers/adminController.js`、`studentController.js`、`teacherController.js`
- 红线：管理端接口必须登录态 + 角色校验（admin）；提交答案走 `utils/api.ts` 的 `submitAnswers`。

### [ ] 管理员界面框架与路由 (admin-shell-routing)

- 目标：管理员登录后的布局、导航与路由骨架，页面组件命名 ≥ 2 个单词 PascalCase。
- 验收：路由懒加载；跳转走 `useNavigation`。
- 关联文件：`src/router/index.ts`、`src/components/PageScaffold.vue`

### [ ] 学生账密增删查改 (admin-student-credential-crud)

- 目标：管理员对学生账密的新增、删除、查询、修改（含列表分页/搜索）。
- 验收：后端接口 + 前端页面 + `tests/` 单测；接口走 `utils/api.ts` 封装。
- 关联文件：`src/components/StudentTable.vue`、`src/components/StudentFormModal.vue`、`backend/src/services/studentService.js`

### [ ] 教师账密增删查改 (admin-teacher-credential-crud)

- 目标：管理员对教师账密的新增、删除、查询、修改。
- 验收：后端接口 + 前端页面 + `tests/` 单测；批量创建复用 `backend/scripts/batch_create_teachers.js` 的约定。
- 关联文件：`backend/src/controllers/teacherController.js`

---

## [ ] 教师班级学生账密管理 (teacher-student-credential)

- 目标：教师可对自己下属班级的学生账密进行增删查改。
- 关联文件：`src/views/TeacherLoginView.vue`、`backend/src/controllers/teacherController.js`、`src/components/StudentTable.vue`、`StudentFormModal.vue`
- 红线：必须做**班级范围鉴权**，教师不得跨班级操作学生（越权即安全缺陷）。

### [ ] 班级范围后端接口 (teacher-scope-api)

- 目标：按登录教师的班级归属过滤学生集合，所有写操作校验学生属于该教师班级。
- 验收：越权用例必须有单测覆盖（教师 A 操作班级 B 学生 → 403）。
- 关联文件：`backend/src/middleware/authMiddleware.js`、`backend/tests/`

### [ ] 教师端账密管理页面 (teacher-student-credential-ui)

- 目标：教师端班级选择 + 学生列表 + 增删改查表单。
- 验收：复用 `StudentTable.vue` / `StudentFormModal.vue`；补 `tests/` 单测。

---

## [ ] 学生完成情况查看 (student-progress-view)

- 目标：教师可查看学生完成情况。**本期只开发基本框架和前端页面，业务逻辑后续填入。**
- 关联文件：`src/views/AnswerQueryView.vue`、`src/components/AnswerTable.vue`、`backend/src/controllers/trackingController.js`
- 注意：本期**不实现真实统计逻辑**，用占位数据/适配层，接口签名先定好。

### [ ] 进度页面框架与路由 (progress-view-shell)

- 目标：进度查看页面的布局骨架（班级/学生筛选区 + 进度表格区 + 空态/加载态）。
- 验收：使用 `src/components/common/BaseLoader.vue`、`BaseEmpty.vue`、`BaseError.vue`；组件名 ≥ 2 个单词。

### [ ] 进度占位适配层 (progress-placeholder-adapter)

- 目标：定义进度数据结构与适配器签名，返回占位数据，后续替换为真实接口。
- 验收：数据访问走 `src/adapters/` + `src/utils/` 封装，**组件内禁止直接 `fetch('/data/...')`**；补 `tests/adapters/` 单测。