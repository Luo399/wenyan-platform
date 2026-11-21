# E2E 测试体系设计文档

> 日期：2026-11-21
> 状态：已设计，待实现（brainstorming 完成，调用 writing-plans 转实施）

## Section 0：背景与目标

### 现状
- **前端测试**：Vitest + @vue/test-utils + happy-dom，49 个 spec 文件，覆盖 views(9) / components(10) / composables(6) / unit(8) / utils(7) / adapters(2) / services(1) / stores(1) / integration(1)。后端 30 个 Jest 测试。Figma 插件 1 个。
- **CI**：`ci-checks.yml` 跑 Vitest + coverage gate + backend Jest + 多个质量门禁。**没有 Playwright / Cypress 这类 E2E 框架**。
- **部署闭环**：deploy workflow 有 fingerprint 轮询（12 次、每次 10 秒），确认 OSS 上的 index.html 指向本次构建。

### Vitest 的能力边界（为什么还需要 E2E）
| Vitest 能测 | Vitest 测不到 |
|-------------|-------------|
| 组件内部 state/emit 变化 | 真实浏览器地址栏 URL 变更 |
| `router.push` 参数是否正确 | Vue Router `beforeEach` 守卫真的触发 + 完整重定向链路 |
| `isRoleAllowed()` 纯函数逻辑 | 真实 token 过期后的 auto-logout（localStorage 清除 + 页面跳转） |
| `:pathMatch(.*)*` 路由表配置 | 真实浏览器访问不存在路径时是否真的渲染 NotFoundView（还是 Nginx/OSS 先返回了自己的 404） |
| `sanitizeRedirect()` 纯函数 | 带特殊字符的 redirect 参数在真实浏览器 URL 编码/解码链路中是否正确 |
| `router.push('/rules/1')` mock 调用 | 完整登录→redirect→跳回原目标的闭环 |

### 目标
1. **框架搭建**：引入 Playwright，配置 `baseURL: test.classicalab.cn` + `ignoreHTTPSErrors: true`，本地和 CI 都能跑
2. **首批场景覆盖**：3 个 spec 文件、约 10 个 test case——路由守卫 + 鉴权流、404 路由兜底、登录 + redirect 闭环
3. **CI 集成**：挂在 deploy workflow 完成后自动触发 E2E，和 fingerprint 轮询天然对齐
4. **后续扩展**：学习流程导航（渐进解锁 DOM visible 切换、跨路由导航链路）、生产环境冒烟

### 不做什么（YAGNI）
- 不接 Cypress（iframe 沙箱对 auth/localStorage 行为不友好）
- 不进 PR 阶段的 `ci-checks.yml`（PR 跑 E2E 时序不对，Vitets 已够覆盖逻辑）
- 不做 Playwright parallel mode（首批 10 个 case 单进程 3min 内完成，parallel 带来额外 fixture 共享复杂度）
- 不碰完整学习流程（交互复杂、渐进解锁 DOM visible 切换需要单独拆解）

---

## Section 1：目录结构 + 配置

### 目录
```
playwright/
├── playwright.config.ts         # 配置：baseURL、ignoreHTTPSErrors、browsers、retries
├── e2e/
│   ├── auth.spec.ts             # 路由守卫 + 鉴权流（A1-A4）
│   ├── 404.spec.ts              # 路由兜底（F1-F3）
│   ├── login-redirect.spec.ts   # 登录 + redirect 闭环（R1-R3）
│   └── fixtures/
│       └── auth.ts              # 复用的登录 fixture：走 API 拿 JWT 存 localStorage
```

### 配置（playwright.config.ts）
```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './playwright/e2e',
  timeout: 30_000,

  use: {
    baseURL: 'https://test.classicalab.cn',
    ignoreHTTPSErrors: true,    // 测试环境证书无效（ERR_CERT_COMMON_NAME_INVALID）
    trace: 'on-first-retry',    // 失败重试时自动抓 trace，便于调试
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // 首批只跑 Chromium，WebKit/Firefox 后续扩展
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // 本地/CI 统一命令
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
})
```

### package.json 新增 scripts
```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:install": "playwright install chromium",
    "e2e:ui": "playwright test --ui",
    "e2e:codegen": "playwright codegen https://test.classicalab.cn"
  }
}
```

---

## Section 2：测试用例设计

### Fixture：走后端 API 拿 JWT
直接调 `POST /api/auth/student/login`（测试环境 test-api.classicalab.cn）拿 token，比 UI 登录快且稳——因为 UI 登录本身就是一个完整交互，我们只需要 localStorage 里有 valid JWT 来测守卫链路。

```ts
// playwright/e2e/fixtures/auth.ts（骨架）

// 构造 expired JWT（用于 A3 token 过期登出测试）
// authStore.isTokenExpired() 解 exp 字段判断，不验签名，所以随便编 header/payload 都能被正确识别
function makeExpiredJwt(): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  // exp 设为当前时间 - 1h → 明确过期
  const payload = b64url({ exp: Math.floor(Date.now() / 1000) - 3600 })
  return `${header}.${payload}.fake-sign`
}

// 构造 valid JWT（用于 A1/A2/A4/F3/R1/R3 已登录态测试）
// 两种来源：
//   1. 优先走后端 /api/auth/student/login（真实校验成功）
//   2. 后端不可用时 fallback：直接编 JWT（只要 exp > now 就能被 authStore 接受）
function makeValidJwt(studentId: string): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({
    sub: studentId,
    role: 'student',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })
  return `${header}.${payload}.fake-sign`
}

// 主入口：走后端 API 拿真实 JWT，fallback 用编的
export async function loginAsStudent(page, studentId = '2024001', password = 'valid-password') {
  let jwt: string
  try {
    const res = await page.request.post('https://test-api.classicalab.cn/api/auth/student/login', {
      data: { studentId, password },
      timeout: 5000,
    })
    const envelope = await res.json()
    if (!envelope.success) throw new Error(`登录失败: ${envelope.message}`)
    jwt = envelope.data.token
  } catch (e) {
    // 后端不可用时 fallback：authStore 只验 exp 不验签名
    console.warn('后端 API 不可用，fallback 编 JWT:', e)
    jwt = makeValidJwt(studentId)
  }

  await page.addInitScript(
    ({ jwt, user }) => {
      localStorage.setItem('auth_token', jwt)
      localStorage.setItem('auth_user', JSON.stringify(user))
    },
    { jwt, user: { studentId, role: 'student' } },
  )
}

// 构造"过期 token 存 localStorage"（A3 专用）
export async function setExpiredToken(page) {
  const expiredJwt = makeExpiredJwt()
  await page.addInitScript(token => { localStorage.setItem('auth_token', token) }, expiredJwt)
}
```

---

### 2.1 `auth.spec.ts` — 路由守卫 + 鉴权流

| # | 测试用例 | Vitest 已有覆盖 | E2E 增量价值 |
|---|---------|----------------|-------------|
| A1 | 未登录访问 `/rules/1` → 浏览器地址栏变成 `/student-login?redirect=/rules/1` | `routerGuards.spec.ts` 只 `vi.mock` 了 `router.push` 调用参数 | **真实地址栏 URL 变更**、beforeEach 守卫真的触发、redirect 参数真的进了 URL |
| A2 | 已登录（localStorage 有 valid JWT）访问 `/rules/1` → 正常渲染规则介绍页（video 元素存在） | Vitest mount 组件后 set authStore.isLoggedIn = true | **真实 DOM 渲染**、Vue Router pathMatch 不拦截、组件真的 mount |
| A3 | token 过期访问 `/rules/1` → 自动登出（localStorage 被清）+ 重定向登录页 | Vitest `authStore.isTokenExpired()` 纯函数测试 | **localStorage token 被真的清掉**、authStore.logout() 副作用真的执行、浏览器状态真的干净 |
| A4 | 学生访问 `/admin-console` → 回首页（角色门禁） | Vitest `isRoleAllowed()` 纯函数 + 路由表 meta 检查 | **真实守卫链路**：requiresAuth 先通过 → role 检查触发 → beforeEach 真的 `next({ path: '/' })` |

**骨架示例（A1）**：
```ts
test('A1: 未登录访问 /rules/1 → 重定向到 /student-login?redirect=/rules/1', async ({ page }) => {
  // 清空 localStorage，确保未登录态
  await page.context().clearCookies()
  await page.addInitScript(() => { localStorage.clear() })

  await page.goto('/rules/1')
  // 等守卫执行完跳转
  await page.waitForURL(/\/student-login\?redirect=/)

  const url = page.url()
  expect(url).toContain('/student-login')
  expect(new URL(url).searchParams.get('redirect')).toBe('/rules/1')
})
```

---

### 2.2 `404.spec.ts` — 路由兜底

| # | 测试用例 | Vitest 已有覆盖 | E2E 增量价值 |
|---|---------|----------------|-------------|
| F1 | 访问 `/foo-bar-baz` → 渲染 NotFoundView（h1 显示 "404"） | NotFoundView.spec.ts 只 mount 组件检查 h1 文本 | **真实路由兜底**：`:pathMatch(.*)*` 是否真的触发，还是 Nginx/OSS 先返回了自己的 404 |
| F2 | 404 页面点击「返回首页」→ 地址栏变成 `/` 且渲染 home 组件 | NotFoundView.spec.ts 测了 `goHome` 被 mock 调用 | **真实跳转**：浏览器地址栏真变、NewHomeView 真 mount |
| F3 | 已登录状态访问 `/foo-bar-baz` → 仍走 404 兜底（不被守卫拦截） | Vitest 路由表检查 pathMatch 兜底不挂 requiresAuth | **真实守卫链路**：pathMatch 在最底部、requiresAuth 不挂 → 已登录也能进 404 |

**骨架示例（F1 + F2）**：
```ts
test('F1: 访问不存在路径 → 渲染 NotFoundView', async ({ page }) => {
  await page.goto('/foo-bar-baz')
  await expect(page.locator('h1')).toHaveText('404')
  await expect(page.locator('.message')).toContainText('页面未找到')
})

test('F2: 点击「返回首页」→ 跳转 home', async ({ page }) => {
  await page.goto('/foo-bar-baz')
  await page.getByRole('button', { name: /返回首页/ }).click()
  await page.waitForURL('/')
  // NewHomeView 的特征：pageRegistry 注册的第一个篇目入口存在
  await expect(page.locator('.article-list')).toBeVisible()
})
```

---

### 2.3 `login-redirect.spec.ts` — 登录 + redirect 闭环

| # | 测试用例 | Vitest 已有覆盖 | E2E 增量价值 |
|---|---------|----------------|-------------|
| R1 | 直接访问 `/rules/1` → 被踢到 `/student-login?redirect=/rules/1` → **UI 登录** → 跳回 `/rules/1` | Vitest mock 了 `router.push('/rules/1')` 和 authStore.login() | **完整闭环**：真实浏览器地址栏从被重定向 → 登录 → 跳回 |
| R2 | redirect 参数带特殊字符（如 `redirect=/rules%2F1%3Ftab%3Ddetail`）→ 重定向后登录成功仍能正确解码 | Vitest `sanitizeRedirect()` 纯函数测试 | **真实浏览器 URL 编码/解码**：`?redirect=%2Frules%2F1` → 登录后应正确解析回 `/rules/1` |
| R3 | 登录页无 redirect 参数（直接访问 `/student-login`）→ 登录成功去默认目标 | Vitest mock 默认跳转 `/rules/1` | **真实默认行为**：authStore.login() 内部的 `router.push` 是否真的执行 |

**骨架示例（R1 — 这是最有价值的 case）**：
```ts
test('R1: 完整登录 + redirect 闭环', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => { localStorage.clear() })

  // 1. 直接访问受保护页面
  await page.goto('/rules/1')
  await page.waitForURL(/\/student-login\?redirect=/)

  // 2. UI 登录
  await page.locator('#studentId').fill('2024001')
  await page.locator('#password').fill('valid-password')
  await page.locator('form').submit()

  // 3. 等跳回原目标
  await page.waitForURL('/rules/1')
  // 验证 localStorage 真存了 token
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  expect(token).toBeTruthy()
})
```

---

## Section 3：CI 集成 + 运行模型

### 新增 workflow：`.github/workflows/e2e-test.yml`

**触发条件**：用 `workflow_run` 监听 deploy workflow 完成（而不是在 deploy yml 里加 `needs`）——因为前端 deploy 和后端 deploy 是两个独立 yml 文件，没有共同触发条件，没法互相 needs。

```yaml
name: E2E Test (Playwright)

on:
  workflow_run:
    workflows:
      - Deploy Frontend to Test OSS
      - Deploy Backend to Test Server
      - Deploy Frontend to Aliyun OSS
      - Deploy Backend to Aliyun Server
    types:
      - completed
  workflow_dispatch:  # 允许手动触发调试

jobs:
  e2e-test:
    # 只有当被监听的 workflow 是 success 时才跑
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci  # CI 环境有 package-lock.json，比 npm install 快

      - name: Install Playwright Chromium
        run: npx playwright install chromium

      - name: Determine base URL
        id: env
        run: |
          # 根据触发的 workflow 判断跑测试还是生产
          if [[ "${{ github.event.workflow_run.name }}" == *"Test"* ]]; then
            echo "base_url=https://test.classicalab.cn" >> "$GITHUB_OUTPUT"
            echo "api_url=https://test-api.classicalab.cn" >> "$GITHUB_OUTPUT"
          else
            echo "base_url=https://www.classicalab.cn" >> "$GITHUB_OUTPUT"
            echo "api_url=https://api.classicalab.cn" >> "$GITHUB_OUTPUT"
          fi

      - name: Run E2E tests
        run: npx playwright test
        env:
          PLAYWRIGHT_BASE_URL: ${{ steps.env.outputs.base_url }}
          PLAYWRIGHT_API_URL: ${{ steps.env.outputs.api_url }}

      - name: Upload Playwright artifacts (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-artifacts
          path: |
            test-results/
            playwright-report/
          retention-days: 7
```

### 运行模型

| 场景 | 命令 | 说明 |
|------|------|------|
| 本地首次安装浏览器 | `npx playwright install chromium` | 下载 ~150MB，一次安装永久使用 |
| 本地跑全部 | `npm run e2e` | 默认 against test.classicalab.cn |
| 本地跑单个 spec | `npx playwright test playwright/e2e/auth.spec.ts` | 可加 `--grep "A1"` 跑单个 case |
| 本地 UI 调试 | `npm run e2e:ui` | Playwright Inspector，可步进暂停 |
| 本地录制 | `npm run e2e:codegen` | 打开浏览器自动生成 test 代码 |
| CI 自动 | deploy 完成后触发 `e2e-test.yml` | 约 3min（装 chromium ~2min + 跑测试 ~1min） |
| CI 手动 | GitHub Actions → e2e-test.yml → Run workflow | 调试用 |

### 和现有 CI 的关系

```
CI 流水线时序：
  PR / 推送 trae/agent-*
    → ci-checks.yml（Vitest + Jest + coverage gate + quality check）✅

  推送 feature-1
    → ci-checks.yml ✅
    → deploy-frontend-test.yml（fingerprint 轮询 12 次）✅
    → deploy-backend-test.yml ✅
    → workflow_run 监听两者都 success
      → e2e-test.yml（Playwright against test env）✅

  推送 main
    → ci-checks.yml ✅
    → deploy-frontend.yml ✅
    → deploy-backend.yml ✅
    → workflow_run → e2e-test.yml（against prod env）
```

**关键设计决策**：
- **E2E 失败不阻塞 deploy**：E2E 是"部署后验证"不是门禁——fingerprint 轮询已确保 OSS 正确，E2E 额外验证浏览器行为。失败后手动看 trace 修复即可。
- **CI 不跑 parallel**：首批 10 个 case 单进程 1min 内完成，parallel 带来 fixture 共享复杂度不值得。

---

## Section 4：实施路线图（TDD 方式）

按 TDD "先写测试 → 看它 fail → 写最小代码让它过" 的原则，**Playwright E2E 测试的"实现"部分其实不是改生产代码，而是改测试环境**（fixture 登录、baseURL、CI 配置）。但仍要保持 TDD 精神：

### Phase 1：框架搭建（~30min）
1. **RED**：新建 `playwright.config.ts`，跑 `npx playwright test` → 失败（没有测试文件）
2. **GREEN**：写一个最小 test case（比如 F1 404 兜底）→ 跑 against test env → 成功
3. **REFACTOR**：补全 fixtures、配置、package.json scripts

### Phase 2：首批三个 spec（约 2h）
每个 spec 都走完整 TDD 循环：
1. 写 fixture（登录拿 JWT）
2. 写一个 test case
3. **RED**：跑起来看它 fail（比如 test env 还没部署 → `ERR_CONNECTION_REFUSED`；或者 redirect 参数解码不对 → 得到 `/rules/1%3Ftab...` 而不是 `/rules/1`）
4. **诊断**：Vitest 覆盖的逻辑不应该是问题（那 Vitest 早就红了）；E2E fail 大概率是真实浏览器环境特有的问题（路径、编码、token 过期时机）
5. **最小修复**：改 fixture 或 baseURL 配置
6. **GREEN**：跑通

### Phase 3：CI 集成（~1h）
1. 写 `.github/workflows/e2e-test.yml`
2. 推到 feature-1，等 deploy workflow 完成 → e2e-test.yml 自动触发
3. 如果 E2E fail → 看 trace artifact → 修复 → 重推

### 风险缓解

| 风险 | 缓解方案 |
|------|---------|
| test env 后端 API 不可用（服务器挂了） | fixture 有 fallback：API 调不通时用硬编码 fake JWT（exp 字段当前时间 + 1h），localStorage.setItem 直接存——守卫的 isTokenExpired() 只解 exp 字段，不验签名 |
| 测试账号被他人改密码 | fixture 里用独立测试账号（studentId: '2024001' / password: 'valid-password'），后端保持这个账号密码不变；或用 admin 直接发 JWT 的接口（需要后端加一个 /api/auth/issue-jwt 给测试用） |
| Playwright CI 安装慢 | 用 `--with-deps` 让 CI 自动装系统依赖（Ubuntu 上 chromium 需要 libnss3/libxss1 等）；或 `microsoft/playwright-github-action@v1` 一键装 |
| E2E 失败无法复现 | `trace: 'on-first-retry'` + `screenshot: 'only-on-failure'` + `video: 'retain-on-failure'` 三件套，CI artifact 自动上传 |

---

## Section 5：后续扩展

| 优先级 | 场景 | 说明 |
|--------|------|------|
| P2 | 完整学习流程导航 | 渐进解锁 DOM visible 切换、跨路由导航链路、scrollBehavior 回到顶部——交互复杂，需要单独拆解 |
| P3 | 生产环境冒烟 | main 部署后 against classicalab.cn 跑一小组关键路径 E2E |
| P3 | teacher/admin 角色流 | 教师登录 → 查看学生列表 → 查询答题数据 → 下载 CSV |
| P3 | WebKit / Firefox | 多引擎覆盖，确认 cross-browser 行为 |
| P4 | MSW（如果 API 有抖动） | 用 `page.route()` 拦截 API 返回假数据，让 E2E 能不依赖真实后端 |

---

## 附录：技术栈清单

| 组件 | 版本 | 说明 |
|------|------|------|
| @playwright/test | ^1.50 | 官方 E2E 框架 |
| playwright | ^1.50 | 二进制和 CLI |
| chromium | 随 playwright | 首批唯一引擎 |
| baseURL | test.classicalab.cn | 可通过 PLAYWRIGHT_BASE_URL 覆盖 |
| API URL | test-api.classicalab.cn | fixture 登录用 |
| ignoreHTTPSErrors | true | 测试环境证书无效 |
| 超时 | 30s per test | 足够浏览器渲染 + 网络请求 |
