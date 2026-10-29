# 夜间任务清单

> **格式约定（夜间自动化脚本依赖，请勿改动结构）**
>
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

## [x] 文化卡片多类型媒体 (culture-card-media)

- 目标：文化卡片支持视频/图片/文字多种媒体；视频带全屏键且默认仅在固定尺寸内播放；卡片尺寸按 Figma 数据配置。
- 关联文件：`src/components/CultureCards.vue`、`src/config/cultureCards.ts`、`src/components/VideoPlayer.vue`
- 红线：只做逻辑嵌入，不做页面视觉；尺寸由 Figma 方裁定，统一在 `src/config/cultureCards.ts` 接入；组件名 ≥ 2 个单词；生产构建禁止 `console.log`。
- 分支 / commit / CI：父分支 `feature/culture-card-media/main`（子分支合并 `947c40a`）；并入 `feature-1` 的合并提交 `2539278`。

### [x] 卡内视频播放与Figma尺寸配置 (video-inline-player)

- 目标：视频从「新窗口打开」改为卡内固定尺寸播放（复用 `VideoPlayer`，自带全屏键）；卡片/视频区尺寸按 `cultureCardSize` 配置生效（Figma 数值待填，`null` 回退自适应）。
- 验收：`npm run type-check` 通过；eslint 对改动文件无报错；封面/播放器按 `playingCards` 状态切换。
- 关联文件：`src/components/CultureCards.vue`、`src/config/cultureCards.ts`
- 分支 / commit / CI：`feature/culture-card-media/video-inline-player` @ `de43f00`；type-check + eslint 通过；CI 见 feature-1 推送后的 `CI Checks`。

---

## [ ] 发布新鲜度：浏览器不再跑旧构建 (release-freshness)

- 目标：让「同一份修复在不同浏览器上新旧不一」这件事可辨识、可自愈、可验证。事实基线与方案见 `docs/maintenance/release-freshness-plan.md`。
- 关联文件：`vite.config.ts`、`env.d.ts`、`src/utils/buildStamp.ts`、`src/utils/chunkRecovery.ts`、`src/utils/buildVersion.ts`、`src/components/common/BuildStamp.vue`、`src/components/common/UpdatePrompt.vue`、`.github/workflows/deploy-frontend.yml`、`.github/workflows/deploy-frontend-test.yml`
- 红线：发现新版本**只提示、不自动刷新**（学生答题中途不能被刷掉）；chunk 失败自愈必须带单次限制防死循环；不引入 Service Worker；`deploy-*.yml` 是 CI 盲区，改动的第一次执行就是真跑。
- 分支 / commit / CI：父分支 `feature/release-freshness/main`（阶段 2 `7599a12` → 阶段 3 `490c06e` → 阶段 1 `7013e55` + 修红 `d452d16` → 阶段 4 `a4f0330` + 修红 `2b2edf0`，集成分支 `ca8c6c96`）；阶段 1–3 经 PR #192 并入 `feature-1`（`3c0a786`），阶段 4 随 PR #199 并入。`CI Checks` 只剩继承的 `ClassPicker.test.ts` 9 条红，本方案新增的 65 条用例（21 + 8 + 3 + 23 + 10）全绿；`Deploy Frontend to Test OSS` 用新缓存契约首跑成功，自检第 1 轮命中本次构建入口，`index.html` 里已带 `<meta name="build-id" content="4b44b2f">`。继承的 `ClassPicker.test.ts` 9 条红已由 PR #200 清掉（见下一父功能），`quality-check` 从此恢复「绿 = 真的没问题」。
- 上线：PR #193 由人工于 2026-10-28 13:23 合入 `main`（`f4c2d18e`，取自 `feature-1` 的 `f34eeb76`），`Deploy Frontend to Aliyun OSS` 成功。生产 `https://www.classicalab.cn/` 的 `index.html` 带 `<meta name="build-id" content="f4c2d18">`、入口 `/assets/index-C3VehIAz.js`；`Cache-Control` 入口 `max-age=0`、hash 产物 `max-age=31536000`；入口 chunk 内含 `wenyan:new-version`、`wenyan:chunk-reload-failed`、`发现新版本`，`assets/ClassPicker-DXgI1AbN.js` 里过滤年级的逻辑已是独立函数 —— 阶段 2 的生产侧复验与阶段 3/4 的产物核对都通过。方案第 7 节遗留的「生产侧未验证」一项可以划掉。

### [x] 构建号注入与页脚可见 (build-id-visibility)

- 目标：任何人 5 秒内能说出用户跑的是哪次构建（方案 G1）。
- 验收：页脚显示构建号且与提交短 sha 一致；`index.html` 里有 `<meta name="build-id">` 供 curl / CI 比对；不掺构建时间戳以保住产物字节稳定。
- 关联文件：`vite.config.ts`、`env.d.ts`、`src/utils/buildStamp.ts`、`src/components/common/BuildStamp.vue`、`src/App.vue`
- 分支 / commit / CI：`feature/release-freshness/build-id-visibility` @ `7013e55` + `d452d16`；PR #194 / #195；`src/utils/__tests__/buildStamp.test.ts`（8）+ `src/components/__tests__/BuildStamp.test.ts`（3）通过。坑记在方案第 8 节：模板里的根级注释会让组件变成 fragment，测试拿到的 `wrapper.element` 是挂载容器。

### [x] 部署缓存契约与CDN刷新校验 (deploy-cache-contract)

- 目标：长缓存只给 hash 产物，`index.html` 每次回源；CDN 刷新失败必须让 job 变红；部署后自检线上入口是否等于本次构建（方案 G2）。
- 验收：`deploy-frontend.yml` 与 `deploy-frontend-test.yml` 分段上传；测试与生产各自有一条比对入口 hash 的自检步骤。
- 关联文件：`.github/workflows/deploy-frontend.yml`、`.github/workflows/deploy-frontend-test.yml`
- 分支 / commit / CI：`feature/release-freshness/deploy-cache-contract` @ `7599a12`；PR #188；`Deploy Frontend to Test OSS`（run 40614107402）成功，测试入口 `/assets/index-DiJuirkI.js` 与本次构建一致。生产侧待 `feature-1 → main` 的 PR 合并后由 `Deploy Frontend to Aliyun OSS` 复验。

### [x] 懒加载chunk失败整页重载一次 (chunk-reload-recovery)

- 目标：旧会话点到已下线的 chunk 时自动恢复，不停留在半死页面（方案 G3）。
- 验收：重载目标是本次导航要去的路由地址；同一地址只自动重载一次；业务接口失败绝不触发刷新；离线 / sessionStorage 不可用时只提示。
- 关联文件：`src/utils/chunkRecovery.ts`、`src/main.ts`
- 分支 / commit / CI：`feature/release-freshness/chunk-reload-recovery` @ `490c06e`；PR #191；`src/utils/__tests__/chunkRecovery.test.ts` 21 项通过（含与真实 vue-router 的接线用例）。

### [x] 新版本探测与更新提示 (version-prompt)

- 目标：页面可见时 + 定时以 `cache: no-store` 拉 `index.html` 比对版本指纹，发现新版本**只提示**，用户自己点刷新。
- 验收：不自动刷新；复用 `chunkRecovery` 已派发的 `wenyan:chunk-reload-failed` 事件与 `wenyan:chunk-reload-hint` 记录；探测逻辑在 `src/utils/` 层，组件不直接 fetch。
- 关联文件：`src/utils/buildVersion.ts`、`src/components/common/UpdatePrompt.vue`、`src/App.vue`、`src/main.ts`
- 分支 / commit / CI：`feature/release-freshness/version-prompt` @ `a4f0330` + 修红 `2b2edf0`；PR #197 / #198；`src/utils/__tests__/buildVersion.test.ts`（23）+ `src/components/__tests__/UpdatePrompt.test.ts`（10）全绿，`CI Checks` 只剩继承的 `ClassPicker.test.ts` 9 条。修的那条：`onMounted` 里回读 hint 触发的是异步重渲染，挂载那一帧还是隐藏 —— 回读挪进 setup。

---

## [x] CI 质量基线转绿 (ci-quality-baseline)

- 目标：让 `quality-check` 的绿 / 红重新有意义。它此前常红（继承的 `ClassPicker.test.ts` 9 条，`main` 上也红），每次都要翻日志判断「这条红是不是我这次改坏的」，等于没有基线。
- 红线：组件的 `data-testid` 不许为了迁就测试而改名（页面与将来 E2E 都靠它）；`addManual()` 的 `trim()` 是产品行为不是漏洞，用例要跟着实现走，不是反过来；本机没有 node，vitest 只能由 CI 跑，所以改测试必须逐条推演而不是试探。
- 关联文件：`src/components/ClassPicker.vue`、`src/components/__tests__/ClassPicker.test.ts`

### [x] 修 ClassPicker 全年级权限与年级联动 (classpicker-fullaccess-grade-prune)

- 目标：清掉那 9 条红，并且把它背后藏着的两条真实缺陷改掉，而不是把断言改成迎合坏实现。
- 验收：勾「全年级权限」必须收起具体班级选择区；勾年级 chip 后班级行必须出现；`quality-check` 全绿；组件 `data-testid` 未改名。
- 关联文件：同上两个文件（+141 / -38，用例 22 → 27）
- 分支 / commit / CI：`feature/classpicker-fix` @ `0433156`；PR #200 → `feature-1`（`f34eeb76`）→ 随 PR #193 上 `main`（`f4c2d18e`，已部署）。两处缺陷的根因记在 `docs/maintenance/changelog/changelog-20261028.md` CR-07：① Vue 把缺省的 Boolean prop 转成 `false` 而不是 `undefined`，`props.fullAccess ?? innerFullAccess` 恒为 `false`，两个调用点都只监听 `@update:full-access` 不绑 prop，所以「全年级权限」在线上从不收起选择区；② `emitChange()` 末尾用「已选班级」反推保留年级，勾年级时班级还是空的，刚勾上的年级立刻被抹掉，班级行永远出不来。教训：`data-testid` 用前缀匹配时容器自身会被数进去（`selected-` / `class-` 都撞了），以及 `maxlength` 让「程序化赋超长值」的断言在不同环境不稳。

---

## [x] Step One 生字注释悬浮层 (step1-word-tooltip)

- 目标：`https://www.classicalab.cn/stepone/{id}` 正文里的 `.annotated-word` 必须悬浮就出注释、长注释不冲出视口，并且这套行为要有拦得住回退的测试。
- 方案与根因全在 `figma-plugin/docs/step1-word-tooltip-plan.md`（现已到 v5）。
- 红线：监听器不许写回 `onMounted`——正文容器在 `v-if / v-else-if / v-else` 分支里，组件挂载时那份 JSON 还在加载、节点还不存在；节流只能吃纯数据快照，不能吃 `MouseEvent`（派发结束后 `e.target` 按规范变 `null`）。

### [x] 监听绑定时序 + 节流失效事件修复与测试回退网 (word-tooltip-binding-fix)

- 分支 / commit / CI：`feature/step1/word-tooltip` @ `adc0108`（修复）+ `03df798`（单测 18 → 78 例）；`--no-ff` 并入 `feature-1`（`cced00c`）；同步 `main` 进 `feature-1`（`19492d6`，为满足分支保护的 strict 状态检查）后开 PR #204 → `main`（`850d97b`），6 项检查全绿，`Deploy Frontend to Aliyun OSS` 成功，线上 `meta[name=build-id]` 与页脚都是 `850d97b`。
- 验收（2026-10-29 线上实测）：4 篇课文共 190 个 `.annotated-word`，逐个派发 `mousemove` 后 **190/190 出浮层、文本与 `data-def` 逐字一致**，光标移到非词节点即收起（每 20–30 个抽查一次）。
- 本机校验（推翻「本机没有 node 只能靠 CI」这条老前提）：便携 Node 20.18.0 + 仓库现有 `node_modules`，全量 `vitest run` 194/194、`vue-tsc --build` 0 错、`eslint`（只跑改动文件、不带 `--fix`）0 错、`prettier --check` 通过。

### [x] 词条匹配三级兜底：注音与标点不再漏标 (word-list-match-fallback)

- 目标：浮层本身 100% 命中之后，剩下的洞在生成侧——9 条词条压根没变成 span，鼠标再准也命中不了。
- 分支 / commit：`feature/step1/annotation-matching` @ `5aad28b`（`src/utils/adapterUtils.ts` 三级匹配 + 63 例测试）、本文档所在提交（台账 / 变更记录 / 方案 v5 / 素材清单）。
- 验收：三级策略（词条原文整串 → 剥括号注音 → ≥4 汉字允许夹标点的长短语）使 鲦鱼 / 槽枥 / 外见 / `乃丹书帛曰"陈胜王"` / `其必曰："…"乎` 共 5 条开始成 span；「食(sì)」与篇名出处（马说 / 岳阳楼记 / 史记）按决策**不标**，登记在 `docs/素材缺失清单.md` 第十一节。span 总数 190 → 194。
- 事实修正：WEN_01 的「陈」span 18 → 17，少的那个在「陈胜王」内部，原先挂「古地名，今河南淮阳」是错标，现归长短语。
- 拦回退的方式：`wordListAdapter.test.ts` 里「每条词条要么已成 span，要么在已登记的『标不了』清单里」双向断言——新素材再冒出清单外的漏标就红，清单里的条目一旦被误标（例如放开单字音注）也红。

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


---

## [x] 共享工作区积压改动按修复内容拆分入库 (shared-worktree-pr-split)

- 目标：`feature/continue-nav-stuck` 工作区攒了 103 条未提交改动（另一条会话同时在用这个工作区），
  按「一个修复一个分支一个 PR」拆开依次并入 `feature-1`，不 `checkout` / 不 `stash` / 不动工作区与 HEAD。
- 关联文件：见各子功能；细节与遗留记在 `docs/maintenance/changelog/changelog-20261029.md` 第二批。
- 红线：全程 git plumbing 落提交（`read-tree` → `update-index --cacheinfo` LF blob → `write-tree` → `commit-tree` → `update-ref`）；
  每个 PR 轮询到 6 项检查全绿才 `--merge`；不碰 `main`（`feature-1` → `main` 只走人工审批的 PR #209）。
- 分支 / commit / CI：见下 9 个子功能；`feature-1` 从 `117e287` 推到 `580e4c8`。
- 上线：PR #209（`feature-1`@`580e4c8` → `main`@`78a6c29`，2026-10-29 11:19 人工合并）已把本批全部带上线，
  前端 `Deploy Frontend to Aliyun OSS` / 后端 `Deploy Backend to Aliyun Server` / 插件镜像同步三条 run 全绿；
  线上 `index.html` 的 `build-id` 为 `78a6c29`，看板 chunk 与生产注册接口的 `VALIDATION_ERROR` 均已实测到。

### [x] 角色门禁支持多角色与 super_admin (auth-role-gate)

- 分支 / commit / CI：`feature/auth-session/super-admin-role` @ `34c4caa` → PR #207 → 合并提交 `e5aa54b`；CI 6 项全绿。
- 落点：`Role` 加 `super_admin`、`normalizeRequiredRoles` / `isRoleAllowed` 两个纯函数、4 个路由的 `meta.role` 改成集合。

### [x] 教师注册改走 apiService (teacher-register-api)

- 分支 / commit / CI：`feature/auth-session/teacher-register-api` @ `8478a4b` → PR #208 → `d8220fa`；
  首推 CI 报 `TS2322` + `TS1005`，修返回类型与闭合尖括号后转绿。

### [x] 后端覆盖率范围与阈值 (backend-coverage-thresholds)

- 分支 / commit / CI：`feature/quality-gate/backend-coverage-thresholds` @ `bcf23d9` → PR #210 → `b2a71ff`；CI 6 项全绿。
- 未做：前端 `test:coverage` 需要 `@vitest/coverage-v8`（vitest 4 已删 `c8`），要改 lockfile，留待决定。

### [x] zod 校验收敛到 middleware/validate (zod-validation-middleware)

- 分支 / commit / CI：`feature/backend-api/zod-validation` @ `62f67ca` → PR #211 → `00c06cd`；CI 6 项全绿。
- 找回：`backend/src/middleware/validate.js` 被 7 个 controller `require` 但仓库里从来没有，从 `feature/data-dashboard/backend-api` 取回。

### [x] 看板聚合接口移植 (dashboard-api)

- 分支 / commit / CI：`feature/data-dashboard/api` @ `dcdd46c` → PR #212 → `c7911a3`；CI 6 项全绿。
- 来源：10-23 那条未合并的本地分支；`routes/index.js` 三方合并，未拖入 10-23 的 ClassPicker 改动（已由 PR #200 以另一套实现落库）。

### [x] 看板前端页面与入口 (dashboard-pages)

- 分支 / commit / CI：`feature/data-dashboard/pages` @ `c3d2080` → PR #213 → `4a3e9b4`；CI 6 项全绿。
- 本机校验：便携 Node + `git archive` 出分支树 + junction 指回 `node_modules`，`vue-tsc --build` 0 错误后才推（首推 8 处 `noUncheckedIndexedAccess` 报错）。

### [x] 编号↔篇目确认表同步后端与插件脚本 (asset-numbering-confirmed)

- 分支 / commit / CI：`feature/asset-inventory/confirmed-numbering` @ `c41ad52` → PR #214 → `d08fca9`；CI 6 项全绿。
- 未做：`figma-plugin/resource-inventory.json` 仍是旧推测标题的离线快照，本机无 python 重跑不了 `generate-inventory.py`。

### [x] 三份技术文档落库 (tech-docs)

- 分支 / commit / CI：`feature/docs/tech-docs` @ `6635547` → PR #215 → `2299edf`；CI 6 项全绿（含 secret-scan）。
- 未做：`docs/document_index.csv` 未登记，该表要「创建日期」而这三份没有可靠原始日期。

### [x] 发布事实与上线状态回填 (release-facts-20261029)

- 分支 / commit / CI：`feature/maintenance/release-facts-20261029`；docs-only 改动，不在 deploy `paths` 白名单，合进 `main` 不触发发布。
- 内容：changelog 两张表的「上线状态」由「未上线（等下一次 `main` 窗口）」改成「已上线（`78a6c29`）」共 12 行，
  并补一节「发布事实（2026-10-29 中午复核）」记 workflow run、`build-id`、看板 chunk、生产 `VALIDATION_ERROR` 四项实测。

### 与既有小节的关系（本轮没改动它们的勾选状态）

`admin-credential-management`、`teacher-student-credential`、`student-progress-view` 三节仍是 `[ ]`：
本轮落的 #212 / #213 是**看板**（聚合指标 + 明细表 + 薄弱题），与这三节的验收口径（账密增删查改、
越权单测、占位适配层）不是同一件事，不能拿来勾掉。`ci-quality-baseline` 那节记的是转绿工作，
覆盖率阈值与 zod 收敛属其「改进建议」，同样不回填勾选。

### 故意没提交（工作区里留着）

`NUL`（Windows 重定向垃圾文件）、`tmp-vitest.mjs` / `tmp-vitest-report.json`（临时跑测产物）、
`.vscode/extensions.json` 的删除（工作区删了推荐扩展，不是仓库决策）、
`docs/maintenance/release-freshness-plan.md`（`feature-1` 上版本更新，覆盖会回退）。

---

## [x] Step 三关答题闭环与 Figma 资产审计 (step3-quiz-closure-asset-audit)

- 目标：回应甲方三条反馈——第一关补选择题、第二关第二题答完后解析 dialogue 要显示、Figma 扫描上传的产物是否全部用上。
- 红线：不改内容 JSON 的答案字段；组件提交仍走 `useQuizSubmitter`；05 起没有 `level1_quiz` 数据时不能把第一关卡死。
- 分支 / commit / CI：`feature/step12-quiz-fixes` @ `2bfa324`（本地 `5750dd8`，树同为 `4ac8243`）→ `--no-ff` 语义并入
  `feature-1`@`2a46603`；子分支 `CI Checks` run `40816371706` 6 项全绿，合并后 run `40816528148` 6 项全绿，
  `Deploy Frontend to Test OSS` run `40816528133` 成功。分支名不删。
- 落提交方式：`github.com:443` 不通，走 Git Data API 建 blob/tree/commit/ref；服务端 tree sha 与本地一致（`4ac8243`），
  blob sha 逐个与 `git rev-parse HEAD:path` 对上。合并前父分支被 PR #221 推到 `5dfe95c`，先 compare 确认其 7 个文件与本次三个文件零重叠，
  再以新头为基线重建合并树，父提交 `[5dfe95c, 2bfa324]`。
- 本机校验：便携 Node 20.18.0，全量 `vitest run` 252/252（15 个文件）、`vue-tsc --build` 0 错误、改动文件 `eslint` 0 错误、
  `oxlint` 0 warning、`prettier --check` 通过。
- 明确没做：WEN_04 的 B2 答案与解析矛盾、B1 缺 `correct_answer` 只登记不擅改；WEN_05 起的第一关数据由内容侧补；
  Figma 6,049 张切片不删不迁移；不碰 `main`（`feature-1` → `main` 仍走人工审批 PR）。

### [x] 第二关末题解析对话恢复显示 (step2-trailing-explanation)

- 根因：`useQuizFlow.submit()` 在最后一题不推进 `currentIndex`（日志 `prevIndex 0 → newIndex 0, isCompleted true`），
  `isQuizBlockVisible()` 以 `quizBlockIndices[currentIndex]` 为上界，题目之后的 dialogue 永远 `show=false`。
- 修复：`step2Flow.isCompleted` 为真时全部解锁；解析对话本就属于「答完才该看」的内容。

### [x] 第一关接入 A 关选择题 (step1-quiz)

- 数据：`level1_quiz/{WEN}.json`（当前 01–04 各 1 题）→ `adaptLevel1Quiz()` 生成 `WEN_nn_A{n}` / `module A`；
  `normalizeCorrectIndex()` 兼容字母、数字与 0 基索引。
- 交互：`QuizCard` 逐题渲染 + `useQuizFlow.submit()` 单题提交；`completionKey` 三关分离（`stepone:` 等），
  新增 `wenId` 参数保证后端仍收到纯 `WEN_xx`；A 关 JSON 无 `question_id`，提交必须带 `correctAnswer`。
- 降级：无数据时整段隐藏，不影响字词/朗读与「继续」。
- 测试：`src/views/__tests__/StepView.test.ts` 两个回归用例（末题后 dialogue 可见；stepone 渲染/提交 payload 正确且无 `stepone:` 前缀）。

### [x] Figma 扫描资产使用审计 (figma-asset-usage-audit)

- 产物：`docs/素材使用审计-20261029.md`。结论：6,075 项插件产物（screens 6,049 + texts 26，styles 0）运行时引用为 0；
  真正在用的通用图只有 `login_bg.png`、`article_list_bg.png`、`article_list_title.png` 3 张。
- 证据：`icon_dialog` 25 个字段全空；`illustration` 8 个全空；`image_file` 35 个中 24 个 mp4 走 `/video/`、11 个是「文字」占位；
  quiz / explanation / summary / cultural_card / video 五类切片无任何组件消费。
- 建议：先标注不急着删；挂头像先填 `icon_dialog`；题目/解析插图先定 schema；`data/texts` 归为内容底稿；
  增加发布前资产引用审计（数据字段 → URL → HEAD 200）。

### [x] Figma 扫描资产接入前端 (figma-screen-integration)

- 新增 `src/config/figmaScreenCatalog.ts`（6,049 个扫描文件 → 37 篇 / 775 条角色记录）与
  `scripts/gen-figma-screen-catalog.mjs`；`figmaAssets.ts` 增加标题/角色/选项/文本框/头像/名牌 URL 读取，
  统一走 OSS `images/screens`。
- `DetailView` 标题、`AdaptQuiz` 选项底图已直接读取扫描图，加载失败回退文字/CSS。
- 背景与立绘（2.8–18MB）暂不直接渲染，需先做衍生图；说明见 `docs/figma-scan-integration.md`。

### [x] Figma 资产接入补测试 (figma-screen-test-coverage)

- 单元 9 例：OSS 地址拼接/编码、HEAD 缓存与并发去重、200/404、目录读取与 null 兜底。
- 集成 6 例：DetailView 标题图渲染/失败回退/无图回退；AdaptQuiz 四选项底图/无素材回退/答题状态。
- 全量 19 个文件 274 个用例通过；`vue-tsc` 0 错误；新文件 lint / prettier 通过。

---

## [x] 前端覆盖率环境 + 本机工具链 + 23 号位确认 (coverage-python-slot23)

- 目标：把上一批留下的三个「跑不了 / 没确认」口子关掉——前端覆盖率缺 provider、`generate-inventory.py` 没有 python、
  23 号位归属未确认；另外清掉 `origin` URL 里的明文凭据。
- 关联文件：见各子功能；细节记在 `docs/maintenance/changelog/changelog-20261029.md` 第四批（CR-20261029-19 ~ 22）。
  号段从 19 起是因为第三批已占用 16 / 17 / 18，本批与它并行、编号跟着当前 `feature-1` 头顺延。
- 红线：全程不 `checkout` / 不 `stash` / 不动共享工作区与 HEAD（git plumbing 落提交）；
  校验在 `git archive` 出的干净树里跑（`mklink /J` 把 `node_modules` 指回仓库）；不碰 `main`。
- 分支 / commit / PR：`feature-1` 从 `eca26c4` 推到 `3c19c03`（三个 PR 各 6 项检查全绿才合）；
  本节的文档改动在 PR #223，因与第三批 / #224 追加位置相同冲突两轮，用「把 `feature-1` 头合进本分支 + 人工重排」解决，
  没有 force-push。

### [x] 前端覆盖率 provider 与阈值 (frontend-coverage-v8)

- 分支 / commit / CI：`feature/quality-gate/frontend-coverage-v8` @ `28cbdd6` → PR #220 → 合并提交 `387b9b3`；CI 6 项全绿。
- 落点：`@vitest/coverage-v8@4.1.10`（vitest 4 已删 `c8`）+ `vitest.config.ts` 的 `coverage` 段，
  阈值 statements 14 / functions 16 / branches 11 / lines 14（当时实测 14.93 / 16.76 / 11.49 / 14.09 往下取整）。
- 未做：~~CI 的 `quality-check` 仍跑 `npm run test`、**不带 `--coverage`**，阈值只在本地生效；要不要钉进 CI 等你定~~
  → 第六批已钉进 CI（PR #228）；另纠正一处：当时仓库里**没有 `test:coverage` 脚本**，「只在本地生效」那句并不成立。

### [x] 23 号位确认为《活板》(slot-23-huoban)

- 分支 / commit / CI：`feature/asset-numbering/slot-23-huoban` @ `845b33b` → PR #221 → `5dfe95c`；CI 6 项全绿。
- 落点：`NUMBERING_CONFIRMED_POEM_IDS` 与 `poemMap` 加 23，backend / figma-plugin 两份标题表同步，
  两份素材文档计数跟着改（已确认 24 → 25、待确认 13 → 12、学生可进入 21 → 22）。
- 校验：本机 `vitest run --coverage` 14 文件 251 例全过、`vue-tsc --build` 0 错误。

### [x] 本机 Python 与资源清单重跑 (python-and-inventory)

- 分支 / commit / CI：`feature/asset-inventory/regenerate-snapshot` @ `02f1b3f` → PR #222 → `3c19c03`；CI 6 项全绿。
- 本机装 Python 3.12.10（`python -X utf8` 跑，否则中文输出乱码）；输入取自线上 `GET /api/assets/version`
  （`production_version.json` 未被 git 跟踪，测试环境的 `test_version.json` 因 502 没拿到）。
- 清单从 2026-08-21 的 1947 资源刷到 6077，标题表由「37 条推测」换成「25 条确认 + 12 条占位」。

### [x] origin remote URL 去掉明文令牌 (remote-url-credential)

- 机器侧改动（`.git/config` + 全局凭据助手），不进仓库：URL 里嵌的就是 `gh` 当前在用的那枚 `gho_` 令牌（sha256 比对确认）。
- 改法：`gh auth setup-git` 把 `credential.https://github.com.helper` 指向 `gh.exe auth git-credential`，
  URL 清成 `https://github.com/Luo399/wenyan-platform.git`；`.git/` 全树已扫不到该令牌字节，fetch / push 均正常。
- **待你本人做**：轮换那枚令牌（`gh auth refresh-token`，或在 GitHub 设置里撤销后 `gh auth login`）。

---

## [x] 覆盖率门禁进 CI + 23 号位卡片挂载 (ci-coverage-gate-slot23-mount)

- 目标：执行用户两条口径——**「CI 的进 workflow」**把 CR-19 的覆盖率阈值真正接到 CI（此前 CI 跑 `npm run test`，阈值没人执行）；
  **「23 号的问题，其他怎么解决的它就怎么解决」**按 2026-10-28 那批挂载提交 `8c51427` 的既有约定补挂 23 号位《活板》的文化卡片，
  不发明新做法。
- 关联文件：见各子功能；细节记在 `docs/maintenance/changelog/changelog-20261029.md` 第六批（CR-20261029-24 / 25）。
  号段从 24 起是因为第五批（另一条会话的 Figma 测试补齐）已占用 CR-20261029-23。
- 红线：全程不 `checkout` / 不 `stash` / 不动共享工作区与 HEAD（git plumbing 落提交）；
  校验在 `git archive` 出的干净树里跑（`mklink /J` 把 `node_modules` 指回仓库）；不碰 `main`；
  不凭空编造学生可见文案（23 号位两张卡的 `knowledge_text` 留空串等内容组给正文）。
- 分支 / commit / PR：`feature-1` 从 `79555e5` 推到 `1072821`；两个 PR 各自 12 项检查
  （`push` + `pull_request` 两条 run × 6 job）全绿才 `--merge`，分支不删；合并后 `feature-1` 复跑 CI 成功。

### [x] 覆盖率门禁接进 CI workflow (coverage-gate-in-ci)

- 分支 / commit / CI：`feature/quality-gate/ci-coverage-gate` @ `68eabad` → PR #228 → 合并提交 `20e03c4`。
- 改动：`ci-checks.yml` 的前端测试步骤 `npm run test` → `npm run test:coverage`（该步骤无 `continue-on-error`，是真门禁）；
  `package.json` 补此前**并不存在**的 `test:coverage` 脚本；`vitest.config.ts` 阈值按当日两次实测下界定为
  lines 18 / functions 20 / branches 13 / statements 18（实测 22.46 / 25.11 / 16.84 / 23.08）。
- 前置核对：`@vitest/coverage-v8@^4.1.10` 已在 devDependencies **且在 `package-lock.json`**，CI 的 `npm install` 装得到；
  三个文件都命中 `on.push.paths`。
- 验证方式：不只看绿灯，去 job 日志确认出现 `Run npm run test:coverage` → `Coverage enabled with v8` → 覆盖率四列表格；
  CI 数字（23.06/16.84/25.04/22.45）与本机导出树数字逐项对得上。

### [x] 23 号位《活板》卡片挂载 (slot-23-card-mount)

- 分支 / commit / CI：`feature/asset-numbering/slot-23-card-mount` @ `04f73da` → PR #229 → 合并提交 `1072821`。
- 逐条照 `8c51427` 的口径：`public` 与 `backend` 两份 `WEN_23.json` 是**同一个 blob**（`bba4ac7`，606 字节 LF）、
  `card_name` 沿用「历史回响」、`image_file` 写交付原名、`unlock_condition` 照 01–04 文案、`knowledge_text` 两张都留空串。
- 卡片数量不是照抄模板：拉线上 `/api/assets/oss-list` 的 `wen_list`，23 号位名下**只有** `card_paper` / `card_printing`
  两个卡片视频；两个视频此前 HEAD 均 200，挂载不引入 404。
- 代码侧：`CULTURE_CARD_DATA_POEM_IDS` 15 → 16 个号、`ORPHAN_CARD_VIDEO_POEM_IDS` 由 `['23']` 清空；
  `poemAssets.test.ts` 加三条锁（挂载表 ↔ 目录双向对应、23 号位已挂且清单就是这两个、挂载表与孤儿表不许有交集），21 → 24 例。
- 文档侧：`docs/素材缺失清单.md` 新增「23 号位补挂（2026-10-29）」小节并把孤儿计数清零；
  `docs/素材对应核查.md` 的覆盖矩阵是**线上实测**口径，故「卡片」列不改，只在汇总行标「线上 15/37、仓库 16/37」。
- **待发版**：数据文件要随前端构建才生效，发版前 `https://www.classicalab.cn/data/culture_cards/WEN_23.json` 仍是 404；
  发版后用 `scripts/check-video-inventory.sh` 探线上复核。`figma-plugin/resource-inventory.json` 是线上快照，本批不该动它。
- 仍待内容组：23 号位两张卡的导语正文；另有 12 个号位（20、21、28–37）待确认、08/11 库尔班大叔重复与 08 台标版权未定。


---

## [x] 按行业规则全站审查与 70 项修复 (industry-standard-review)

- 目标：用户口径「**按行业规则审查网站代码，全部都要审，列出清单**」→「**一一解决，并行**」。
  基线取 OWASP ASVS 4.0 L2 / Top 10 2021 / CWE Top 25、WCAG 2.1 AA、12-Factor、Vue 官方风格指南，
  加 PIPL、未成年人网络保护条例、等保 2.0 二级；清单与逐项状态只在对话与 PR 正文里，不落报告文件。
- 关联文件：199 个（见 `docs/maintenance/changelog/changelog-20261029.md` 第七批 CR-20261029-26 ~ 33，按 A–G 分组成行）。
- 红线：不启本地服务 / 不部署 / 不 SSH；`npm run lint` 带 `--fix` 所以校验一律直接调 `oxlint .` 与 `eslint . --cache`；
  不提交密钥、PII 不再入库；git 历史清洗与密钥轮换经用户明确否决后**不做**；不碰 `main`。
- 分支 / commit / PR：因是「全站审查」而非单个子功能，本轮没有按 `feature/<父>/<子>` 另拉分支，
  直接在既有 `feature/continue-nav-stuck` 上做：Step-0 快照 `c149427`（先保存当时工作区未提交改动）
  → 22 个内容提交 → 与 `feature-1` 的 108 个新提交在 `d2f62b3` 合并（42 文件冲突）→ PR #231 → 合并提交 `5e4886c`。
  PR 上 `push` + `pull_request` 两条 run × 6 job 全绿才 `--merge`，分支不删。
- 台账终值：**已修 52 / 部分修 18 / 未修 0**；18 条「部分修」= 用户明确不做的大文件拆分、CSP、密钥轮换等，不静默绕过。

### [x] 后端账号鉴权与安全契约收口 (backend-auth-hardening)

- 分支 / commit / PR：`feature/continue-nav-stuck` @ `95cb78e` → PR #231 → 合并提交 `5e4886c`。
- 补回被摘掉的 zod 校验中间件（缺它时 controller 拿到的是未校验对象）；登录先验密码再判账号状态，消掉用户名枚举时序差；
  注册不接受 `can_view_all`；内置 `admin/admin123` 取消，初始管理员需显式 `INITIAL_ADMIN_PASSWORD`；
  内部看板缺 `DASHBOARD_PASSWORD` 时 fail-closed 503；admin 重置口令改随机 + `must_reset_password` + 落 `password_resets` 审计。

### [x] /v1 别名 404 回归与答题资产越权 (api-v1-alias-and-answer-auth)

- 分支 / commit / PR：`bd357b6`（`/v1` + 上传角色）、`3a8d443`（答题/资产/日志）→ PR #231。
- **本轮唯一的真回归**：`/v1` 别名此前是挂载式 `app.use('/v1', fn)`，Express 在挂载层 `next()` 返回时按保存的原始 url
  还原 `req.url`，层内改写等于没生效 → `/v1/texts` 实测 404。改成 app 级前缀判断后重写，测试覆盖 `/v1`、`/v1/api` 两种形态。
- 同类：`/api/upload/resource` 与前端路由口径统一为 `['teacher','admin','super_admin']`（此前少一个角色）；
  答题提交加 `authorizeSubmit` IDOR 守卫；埋点忽略 body 里的 `user_id`、只信登录态，加 32KB payload 上限与 24h 时间戳偏移。

### [x] 前端登录态、开放重定向与失效接口 (frontend-auth-and-redirect)

- 分支 / commit / PR：`f4c9440` → PR #231。
- `sanitizeRedirect`（在 `src/utils/api.ts:386`）把 `route.query.redirect` 收敛到站内路径，防学生登录页被拿去跳钓鱼域；
  越权入口按路由 `meta.role` 门禁拦截，`meta` 与后端 `requireRole` 两侧口径写进注释互指；
  上传单独 60s 超时 + 支持外部 `AbortSignal`，超时以 `ApiError(0,'TIMEOUT')` 收敛。

### [x] 前端构建链、无障碍与死代码 (frontend-build-a11y-deadcode)

- 分支 / commit / PR：`38ef1da`、`572f5b5`、`39a5996`、`937a0df`、`be02e54` → PR #231。
- 修 `MultiRoleReading` 父子组件循环依赖；删首页桶文件、`src/mock/`、死代码；补无障碍（`aria-live`、焦点可见、label 关联）。
- **补断链**：`src/utils/tooltipPosition.ts`、看板视图与 `charts/` 组件此前只存在于工作区，HEAD 是构建不出来的
  （干净克隆会失败），本轮把它们提交进仓库——这条属于「审查发现的基础设施缺陷」，不是新功能。

### [x] CI 与部署工作流、脚本健壮性 (ci-deploy-scripts)

- 分支 / commit / PR：`ea28ef4` → PR #231。
- workflow 全量 `permissions: contents: read`，生产部署挂 `environment: production` + `concurrency`；
  脚本统一 `set -euo pipefail` 与显式错误退出；`package.json` 的 `lint` 拆为 `run-s lint:oxlint lint:eslint`
  并新增**不带 `--fix`** 的 `lint:ci` 给 CI 用。
- 为什么不用 `lint:*` glob 组装：会把 `lint:ci` 也卷进本地修复链路，CI 门禁脚本就不再独立了。

### [x] 仓库卫生与治理文件 (repo-hygiene)

- 分支 / commit / PR：`2c23d54` → PR #231。
- 移除误提交的 sqlite 数据库（`backend/database/answers.db`、`backend/tests/*.db`）、真实学生名单
  （`backend/data/students.json`、`answer_records.json`、`data-pipeline/source/*.xlsx`）与压缩包（`*.zip`），
  `.gitignore` 补 `*.db` / `*.zip` / `tmp-*` / `data-pipeline/source/*.xlsx` 等规则；`LICENSE`、`SECURITY.md`、
  `CONTRIBUTING.md`、`CODEOWNERS`、`dependabot.yml`、PR 模板落库。
- **`xlsx` 依赖删除**：npm 上 0.18.5 停在有原型污染通告的版本、官方修复只发在 SheetJS 自己的 CDN；
  导出改标准 CSV（UTF-8 BOM + RFC 4180 引号转义），内部看板下载名同步 `.csv`。用户口径「xlsx 现在已经不用了，都用 figma 插件上传」。
- 注意：被移除的 xlsx **本地文件仍在磁盘**（`git rm --cached` 语义），数据管线照跑；历史里的 PII 按用户「git 记录不管」保留。

### [x] 测试对齐新安全契约 (tests-align-security-contract)

- 分支 / commit / PR：`1a14b6e`、`6fa2b5d`、`e6fffd8`、`5a13821` → PR #231。
- 后端新增 `security-hardening.test.js`（30 例）、`export-format.test.js`（8 例）；前端新增 open redirect、
  路由角色门禁、WordList 浮层、适配器/图表工具用例。
- 合并 feature-1 后两张看板测试必须改契约：内置 `admin/admin123` 已取消 → 显式配 `INITIAL_ADMIN_PASSWORD`；
  固定学生口令 `99999999` 不再有效 → 用创建接口返回的 `data.initial_password` 登录。
  踩点：`require('../src/database')` 之前的 env 赋值顺序不能动，否则建表用不到 `:memory:`。

### 遗留与风险（本轮不静默绕过）

- 未启本地服务、未部署、未 SSH ⇒ **没有真实浏览器端到端验证**，CI 是唯一外部门禁；无障碍只按代码与 ARIA 契约核对，
  未做屏幕阅读器实测。
- 18 条部分修留给后续：`AnswerQueryView.vue` 仍 1812 行未拆；前端无 CSP；`jsonReader` 仍每请求同步 `readFileSync`；
  `tsconfig.app.json` 仍排除 `src/**/__tests__/*`（这批测试不在任何 vue-tsc project 里，只有 vitest 执行）；
  残留 2 处 `as any`（`AdminConsoleView.vue:120`、`StepView.vue:151`）；`StudentLogin.vue` 死代码仍在；
  `parseLimit` 未导出所以钳制逻辑没有单测。
- `.vscode/extensions.json` 仍被跟踪：当前 sparse-checkout 排除 `.vscode/**`，该删除既无法暂存也没进 PR #231，
  要先在别的会话里调整 sparse 规则。
- 覆盖率门槛本轮随合并重定为 45/38/42/45（实测 53.05 / 44.58 / 51.25 / 53.84），后续 PR 若减测试面会直接撞门禁。
- 用户明确不做：git 历史清洗、登录强制改密（`must_reset_password` 仍只写不校验）、JWT 刷新与密钥轮换、
  OSS ACL / 桶策略、生产库运维。

### [x] 测试部署的 .env 门禁回归修复 (deploy-env-gate-regression)

- 分支 / commit / PR：`feature/ci-fix/backend-env-deploy-gate` @ `5c18a00` → PR #250（6 项检查全绿）→ 合并提交 `de822c6`。
- 现象：PR #231 合进 `feature-1` 后 `Deploy Backend to Test Server` 判红
  （`ERROR: backend/.env 缺少必需变量: JWT_SECRET DASHBOARD_PASSWORD DEEPSEEK_API_KEY`），合并前该工作流连续 10 次成功
  ⇒ 本轮 E 组带回的回归；部署中止、旧 `.env` 备份在 `.env.prev`，测试后端仍是上一版，没有半部署状态。
- 根因：门禁把「代码能优雅降级的可选密钥」当部署必需项。实查 `gh api repos/.../actions/secrets` 名单里
  **只有 `ASSET_SYNC_TOKEN`**，没有 `JWT_SECRET` / `DASHBOARD_PASSWORD` / `DEEPSEEK_API_KEY`，
  所以 `inject_if_missing` 对这三把永远填不上；而代码对它们的态度是 503（资产同步 / 内部看板 / AI 对话）而不是起不来，
  真正硬抛的只有「`NODE_ENV=production` 且 `JWT_SECRET` 缺失」一条。
  测试机上 `JWT_SECRET=` 还是空值行——旧版工作流无条件 `echo "JWT_SECRET=${{ secrets.JWT_SECRET }}"` 留下的痕迹。
- 改法：`JWT_SECRET` 缺失才判红；测试环境按「旧值 > GitHub Secret > 现场生成一次并持久化」补齐（留空等于
  用可预测的 `dev-only-secret` 在公网域名 `test.classicalab.cn` 上发 token）；另三把降为 WARNING 并写明哪个功能 503；
  生产**绝不自动生成**（静默换密钥会一次性作废全网 token）；剔除阶段顺带丢掉这四把的空值行。
- 本机验证方式（不 SSH、不部署）：用仓库自带的 `yaml` 包把 `.env` 重建段从 workflow 里抽出来，
  把 `${{ secrets.X }}` 按「仓库里是否真有这个 Secret」分别展开成值或空串，在临时目录 `bash` 跑：
  复现测试机状态 → `rc=0`、`JWT_SECRET` 恰好 1 行长度 64、其它键原样保留、**再跑一次值不变**；
  已有真实值不覆盖；生产段空值 → `rc=1`。两段抽出来的脚本先过 `bash -n`。
- 副作用（已对用户说明）：测试机第一次现场生成 `JWT_SECRET` ⇒ 此前签发的测试站 token 作废一次，需重新登录。

---

## [ ] 依赖机器人首扫开出的 18 个 PR 待人工判断 (dependabot-triage)

- 目标：`.github/dependabot.yml`（第七批新增）首次扫描开出 PR #232–#249，共 18 条，正好顶满 4 个生态 × 5 条上限；
  逐条判断要不要合、要不要把策略收紧成「只 minor/patch + 安全更新」。
- 关联文件：`.github/dependabot.yml`、`package.json` / `package-lock.json`、`backend/package.json`、`figma-plugin/package.json`。
- 红线：major 升级会动 API（zod 4 改所有 schema、vitest 5 改配置、supertest 7 改链式调用），
  **不在审查修复批里顺手合**；合任何一条都要单独拉分支跑全量 CI。
- 现状抽查：#242（figma-plugin typescript 7）/ #247（backend zod 4）/ #244（vite 8.3.5）六项检查全绿；
  **#238（根 vitest 4 → 5）有 1 条红**。全绿不等于能合——major 的兼容性要按接口面看，不是看测试跑过。
- 待你定：要不要给三个 npm 生态加 `ignore: update-types: ["version-update:semver-major"]` 只留 minor/patch + 安全更新；
  代价是「CVE 需要 major 才能修」时不会自动开 PR，得人工发起。

