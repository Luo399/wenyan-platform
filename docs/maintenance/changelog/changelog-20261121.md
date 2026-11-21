# 变更记录 changelog-20261121

> 记录时间：2026-11-21
> 实施人：Trae 夜间开发代理
> 集成分支：feature-1（远端 https://github.com/Luo399/wenyan-platform.git）
> 说明：本批次为夜间五项任务的复核 + 缺口修复批次。五项功能在 2026-10-01/10-02 已落地并合并；本次逐条对照 `tasks/nightly-tasks.md` 的验收口径复核，
> 修掉 1 个真实缺陷（导航挂死兜底判断写反），补齐完成情况页的状态组件、适配层与单测，并补管理员账密服务的契约测试。
> 未启动本地服务、未部署、未 SSH、未读取或修改真实 `.env`。

## 一、五项任务复核结论

| 编号 | 任务 | 开发分支 | 提交 | 分支 CI | 合并结果 | 结论 |
|-----|------|---------|------|--------|---------|------|
| R101 | 「继续」按钮跨浏览器延迟优化（<0.5s） | `trae/agent-101-nav-latency` + 本轮 `trae/agent-107-nav-fallback-fix` | `e6e1cc6` + `dcf8738` | success（`36794305111` / `44913063424`） | 已合并（`a2a2764` / `2cb0b23`） | 通过，本轮修掉兜底方向缺陷 |
| R102 | 测试账密 `99999999` 学生登录失败修复 | `trae/agent-102-student-login-fix` | `d68986c` | success | 已合并（`c108f03`） | 通过，四处根因均已落地 |
| R103 | 管理员教师/学生账密增删查改 | `trae/agent-103-admin-accounts` | `dd3ace8` | success | 已合并（`176dc7d`） | 通过，本轮补 12 例服务契约测试 |
| R104 | 教师删除本班学生账号 | `trae/agent-104-teacher-student-crud` | `686aef0` | success | 已合并（`a7b7dba`） | 通过，403 越权用例在 |
| R105 | 教师查看学生完成情况（框架 + 页面） | `trae/agent-105-teacher-completion` + 本轮 `trae/agent-108-progress-view-base` | `27dc6c7` + `8f5c9d1` | success（`44913928879`） | 已合并（`c510f9a` / `62244ad`） | 通过，本轮补 Base 三态与适配层 |

## 二、本批代码变更明细

### R107 导航挂死兜底判断方向修复

| 字段 | 内容 |
|-----|------|
| 变更编号 | R107 |
| 变更类型 | fix |
| 变更描述 | `src/composables/useNavigation.ts` 的 `stuckTimer` 写成 `if (isAlreadyAt(path))`，方向反了：`router.push` 挂死时地址并不在目标页，条件恒假 → `NAV_STUCK_FALLBACK_MS`（8000ms）兜底永远不触发，连点被 `navigationInFlight` 永久锁死；而 push 已生效、只是 Promise 收尾晚到时，反而会多做一次整页跳转，打掉 SPA 状态。改为 `if (!isAlreadyAt(path))` 并补充说明 |
| 变更时间 | 2026-11-21 |
| 影响范围 | `src/composables/useNavigation.ts`、`tests/composables/useNavigation.spec.ts`（+2 例：超时兜底触发 / 已到目标不兜底） |
| 测试状态 | `useNavigation.spec.ts` 33/33 通过；分支 `CI Checks` success |
| 上线状态 | 已合并 `feature-1`，随下一次 `feature-1 → main` 人工审批 PR 上线 |

### R108 完成情况页状态组件与数据适配层

| 字段 | 内容 |
|-----|------|
| 变更编号 | R108 |
| 变更类型 | feat/refactor |
| 变更描述 | ①`src/views/TeacherCompletionView.vue` 的加载 / 空 / 错误三态改用 `common/BaseLoader、BaseEmpty、BaseError`（错误态可重试），删除手写 `.error-tip/.plain-btn/.empty-cell`；②新增 `src/adapters/completionAdapter.ts`，把 `GET /api/teacher/completion/students` 的原始响应归一化为稳定结构（缺字段、字符串数字、非数组入参都有安全默认值，`metrics_ready` 只在明确 `true` 时为真）；③`services/teacherCompletionService.ts` 请求后先适配再返回，组件内无裸 `fetch` |
| 变更时间 | 2026-11-21 |
| 影响范围 | `src/adapters/completionAdapter.ts`（新增）、`src/services/teacherCompletionService.ts`、`src/views/TeacherCompletionView.vue`、`tests/adapters/completionAdapter.spec.ts`（9 例）、`tests/views/TeacherCompletionView.spec.ts`（6 例） |
| 测试状态 | 新增 15 例全通过；`vue-tsc --build tsconfig.app.json` 0 错误；分支 `CI Checks` success |
| 上线状态 | 已合并 `feature-1`，随下一次 `feature-1 → main` 人工审批 PR 上线 |

### R109 管理员账密服务契约测试

| 字段 | 内容 |
|-----|------|
| 变更编号 | R109 |
| 变更类型 | test |
| 变更描述 | 新增 `tests/services/adminService.spec.ts` 12 例，锁定教师/学生账密的列表、单个查询、新增、更新、删除、重置口令所对应的 HTTP 方法与路径；覆盖「查询失败抛 `ApiError`」「写操作 `success:false` 转失败结果」「重置口令缺口令判失败」三条错误分支 |
| 变更时间 | 2026-11-21 |
| 影响范围 | `tests/services/adminService.spec.ts`（新增） |
| 测试状态 | 12/12 通过；`oxlint` 0 warning / `eslint` 0 error |
| 上线状态 | 纯测试，随 `feature-1` 集成 |

### R110 台账与变更记录

| 字段 | 内容 |
|-----|------|
| 变更编号 | R110 |
| 变更类型 | docs |
| 变更描述 | 勾选 `tasks/nightly-tasks.md` 五个父功能及其子功能，逐条补「分支 / commit / CI」；把 `ci-circular-check-alias-blind` 标记为已闭合（`scripts/check-circular.mjs` 已解析 `tsconfig.app.json` 的别名，CI 直接从该脚本判红）；新增本变更记录 |
| 影响范围 | `tasks/nightly-tasks.md`、`docs/maintenance/changelog/changelog-20261121.md` |
| 测试状态 | 不涉及（文档） |

## 三、分支与合并路径

| 分支 | 提交 | 合并提交 | 说明 |
|-----|------|---------|------|
| `trae/agent-107-nav-fallback-fix` | `dcf8738` | `2cb0b23` | 从 `feature-1`@`ac38b48` 拉出，`--no-ff` 合并 |
| `feature-1`（同步） | — | `99eae24` | 合并期间远端已有 21 个 E2E/重构提交，先合并 `origin/feature-1` 再推送，无冲突 |
| `trae/agent-108-progress-view-base` | `8f5c9d1` | `62244ad` | 从 `feature-1`@`99eae24` 拉出，`--no-ff` 合并 |
| `trae/agent-109-nightly-ledger` | 本记录所在提交 | 由合并提交记录 | 台账 + 本记录 + R109 测试，`--no-ff` 合并 |

推送通道：本机 `github.com:443` 直连被阻断，全部 push / fetch 走
`git -c url."ssh://git@ssh.github.com:443/".insteadOf="https://github.com/"`；远端查询与 CI 轮询走 `gh`。
未推送 `main`，未创建 `feature-1 → main` 的 PR。

## 四、静态检查与 Actions 结果

- 前端单测（本机，便携 Node + 现有 `node_modules`，`--environment jsdom` 替代缺失的 happy-dom）：
  `useNavigation.spec.ts` 33/33、`completionAdapter.spec.ts` 9/9、`TeacherCompletionView.spec.ts` 6/6、`adminService.spec.ts` 12/12。
- 类型检查：`npx vue-tsc --build tsconfig.app.json` → 0 错误。全量 `vue-tsc --build` 本机在
  `playwright.config.ts(1,39): Cannot find module '@playwright/test'` 处失败——该文件是上游同一晚新增的 E2E 配置，
  本机 `node_modules` 未随 `package.json` 更新，属环境不同步，不是本批代码问题；CI 的 `quality-check` 通过。
- Lint：改动文件 `oxlint` 0 warning / 0 error，`eslint` 0 error（均不带 `--fix`）。
- 后端定向测试：本机 Windows 仍复现 `beforeAll` 5s hook 超时（2026-11-08 已记录的 sqlite 初始化性能问题，非用例失败）；
  同一提交的 `backend-check` 在 CI 为 success。
- Actions：
  - `44913063424` 分支 107 `CI Checks` · success
  - `44913354345` `feature-1`@`99eae24` `CI Checks` · success（secret-scan / pipeline-test / Figma Transformer / figma-plugin / circular / quality / backend 七 job 全绿）
  - `44913354291` `Deploy Frontend to Test OSS` · success；`44913427678` `E2E Test (Playwright)` · success
  - `44913354311` 同一提交的 push 触发 E2E · cancelled（被 `workflow_run` 触发的同提交 E2E 以 concurrency 取代，非失败）
  - `44913928879` 分支 108 `CI Checks` · success
  - `44914094463` `feature-1`@`62244ad` `CI Checks` · success；`44914094456` 测试前端部署 · success；
    `44914094482` / `44914207972` E2E · success
  - `44915624671` 台账合并 `b4c0e8f` 的 `E2E Test (Playwright)` · success。该提交只改 `tests/**`、`docs/**`、`tasks/**`，
    `CI Checks` 的 `on.push.paths` 未包含这三类路径，因此未触发（不是跳过失败）；R109 的 12 例以本机运行结果为准。

## 五、未完成与阻塞项

- **未上生产**：按规则未创建 `feature-1 → main` 的 PR；上线需人工审批。
- **前端页面级单测仍缺**：`AdminConsoleView.vue`、`AnswerQueryView.vue` 仍无独立组件测试，
  本轮以 `adminService`（12 例）锁请求契约、以后端 `admin-accounts`（32 例）锁服务端行为；页面交互测试留待后续。
- **Dependabot 18 个 PR**（`dependabot-triage`）需人工判断，尤其 major 升级；本轮未合任何依赖 PR。
- **生产 PM2 Node 版本**（`prod-pm2-node-version-unverified`）、**生产 `.env` 缺 `DASHBOARD_PASSWORD` / `DEEPSEEK_API_KEY`**
  （`prod-missing-optional-keys`）、**`environment: production` 缺 Required reviewers** 均需人工在服务器 / GitHub 设置侧处理，本轮无 SSH、不改云端配置。
- `release-freshness` 父功能在台账中仍未勾选（其 4 个子功能均已完成并上线），本轮未擅自改动——是否补勾由你确认。
