# 变更记录 2026-10-28

> 依据 `rules/maintenance_standards.md` 4.5.1 / 4.5.3 生成；保存位置 `docs/maintenance/changelog/`，命名 `changelog-YYYYMMDD.md`。
>
> 本次变更聚焦「发布新鲜度」方案（`docs/maintenance/release-freshness-plan.md`）的阶段 1 / 2 / 3 / 4：
> 构建号可见、部署缓存契约与自检、旧会话懒加载失败自愈、新版本只提示不刷新。
>
> **发布事实（2026-10-28 13:23）**：PR #193 由人工把 `feature-1`（`f34eeb76`，含 CR-01…07）合入 `main`（`f4c2d18e`），
> `Deploy Frontend to Aliyun OSS` 成功。生产 `https://www.classicalab.cn/` 的 `index.html` 返回
> `<meta name="build-id" content="f4c2d18">`、入口 `/assets/index-C3VehIAz.js`，`Cache-Control` 分别为 `max-age=0`（入口）与 `max-age=31536000`（hash 产物）。
> 下面各明细段落里的「待上线」是写下那条时的状态，表格列已按发布结果更新。

| 变更编号 | 变更类型 | 影响范围 | 变更描述 | 测试状态 | 上线状态 |
|---|---|---|---|---|---|
| CR-20261028-01 | feat | `src/utils/chunkRecovery.ts`、`src/main.ts` | 懒加载 chunk 失败时整页重载到本次导航目标地址，一次会话同一地址只刷一次 | 已通过 | 已上线 |
| CR-20261028-02 | chore | `.github/workflows/deploy-frontend.yml`、`.github/workflows/deploy-frontend-test.yml` | 长缓存只给 hash 产物、`index.html` 每次回源、CDN 刷新失败即红、部署后自检入口 hash | 已通过（测试环境首跑成功） | 已上线 |
| CR-20261028-03 | feat | `vite.config.ts`、`env.d.ts`、`src/utils/buildStamp.ts`、`src/components/common/BuildStamp.vue`、`src/App.vue`、`vitest.config.ts` | 构建号注入 + 页脚可见 + `index.html` 的 `build-id` meta | 已通过 | 已上线 |
| CR-20261028-04 | docs | `docs/maintenance/release-freshness-plan.md`、`tasks/nightly-tasks.md` | 方案落库（含执行记录与两条方案自我修正）、台账补「发布新鲜度」父功能 | 不适用 | 已上线 |
| CR-20261028-05 | feat | `src/utils/buildVersion.ts`、`src/components/common/UpdatePrompt.vue`、`src/App.vue`、`src/main.ts` | 新版本探测 + 底部提示条（只提示，刷新只在用户点击时发生），并接手阶段 3 放弃重载的四种原因文案 | 已通过 | 已上线 |
| CR-20261028-06 | docs | 同 CR-04 两份文档 + 本变更记录 | 阶段 4 执行记录、meta 生效已实测的验证项更新、台账勾选 | 不适用 | 已上线 |
| CR-20261028-07 | fix | `src/components/ClassPicker.vue`、`src/components/__tests__/ClassPicker.test.ts` | 全年级权限勾上不收起、勾年级后班级行永远出不来两处缺陷；测试的 testid 前缀串味修正；`quality-check` 自建立首次全绿 | 已通过 | 已上线 |
| CR-20261028-08 | chore | `figma-plugin/**`、`.github/workflows/sync-figma-plugin.yml`（PR #186 → `feature-1`）+ 两份文档 | 插件读取共享样式的工作合入 `feature-1`（不含在本次生产发布里）；台账补「CI 质量基线转绿」与发布事实 | 已通过 | 未上线（等下一次 `main` 窗口） |

## 变更明细

### CR-20261028-01 懒加载 chunk 失败整页重载一次

- **变更类型**：feat（功能）
- **变更时间**：2026-10-28
- **分支**：`feature/release-freshness/chunk-reload-recovery` @ `490c06e`；经 PR #191 并入父分支 `feature/release-freshness/main`（合并提交 `8dcbddba`）；随 PR #192 并入 `feature-1`（合并提交 `3c0a786`）
- **影响范围**：`src/utils/chunkRecovery.ts`（新增 328 行）、`src/main.ts`（+5）、`src/utils/__tests__/chunkRecovery.test.ts`（新增 421 行 / 21 项）
- **变更描述**：
  - 监听 Vite 的 `vite:preloadError` 与 vue-router 5 的 `onError(error, to)`，命中「动态 import / 预加载失败」这一类错误文案（Chrome、Firefox、Safari、Vite CSS 预加载、webpack `ChunkLoadError`）后整页重载。
  - 重载目标是**本次导航要去的路由地址**：`beforeEach` 记录 `to.fullPath`（必须写成代码块，箭头函数直接返回字符串会被 vue-router 当成重定向），`onError` 优先用 vue-router 传入的 `to`。前提是深链可重载 —— 实测 OSS 静态网站 404 回落到 index.html，`www` 与 `test` 均成立。
  - 单次限制防死循环：本文档内存标志 + `sessionStorage` 同地址记录 + 10 秒冷却，且只有真正到达该地址后才由 `afterEach` 释放。
  - 边界收窄：业务接口失败（`Failed to fetch`、`Network Error`）绝不触发刷新，避免断网把学生正在答题的页面刷掉；离线、`sessionStorage` 不可用（Safari 无痕）、`setItem` 抛错时放弃重载，写 `wenyan:chunk-reload-hint` 并派发 `wenyan:chunk-reload-failed` 事件，供阶段 4 的「只提示不刷新」对接。
  - `vite:preloadError` 不调 `preventDefault`：Vite 会把错误继续抛出，`router.onError` 也能命中同一条链路，`reloadScheduled` 保证一次失败只重载一次。
- **测试状态**：已通过（`src/utils/__tests__/chunkRecovery.test.ts` 21 项，含与真实 `createRouter` + 失败懒加载组件的接线用例；type-check、lint 绿）
- **上线状态**：待上线（已在测试环境构建内；生产随 `feature-1 → main` 的 PR 合并后生效）

### CR-20261028-02 部署缓存契约与 CDN 刷新校验

- **变更类型**：chore（部署链路）
- **变更时间**：2026-10-28
- **分支**：`feature/release-freshness/deploy-cache-contract` @ `7599a12`；经 PR #188 并入 `feature/release-freshness/main`（`c6cebe18`）；随 PR #192 并入 `feature-1`（`3c0a786`）
- **影响范围**：`.github/workflows/deploy-frontend.yml`（+71/-30）、`.github/workflows/deploy-frontend-test.yml`（+53/-15）
- **变更描述**：
  - 上传拆成三段：`dist/assets` → `public,max-age=31536000,immutable`；`dist/index.html` → `no-cache`；其余根级文件 → `max-age=3600`。旧写法先把整个 `dist`（含 index.html）打成一年缓存再补救，顺序一失败就出现「某台浏览器一年不更新」。
  - 阿里云 CDN 刷新（`RefreshObjectCaches --ObjectType Directory`）失败不再 `|| echo Warning` 静默：`set -e` 下 CLI 非零退出即 job 失败，是否真生效交给下一步黑盒验证（20 次 × 15 秒，约 5 分钟）。
  - 新增部署后黑盒自检：从本次 `dist/index.html` 取入口 chunk，与线上返回的 HTML 比对，12 次 × 10 秒仍不一致就判红。测试域名实测是 OSS 直连（无 `Via` / `X-Cache`），那一步对它只做 OSS 自检，并临时带 `-k` 绕过 `test.classicalab.cn` 的证书主机名不匹配（该问题单列为待办）。
- **测试状态**：已通过（`Deploy Frontend to Test OSS` run 40614107402 成功，自检第 1 轮命中：`https://test.classicalab.cn/` 返回本次构建的 `/assets/index-DiJuirkI.js`）。注意 deploy workflow 不受 CI 覆盖，这是改动的第一次真实执行。
- **上线状态**：待上线

### CR-20261028-03 构建号注入与页脚可见

- **变更类型**：feat（功能）
- **变更时间**：2026-10-28
- **分支**：`feature/release-freshness/build-id-visibility` @ `7013e55` + `d452d16`；经 PR #194 / #195 并入 `feature/release-freshness/main`（`a25c377`）
- **影响范围**：`vite.config.ts`、`env.d.ts`、`vitest.config.ts`、`src/utils/buildStamp.ts`（新增）、`src/components/common/BuildStamp.vue`（新增）、`src/App.vue`、两处 `__tests__`
- **变更描述**：
  - `define.__BUILD_ID__` 取 `GITHUB_SHA` 前 7 位，本地退回 `local`；不掺构建时间戳，以免同一输入每次产出不同字节（与素材链路的产物字节稳定约定冲突）。
  - 同一个号由 `inject-build-id-meta` 插件写进 `index.html` 的 `<meta name="build-id">`：页脚的号给人看，这条给 curl / CI 看。
  - 格式化分支收在 `src/utils/buildStamp.ts`（组件不碰数据来源）；`BuildStamp.vue` 与备案号同行，父容器 `pointer-events: none`，组件内单独放开并允许选中复制。D1 决策按「学生端也显示」实施。
  - 修红记录：组件模板里一条根级 HTML 注释在开发模式下也是一份子节点，组件成为 fragment 后 `wrapper.element` 返回挂载容器 `DIV`，3 条用例落空；说明文字移进 `<script setup>`，并把「必须是单根」写成断言锁死。
- **测试状态**：已通过（`src/utils/__tests__/buildStamp.test.ts` 8 项 + `src/components/__tests__/BuildStamp.test.ts` 3 项，CI run 40616705443；type-check / lint 绿）
- **上线状态**：待上线（合入 `feature-1` 后由测试环境部署验证 meta 是否生效）

### CR-20261028-04 方案落库与台账

- **变更类型**：docs
- **变更时间**：2026-10-28
- **影响范围**：`docs/maintenance/release-freshness-plan.md`（首次入库）、`tasks/nightly-tasks.md`
- **变更描述**：方案文档补 2026-10-28 的阶段 1 / 2 / 3 执行记录与决策点结论（D1 全员可见、D2 只提示不刷新、D3 一功能一上线），并记两条对方案自身的修正：`feature/<父>` 与 `feature/<父>/<子>` 在 git 里互斥，集成分支改用 `feature/release-freshness/main`；单测必须落在 `src/**/*.test.ts`，原计划的 `tests/components/BuildStamp.test.ts` 不在 CI 的 `include` 内。台账新增父功能「发布新鲜度」，阶段 4 保留未完成。
- **测试状态**：不适用
- **上线状态**：待上线

### CR-20261028-05 新版本探测与提示条（阶段 4）

- **变更类型**：feat（功能）
- **变更时间**：2026-10-28
- **分支**：`feature/release-freshness/version-prompt` @ `a4f0330` + 修红 `2b2edf0`；经 PR #197 / #198 并入 `feature/release-freshness/main`（`ca8c6c96`）；再随该集成分支并入 `feature-1`
- **影响范围**：`src/utils/buildVersion.ts`（新增 331 行）、`src/components/common/UpdatePrompt.vue`（新增 187 行）、`src/App.vue`（+4）、`src/main.ts`（+6）、两处 `__tests__`（23 + 10 项）
- **变更描述**：
  - 探测请求与用户手动刷新走完全相同的路径：`withBase('/index.html', normalizeBase(BASE_URL))` + `cache: no-store`，**不加时间戳参数** —— 加时间戳会绕过边缘节点，测出「线上并不提供的那份」，提示就成了假消息。`index.html` 本身已由阶段 2 定为 `no-cache`。
  - 版本指纹两档：主口径阶段 1 注入的 `<meta name="build-id">`，备口径入口 chunk 文件名 `/assets/index-*.js`；`isUpdatable` 只在**同口径**且值不同时判为有更新，口径不同或缺一边都不说，避免误报。本地开发（`local`）取不到本地指纹，整条链路自动失效。
  - 节流：首屏不查（这份文档本身就是刚拿到的 `index.html`）+ 10 分钟定时 + 页面重新可见时补一次，两次探测之间最少隔 60 秒；离线、请求失败、拿不到指纹全部静默，仅开发环境一行 `debugWarn`。同一份新构建在一篇文档内只提示一次，点「稍后再说」把指纹写进 `sessionStorage`，本会话不再唠叨。
  - 只提示不刷新：探测层只 `dispatchEvent('wenyan:new-version')`，`requestManualRefresh()` 仅由组件的「刷新页面」按钮调用；单测把「事件到来时没有刷新」写成断言。
  - 阶段 3 的四个放弃分支在这里变成人话：监听 `wenyan:chunk-reload-failed`，并在挂载时回读 `wenyan:chunk-reload-hint`（带 10 分钟有效期，旧记录不弹）。文案表用 `Record<ChunkRecoveryHint['reason'], string>`，将来阶段 3 新增原因会在编译期暴露遗漏。加载失败优先于「发现新版本」，不被后者顶掉。
- **测试状态**：已通过（`src/utils/__tests__/buildVersion.test.ts` 23 项 + `src/components/__tests__/UpdatePrompt.test.ts` 10 项；type-check / lint 绿；`CI Checks` 仅剩继承的 `ClassPicker.test.ts` 9 条红）。修红记录：`onMounted` 里改状态是异步重渲染，挂载那一帧仍是隐藏，改为在 setup 期回读 hint（PR #198）。
- **上线状态**：待上线

### CR-20261028-06 阶段 4 记录与验证项修订

- **变更类型**：docs
- **变更时间**：2026-10-28
- **影响范围**：`docs/maintenance/release-freshness-plan.md`、`tasks/nightly-tasks.md`、本变更记录
- **变更描述**：方案第 8 节补阶段 4 执行记录与两条被 CI 教的事（fragment、异步重渲染）；第 7 节「仍未完成的验证」第 1 条改为已实测 —— 测试环境 `index.html` 返回 `<meta name="build-id" content="4b44b2f">` 且与 `feature-1` 提交短 sha 一致，部署后的入口 chunk 内为 `Md("4b44b2f")`、`__BUILD_ID__` 出现 0 次；台账勾选 `version-prompt` 并更新父功能的分支链与用例数（21 + 8 + 3 + 23 + 10 = 65）。
- **测试状态**：不适用
- **上线状态**：已上线

### CR-20261028-07 ClassPicker 两处缺陷修复（CI 质量基线转绿）

- **变更类型**：fix（缺陷修复）
- **变更时间**：2026-10-28
- **分支**：`feature/classpicker-fix` @ `0433156`；PR #200 并入 `feature-1`（`f34eeb76`）；随 PR #193 并入 `main`（`f4c2d18e`）
- **影响范围**：`src/components/ClassPicker.vue`、`src/components/__tests__/ClassPicker.test.ts`（合计 +141 / -38，用例 22 → 27）
- **变更描述**：
  - 缺陷一（用户可见）：勾「全年级权限」不会收起具体班级选择区。Vue 对 Boolean prop 做隐式转换 —— 父组件不传 `fullAccess` 时 `props.fullAccess` 是 `false` 而不是 `undefined`（`runtime-dom` 的 `resolvePropValue`：absent 且无 default → `false`），于是 `props.fullAccess ?? innerFullAccess` 恒为 `false`，`if (props.fullAccess === undefined)` 是死分支。`AdminConsoleView.vue:66` 与 `TeacherRegisterView.vue:158` 两个调用点都只监听 `@update:full-access`、不绑这个 prop，所以这条路径从组件写出来那天起在线上是坏的。现在 `innerFullAccess` 是唯一事实源，prop 变化时才由 watcher 同步进来（父组件真用 `v-model:full-access` 也照常工作）。
  - 缺陷二：年级 chip 勾上后班级行永远出不来。`emitChange()` 末尾用「已选班级」反推该保留哪些年级，而勾年级 chip 时 v-model 刚把年级加进去、已选班级还是空的，紧接着这段过滤就把刚勾上的年级抹掉。过滤本身有意图（移除班级后年级不该残留），抽成 `pruneGradesToSelection()`，只在班级数量**减少**的路径上调用（移除按钮、取消勾选班级 chip），手动添加编码不再顺手收掉已展开的年级。
  - 测试侧三处：`[data-testid^="selected-"]` 会连容器 `selected-row` 一起数、`[data-testid^="class-"]` 会连根节点 `class-picker` 一起数，改成限定容器后代的 `selectedChips()` / `classChips()`；`addManual()` 的 `trim()` 是有意的（从表格粘贴编码常带空格），原用例把「`' 202501'` 算非法」写成与实现相反的期望，现拆成一条独立用例断言它被正确添加；「超过 6 位」的输入用例删除 —— 输入框带 `maxlength=6`，程序化赋值是否被截断取决于测试环境，断言不稳（长度不足已由 `'123'` / `'20250'` 覆盖）。
  - 组件模板只改了一个 `@change` 绑定，`data-testid` 全部保持原样，页面与 E2E 无需跟改。
- **测试状态**：已通过。本机无 node、vitest 只能由 CI 跑：`quality-check`（type-check / lint / test）自 `ClassPicker.test.ts` 建立以来**首次全绿**，27 条用例全过；`feature-1` 在 `#186` 合入后仍全绿（run 40637908089）。
- **上线状态**：已上线。生产 `https://www.classicalab.cn/assets/ClassPicker-DXgI1AbN.js` 里过滤逻辑已是独立函数（`map(e=>e.slice(0,4))` + `filter`）且不在 `emitChange` 内，确认部署的是修好的那份。

### CR-20261028-08 插件样式读取合入 feature-1 与文档补记

- **变更类型**：chore（合入 + docs）
- **变更时间**：2026-10-28
- **分支**：`feature/figma-plugin-style-extract` @ `4bb6a60`；PR #186 并入 `feature-1`（`007dc90a`）
- **影响范围**：`figma-plugin/**`（`core.ts`、`code.ts`、`code.js`、`ui.html`、两份文档、`__tests__/core.test.ts`）、`.github/workflows/sync-figma-plugin.yml`，合计 +2472 / -61；以及 `tasks/nightly-tasks.md` 与本变更记录
- **变更描述**：插件读取样式 Frame 与本地共享样式 CSS 参数的那批改动合入 `feature-1`。只碰 `figma-plugin/`，不进前端产物 —— `deploy-frontend-test.yml` 的 `paths:` 过滤因此没有为 `007dc90a` 触发前端部署，这是预期行为而不是漏跑。台账新增父功能「CI 质量基线转绿」，「发布新鲜度」父功能补上 `feature-1` / `main` 的实际 sha 与生产实测结果。
- **测试状态**：已通过（`CI Checks` run 40637908089 全绿，`figma-plugin-check` 覆盖插件新增的 403 行用例）
- **上线状态**：未上线 —— 生产只到 `f4c2d18e`，这部分等下一次 `feature-1 → main` 窗口
