# 变更记录 2026-10-30

> 依据 `rules/maintenance_standards.md` 4.5.1 / 4.5.3 生成；保存位置 `docs/maintenance/changelog/`，命名 `changelog-YYYYMMDD.md`。
>
> 本轮（第八批）是**解耦轮**：接着第七批全站审查往下走，只做耦合，不改行为。
> 选题标准是「真实收益 ÷ 影响面」，明确不做风格/命名挑刺，不为假想的将来抽象。
> 五个 PR 依次 `--no-ff` 并入 `feature-1`：#255 `db8f637` → #256 `fcfc3df` → #257 `1306a74` → #258 `deb4d59` → #259 `2de6881`。
>
> **上线状态**：五个合并都只到 `feature-1`（= 测试环境，`test.classicalab.cn`），每条合并触发的
> CI Checks 与 Deploy Frontend to Test OSS 全绿（run 见下表）；**没有一个进生产**，
> `main` 仍停在昨晚的 `8760894`，生产前端 build-id 也未变。

| 变更编号 | 变更类型 | 影响范围 | 变更描述 | 测试状态 | 上线状态 |
| --- | --- | --- | --- | --- | --- |
| CR-20261030-01 | refactor | `src/utils/tracking.ts`、`src/composables/useTracking.ts`、`src/stores/auth.ts`、`src/router/guards.ts`、`src/composables/{data,navigation,playback,quiz,student,tracking}/index.ts`（删）、`src/utils/studentApi.ts`（删）、`src/components/{DeleteConfirmModal,StudentFormModal,StudentTable}.vue` | 会话切割收进单一入口：`firstEnterSet` 与 `isFirstEnter` 从 composable 搬进 `tracking.ts`，`resetSessionId()` 顺手清它，`stores/auth` 不再为了清一张别人的 Set 反向依赖 composable（那条 store→composable 依赖原来要 `resetFirstEnterSet` 和 `resetSessionId` 成对调用才不出错，忘一半就是「新会话不再计 first_enter」）。同时删 6 个无人引用的 composable 桶文件、7 行的 `studentApi.ts` re-export 兼容层（4 个引用点改指 `services/studentService`），并删掉 `guards.ts` 里写进 `sessionStorage` 却没有任何页面读过的 `__role_guard_warn` | 已通过（64 files / 967 tests，与基线同数；`vue-tsc --build` 0 错误） | 已部署测试环境（CI `40977758018`、FE-test `40977758025`）；未上生产 |
| CR-20261030-02 | build(ci) | `.nvmrc`（新）、`.github/workflows/{ci-checks,deploy-frontend,deploy-frontend-test}.yml`、`Dockerfile` | Node 版本与 lint 命令各收敛到一个事实源：新增 `.nvmrc`（`22`），6 处 `setup-node` 的 `node-version` 硬编码（4 个 CI job + 两条前端部署 workflow）改 `node-version-file: '.nvmrc'`，合入后全仓 workflow 已无残留的 `node-version:` 字面量；CI 的 lint 步骤由裸 `npm run lint` 改成 `npm run lint:ci`（带 `--fix` 的 lint 在 CI 里会改文件却不改回，等于门禁自己制造脏树）。修掉的实际分歧：CI 跑 Node 20 而 `Dockerfile` 镜像跑 Node 22，测试环境和生产的构建环境从来不是同一套 | 已通过（CI `40979186701` 6 项 + 两条部署 `40979186889` / `40979186671` 全绿） | 已部署测试环境；**未上生产**（生产 PM2 的实际 Node 版本我没验，见文末更正） |
| CR-20261030-03 | refactor | `src/utils/authBridge.ts`（新）、`src/types/auth.ts`（新）、`src/utils/{api,tracking,localStorage}.ts`、`src/stores/auth.ts`、`tests/utils/tracking.spec.ts`、`tests/stores/auth.spec.ts` | 断开 `utils ↔ stores` 两条静态循环：新增叶子模块 `authBridge.ts`（`WeakMap<Pinia, AuthBridge>`，store 在自己 setup 里注册，`api.ts` / `tracking.ts` 通过 `activeAuthBridge()` 取 token/userId/logout，不再 `import { useAuthStore }`）；`Role` 与 `User` 类型从 `stores/auth.ts` 挪进 `types/auth.ts`，`utils/localStorage.ts` 因此也不必再引用 store。`tracking.ts` 里两段重复 8 行的「登录了就取学号」收成 `currentUserId()` | 已通过（64 files / **968** tests，+1 新用例；`tests/unit/apiAuthHeader.spec.ts` 4 个鉴权头分支未改动仍全绿，证明新路径真在被测） | 已部署测试环境（CI `40979523920`、FE-test `40979523886`）；未上生产 |
| CR-20261030-04 | refactor | `src/components/{AdaptQuiz,DialogText,PreQuizText}.vue`、`src/views/StepView.vue`、`src/components/__tests__/AdaptQuiz.figmaAssets.test.ts`、`src/views/__tests__/StepView.test.ts` | 数据 JSON 路径统一走 `utils/asset.getDataUrl()`：四处组件内联拼 `/data/${dir}/${file}.json`，与 `getDataUrl` 是同一件事的两种写法（`StepView.vue` 同一文件里两种并存）。收敛后 `ossBase` 前缀规则只剩一处实现。行为等价：`VITE_OSS_BASE_URL` 与站点同源，未配置时 `getDataUrl` 退回相对路径拼法逐字相同；新增的 `encodeURIComponent` 对本轮四个目录里全部 `WEN_NN.json` 是空操作 | 已通过（64 files / 968 tests；两个测试的 `vi.mock('@/utils/asset')` 补了 `getDataUrl`，URL 与改造前一致） | 已部署测试环境（CI `40980901071`、FE-test `40980901180`）；未上生产 |
| CR-20261030-05 | refactor | `src/utils/roles.ts`（新）、`src/router/{guards,index}.ts`、`src/services/studentService.ts`、`src/views/{AnswerQueryView,ResourceUploadTool,StudentLoginView}.vue`、`tests/unit/routerGuards.spec.ts` | 角色集合与判定收敛到叶子模块：「哪些角色算管理侧」是后端契约，此前在前端写了四遍（路由 meta 内联数组、`AnswerQueryView` 的 `ADMIN_ROLES`、`studentService` 的 `\|\|` 串、`ResourceUploadTool` 的三连 `===`），靠注释互相指认「两侧口径一致」。新增 `utils/roles.ts`（只依赖 `@/types/auth`）导出 `ADMIN_ROLES` / `STAFF_ROLES` + `isRoleAllowed` 等判定，四处引用同一组常量；`isRoleAllowed` 从 `guards.ts` 迁出是为了让 service/视图引用判定时不必依赖路由守卫模块。`router/index.ts` 对 store 的唯一类型依赖改指 `@/types/auth`；`StudentLoginView` 本地重打的 `Role` 联合改成 `Extract<AuthRole, …>` | 已通过（64 files / **974** tests，+6 新用例；Jest 27 suites / 527 tests 与基线一致；分层闭包检查 `src/utils` 18 模块到 `src/stores` 路径数 0） | 已部署测试环境（CI `40981182882`、FE-test `40981182905`）；未上生产 |
| CR-20261030-06 | docs | `docs/maintenance/changelog/changelog-20261030.md`、`tasks/nightly-tasks.md` | 本文件与台账回填：记第八批 5 个解耦 PR、行为等价的证明方式，以及本轮需要更正的四条说法（见文末） | 不适用 | 不适用 |

## 变更明细

### CR-20261030-01 会话切割的归属

- **分支 / commit**：`feature/decouple/composable-boundaries` @ `b78b9cd` → `--no-ff` 并入 `feature-1`（`db8f637`）；PR #255
- **原来的耦合形状**：`stores/auth.ts` 里换会话要成对调 `resetSessionId()` 和 `resetFirstEnterSet()`，后者来自 `composables/useTracking`。状态（`firstEnterSet`）住在 composable，清理动作却要 store 记得——漏调一个不报错，只是「新会话不再记 first_enter」，埋点数据静默失真。
- **改法**：Set 和它的判定 `isFirstEnter` 一起进 `utils/tracking.ts`，`resetSessionId()` 内清 Set；composable 改成从 `utils/tracking` 引入 `isFirstEnter`，方向变成 composable → utils 单层。
- **测试为什么是变强了**：`tests/stores/auth.spec.ts` 原来断言「两个 mock 函数各被调一次」，测的是调用形式；现在断言 `resetSessionId` 一次，而 first_enter 清零这个不变量由 `tests/composables/useTracking.spec.ts` 对着**真实实现**测（`resetSessionId 后重新标记为首次进入`）。
- 顺带删的三样都属于「已无引用」核实后才删：6 个桶文件 `grep` 出 0 个引用方（`composables/quiz/useQuizFlow.ts` 本体保留，`StepView.vue:187` 直接引它），`studentApi.ts` 只是 `export * from '@/services/studentService'`，`__role_guard_warn` 全仓只有这一处写入、没有任何读取。

### CR-20261030-02 Node 版本与 lint 命令

- **分支 / commit**：`feature/decouple/ci-single-source` → `feature-1`（`fcfc3df`）；PR #256
- **实测到的分歧**：CI 的 `setup-node` 写死 Node 20，`Dockerfile` 基础镜像是 Node 22。同一段代码在测试环境和 CI 里由两个大版本构建/校验，`??=`、structuredClone 之类差异会以「CI 绿、线上炸」的形式暴露。
- **`.nvmrc` 作为单一来源**：CI 3 处 + 两条前端部署 workflow 各 1 处全部改 `node-version-file`；`Dockerfile` 那行不能引用 `.nvmrc`（构建期不读它），改成注释里写明「major 必须跟 `.nvmrc`」，并在 CI header 注释里点名这个约定。
- **`lint` → `lint:ci`**：项目约定 `npm run lint` 带 `--fix`（开发方便），CI 用它会在检查过程里修改工作树。`lint:ci` 是 `oxlint .` + `eslint . --cache` 不带 `--fix`。
- 未动 `npm ci`：项目在 `deploy-backend.yml:145` 明确禁用（lock 文件可能不同步），这条约定优先于「CI 一般该用 npm ci」的通行做法。

### CR-20261030-03 AuthBridge

- **分支 / commit**：`feature/decouple/auth-bridge` → `feature-1`（`1306a74`）；PR #257
- **两条环**：`utils/api.ts → stores/auth`（取 token）和 `utils/tracking.ts → stores/auth`（取 user_id），而 `stores/auth` 又 `→ utils/tracking`（埋点、会话）。ESM 下这是真环，不是洁癖：模块初始化顺序会影响 `useAuthStore` 能否被拿到，Vitest 的 mock 也必须绕。
- **改法**：反转依赖方向而不是引入 DI 框架。`authBridge.ts` 是不依赖任何应用模块的叶子，store 在 setup 末尾把自己注册进 `WeakMap<Pinia, AuthBridge>`；调用方 `activeAuthBridge()?.getToken()`，拿不到就退回 `getAuthData().token`（持久化登录态）——这正是原来 F-005 那个「Pinia 未安装时静默发匿名请求」的兜底位置，语义没变，只是不再需要 import store。
- 第一稿里写过 `__resetAuthBridgesForTests` 加一层缓存，属于为测试造的 API，且缓存本身有错（跨 pinia 实例串），删掉后模块只剩 4 个导出。
- `tests/utils/tracking.spec.ts` 原来 `vi.mock('@/stores/auth')` 已经随着 import 消失而失效（mock 一个不再被引的模块），删掉；新增用例「登录态下 user_id 取学号（走 AuthBridge，不是 tracking 自己读 store）」，让新通道本身有断言覆盖。

### CR-20261030-04 / -05 见各自 PR 正文

两条都是「同一件事写了好几遍」的收敛，细节在 PR #258 / #259。这里只记一条判据：`normalizeRequiredRoles` 现在返回**副本**，原实现 `return role` 把路由 meta 里那份共享 `ADMIN_ROLES` 直接交给调用方；`tests/unit/routerGuards.spec.ts` 加了 `not.toBe` 与 `toBe` 两组断言，分别盯住「不泄漏共享常量」和「路由表与页面授权引用同一份」。

## 本轮明确没做的（以及为什么）

- **`audio_file` 的 `/audio/` 路径**：审查报告断言它「永远到不了 OSS」，这个判断在同源部署下不成立——`VITE_OSS_BASE_URL` 就是站点自身域名，相对路径命中同一份资源。真要改它是修 bug 而不是解耦，得单独按缺陷立项。
- **CultureCards / Level1Quiz / WordList / MultiRoleReading 的 `baseUrl` prop 覆盖缝**：为「将来可能换数据源」预留的抽象，当前没有第二个数据源，属于假想需求。
- **VideoPlayer 抽取、toast 与 `mm:ss` 去重**：重复是真的，但都在 10 行以内且各自演进过，抽出来的协调成本高于收益。
- **`src/adapters/level*QuizAdapter`**：那条线上有陈旧 draft PR #50 的碰撞区，先不动。
- **`stores/auth.ts` 里的 `VALID_ROLES`**：它是登录响应的合法性校验清单，不是权限集合，并进 `utils/roles.ts` 会模糊后者「谁能做什么」的定位。

## 更正（本轮我自己写错或说得过头的地方）

1. **提交 `80b4796`（PR #256）的信息里我写了「镜像和线上 PM2 跑的是 Node 22——CI 绿灯并不验证真正上线的那套运行时」，其中「线上 PM2」那半句没验证过。** 我没有 SSH，生产 PM2 实际用哪个 Node 大版本无从核对；能验证的只有 `Dockerfile` 是 `node:22-slim`（测试环境的 compose 用这个镜像）与 CI 原来写死 20 这件事。PR #256 正文已收敛成只声称「CI 与构建镜像对齐」，但已推送的提交信息带着那句过度声称，此处留档纠正。CR-20261030-02 的上线状态因此标「生产 PM2 未验」。**这条不是小事**：如果生产 PM2 其实跑 Node 20，那本轮解决的是 CI↔镜像不一致，CI↔生产仍不一致，`.nvmrc` 这条线还没闭合。
2. **prettier 基线本来就不干净**：`utils/api.ts`、`utils/tracking.ts`、`utils/localStorage.ts`、`services/studentService.ts`、`views/AnswerQueryView.vue`、`views/StudentLoginView.vue`、`tests/utils/tracking.spec.ts` 在改动前就不符合 prettier（逐个 `git show origin/feature-1:<file>` 后在仓库外跑 `prettier --check --config` 验过）。本轮没有顺手格式化它们，避免在解耦 PR 里混进无关的大面积 diff；已在 PR #257 / #259 正文说明。CI 的门禁是 oxlint + eslint，不含 prettier，所以这不阻塞。
3. **CI 的 `circular-check` 看不见本轮拆掉的环**：它不做 `@/` 别名解析，别名引入的循环一律漏检。也就是说这几条环不是被 CI 抓出来的、也不是靠 CI 保证不再回来的。把它修成能解析别名是独立一项，记在台账待办，没有塞进本轮任何 PR。本轮的分层/环检查是仓库外脚本跑的，不属于门禁。
4. **提交信息里「断开两条静态循环」的措辞**：`utils → stores` 的静态边确实断了两条，但 `stores/auth → utils/tracking`（埋点）仍然在，整个图不是无环。准确说法是「断开了 `utils` 侧主动引用 store 的两条边」，`tests` 与真实运行时行为以此为准。
