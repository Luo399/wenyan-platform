# 变更记录 2026-10-28

> 依据 `rules/maintenance_standards.md` 4.5.1 / 4.5.3 生成；保存位置 `docs/maintenance/changelog/`，命名 `changelog-YYYYMMDD.md`。
>
> 本次变更聚焦「发布新鲜度」方案（`docs/maintenance/release-freshness-plan.md`）的阶段 1 / 2 / 3：
> 构建号可见、部署缓存契约与自检、旧会话懒加载失败自愈。阶段 4（新版本只提示不刷新）未做。

| 变更编号 | 变更类型 | 影响范围 | 变更描述 | 测试状态 | 上线状态 |
|---|---|---|---|---|---|
| CR-20261028-01 | feat | `src/utils/chunkRecovery.ts`、`src/main.ts` | 懒加载 chunk 失败时整页重载到本次导航目标地址，一次会话同一地址只刷一次 | 已通过 | 待上线 |
| CR-20261028-02 | chore | `.github/workflows/deploy-frontend.yml`、`.github/workflows/deploy-frontend-test.yml` | 长缓存只给 hash 产物、`index.html` 每次回源、CDN 刷新失败即红、部署后自检入口 hash | 已通过（测试环境首跑成功） | 待上线 |
| CR-20261028-03 | feat | `vite.config.ts`、`env.d.ts`、`src/utils/buildStamp.ts`、`src/components/common/BuildStamp.vue`、`src/App.vue`、`vitest.config.ts` | 构建号注入 + 页脚可见 + `index.html` 的 `build-id` meta | 已通过 | 待上线 |
| CR-20261028-04 | docs | `docs/maintenance/release-freshness-plan.md`、`tasks/nightly-tasks.md` | 方案落库（含执行记录与两条方案自我修正）、台账补「发布新鲜度」父功能 | 不适用 | 待上线 |

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
