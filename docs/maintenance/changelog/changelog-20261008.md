# 变更记录 2026-10-08

> 依据 `rules/maintenance_standards.md` 4.5.1 / 4.5.3 生成；保存位置 `docs/maintenance/changelog/`，命名 `changelog-YYYYMMDD.md`。
>
> 本次变更聚焦「登录已过期，请重新登录」相关会话缺陷，根因分析见 [`docs/网页故障说明清单.md`](../../网页故障说明清单.md) F-001 ~ F-005。
> 环境限制：本次**无推送凭证**，所有分支与合并均在本地完成，**未触发 CI**，改用与 CI 等价的本地校验为准。

| 变更编号 | 变更类型 | 影响范围 | 变更描述 | 测试状态 | 上线状态 |
|---|---|---|---|---|---|
| CR-20261008-01 | docs | `docs/网页故障说明清单.md`、`tasks/nightly-tasks.md` | 新增网页故障说明清单（F-001~F-006，含登录过期根因链路与本机离线实测），并把登录过期修复挂入任务清单 | 不适用 | 待上线 |
| CR-20261008-02 | fix | `src/utils/api.ts`、`tests/unit/apiAuth401.spec.ts` | 401 语义分流：凭证错误 `INVALID_CREDENTIALS` 原样透传后端消息，不再伪装成「登录已过期」 | 已通过 | 待上线 |
| CR-20261008-03 | fix | `backend/src/config/app.js`、`backend/src/utils/duration.js`、`backend/src/controllers/authController.js`、`backend/src/routes/index.js`、`backend/.env.example`、`src/stores/auth.ts`、`src/router/guards.ts` | `JWT_EXPIRES_IN` 支持单位写法且非法值启动即报错；新增 `/api/auth/refresh` 并接入路由守卫自动续期 | 已通过 | 待上线 |
| CR-20261008-04 | fix | `src/utils/api.ts`、`tests/unit/apiAuthHeader.spec.ts` | 容器未就绪时回退到持久化登录态构造鉴权头；区分「未登录」与「会话过期」提示 | 已通过 | 待上线 |

## 变更明细

### CR-20261008-01 网页故障说明清单与任务登记

- **变更类型**：docs（文档）
- **变更时间**：2026-10-08
- **影响范围**：`docs/网页故障说明清单.md`（新增）、`tasks/nightly-tasks.md`（新增父功能 `auth-session-expiry`）
- **变更描述**：
  - 新增 `docs/网页故障说明清单.md`，按 P0~P3 分级登记 F-001 ~ F-006 六条故障，逐条给出「现象 → 根因链路 → 代码位置 → 修复建议」。
  - 收录任务 2 的排查结论：令牌有效期默认 3600s、无自动续期、前端把所有 401 统一映射为 `AUTH_EXPIRED`。
  - 收录任务 4 的环境实测：本机为整机断电离线（伴随 Kernel-Power 41），非空闲休眠；工作日约 06:30-07:15 恢复在线。
- **测试状态**：不适用（纯文档）
- **上线状态**：待上线

### CR-20261008-02 401 语义分流（F-002）

- **变更类型**：fix（缺陷修复）
- **变更时间**：2026-10-08
- **分支**：`feature/auth-session-expiry/auth-error-mapping`，commit `bba94b6`
- **影响范围**：`src/utils/api.ts`（`handleResponse`）、`tests/unit/apiAuth401.spec.ts`（新增）
- **变更描述**：
  - 后端登录接口用 `401 + INVALID_CREDENTIALS` 表示「学号或密码错误」，与会话过期共用 401 状态码。
  - 原实现把所有 401 一律改写成「登录已过期，请重新登录」，导致密码输错时提示误导（本次「学生登录失败」排查即由此产生）。
  - 现按 `error` 字段分流：`INVALID_CREDENTIALS` 原样透传后端消息且不触发登出；其余 401 才判定为会话问题。
- **测试状态**：已通过（`tests/unit/apiAuth401.spec.ts` 4 项；`npm run type-check` 通过）
- **上线状态**：待上线

### CR-20261008-03 令牌有效期与自动续期（F-001 / F-003 / F-004）

- **变更类型**：fix（缺陷修复）
- **变更时间**：2026-10-08
- **分支**：`feature/auth-session-expiry/token-refresh-lifecycle`，commit `3f1ef4e`
- **影响范围**：`backend/src/config/app.js`、`backend/src/utils/duration.js`（新增）、`backend/src/controllers/authController.js`、`backend/src/routes/index.js`、`backend/.env.example`、`src/stores/auth.ts`、`src/router/guards.ts`
- **变更描述**：
  - **F-003**：新增 `parseDuration()`，`JWT_EXPIRES_IN` 支持 `3600` / `60s` / `30m` / `12h` / `7d`；非法值**启动即抛错**，不再像 `Number('7d') → NaN` 那样静默回退。
  - **F-004**：后端新增 `POST /api/auth/refresh`（`requireAuthMiddleware` 保护，并重新校验账号存在/启用，禁止仅凭旧 token 原样重签）；前端新增 `isTokenExpiringSoon()`，路由守卫在剩余寿命不足 5 分钟时自动续期。
  - 前端 `refreshToken()` 失败不再直接登出——避免一次网络抖动把仍有效的会话踢掉，改由 `isTokenExpired()` 兜底。
  - **F-001**：有效期改为可配置，`backend/.env.example` 建议值调整为 `12h`。**注意：生产环境需在服务器 `.env` 显式设置 `JWT_EXPIRES_IN` 才生效。**
- **测试状态**：已通过（`backend/tests/duration.test.js`、`backend/tests/auth-refresh.test.js`、`tests/unit/authTokenRefresh.spec.ts`；后端 10 套件 / 130 项全绿；`npm run type-check`、`node -c server.js` 通过）
- **上线状态**：待上线

### CR-20261008-04 初始化竞态鉴权头兜底（F-005）

- **变更类型**：fix（缺陷修复）
- **变更时间**：2026-10-08
- **分支**：`feature/auth-session-expiry/auth-header-race`，commit `4a6f06f`
- **影响范围**：`src/utils/api.ts`（`getAuthHeaders`、401 提示）、`tests/unit/apiAuthHeader.spec.ts`（新增）
- **变更描述**：
  - 原 `getAuthHeaders()` 在 Pinia 未安装或 store 未水合时静默返回空对象，请求不带 `Authorization`，后端按 `AUTH_REQUIRED` 拒绝后又显示成「登录已过期」。
  - 现回退到 `utils/localStorage` 的 `getAuthData()`（R34 统一封装），保证竞态窗口内也带上鉴权头。
  - `AUTH_REQUIRED`（完全没带令牌）与 `AUTH_FAILED`（令牌无效/过期）提示分开：前者提示「需要登录」，后者保留「登录已过期，请重新登录」。
- **测试状态**：已通过（`tests/unit/apiAuthHeader.spec.ts` 4 项；`npm run type-check` 通过）
- **上线状态**：待上线

## 合并记录

| 层级 | 分支 | 结果 |
|---|---|---|
| 子 → 父 | `auth-error-mapping` → `feature/auth-session-expiry/main` | `--no-ff`，merge `63062ef` |
| 子 → 父 | `token-refresh-lifecycle` → `feature/auth-session-expiry/main` | `--no-ff`，merge `8627a54` |
| 子 → 父 | `auth-header-race` → `feature/auth-session-expiry/main` | `--no-ff`，merge `fe65399` |
| 父 → 集成 | `feature/auth-session-expiry/main` → `feature-1` | `--no-ff`，merge `2516365` |

## 遗留与阻塞

- **缺少推送凭证**：`GITHUB_TOKEN` / `GH_TOKEN` 均未设置，本地无 `credential.helper`，故本次**未推送、未轮询 CI**。补齐凭证后需按 `.trae/rules/project-workflow.md` 重新走「推送 → 轮询 Actions 至 completed → 失败则修复重推」闭环。
- **生产配置需人工确认**：`JWT_EXPIRES_IN` 需在服务器 `.env` 显式设置为期望值（建议 `12h`），否则仍使用默认 3600s。
- **未处理的历史失败**（非本次引入）：前端 lint 约 33 个错误、前端 vitest 约 65 个失败（含 `tests/unit/api.spec.ts` 仍使用旧版 `ApiError(message, code)` 签名）；CI 不运行前端 vitest。
