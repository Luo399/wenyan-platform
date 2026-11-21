# Playwright E2E Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 wenyan-platform 前端搭建 Playwright E2E 测试框架，首批覆盖路由守卫 + 鉴权流 / 404 路由兜底 / 登录 redirect 闭环 三个场景约 10 个 test case，并集成到 CI deploy workflow 完成后自动触发。

**Architecture:** Playwright 1.50 + Chromium，baseURL 指向 `https://test.classicalab.cn`（可通过 `PLAYWRIGHT_BASE_URL` 环境变量覆盖），`ignoreHTTPSErrors: true` 跳过测试环境无效证书。测试文件放 `playwright/e2e/`，fixture 走后端 API 拿 JWT（fallback 直接编 JWT，因 authStore.isTokenExpired 只验 exp 不验签名）。CI 用 `workflow_run` 监听 deploy workflow 完成后自动触发 E2E。

**Tech Stack:** @playwright/test ^1.50, Playwright Chromium, Node.js 22, GitHub Actions workflow_run

**Reference Spec:** `docs/superpowers/specs/2026-11-21-e2e-testing-design.md`

**Workspace Notes:**
- Windows 本机：Playwright 二进制首次安装慢（~150MB），`npx playwright install chromium` 需联网
- 本机已有 Node 22 + npm，可直接跑 `npm install @playwright/test`
- 项目无本地运行环境，所有测试 against `https://test.classicalab.cn` / `https://test-api.classicalab.cn`
- `.gitignore` 需排除 `playwright/test-results/` 和 `playwright/playwright-report/`

---

## File Map

### 新增文件
```
playwright/
├── playwright.config.ts              # Playwright 配置
├── e2e/
│   ├── fixtures/
│   │   └── auth.ts                   # JWT 构造 + localStorage 注入 fixture
│   ├── auth.spec.ts                  # A1-A4 路由守卫 + 鉴权流
│   ├── 404.spec.ts                   # F1-F3 路由兜底
│   └── login-redirect.spec.ts        # R1-R3 登录 + redirect 闭环
.github/workflows/e2e-test.yml        # workflow_run 监听 deploy 触发
```

### 修改文件
```
package.json                          # 新增 @playwright/test devDep + 4 个 e2e scripts
.gitignore                            # 新增 playwright/test-results/ playwright/playwright-report/
```

---

### Task 1: 安装 Playwright + 最小配置 + 测试跑通

**Files:**
- Create: `playwright/playwright.config.ts`
- Modify: `package.json:1-52`（devDependencies + scripts）
- Modify: `.gitignore`

- [ ] **Step 1: 安装 @playwright/test**

```powershell
npm install -D @playwright/test@^1.50 playwright@^1.50
```

预期输出：`@playwright/test` 和 `playwright` 进入 devDependencies，package-lock.json 同步更新。

- [ ] **Step 2: 安装 Chromium 浏览器二进制**

```powershell
npx playwright install chromium
```

预期输出：下载 ~150MB Chromium，`playwright/.cache/ms-playwright/` 目录出现 chromium-* 文件夹。

- [ ] **Step 3: 创建 playwright.config.ts（最小骨架）**

创建文件 `playwright/playwright.config.ts`：

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './playwright/e2e',
  timeout: 30_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://test.classicalab.cn',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
})
```

- [ ] **Step 4: 在 package.json 末尾 devDependencies 前插入 scripts + devDep**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "run-p type-check \"build-only {@}\" --",
    "preview": "vite preview",
    "build-only": "vite build",
    "type-check": "vue-tsc --build",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "run-s lint:oxlint lint:eslint",
    "lint:oxlint": "oxlint . --fix",
    "lint:eslint": "eslint . --fix --cache",
    "lint:ci": "oxlint . && eslint . --cache",
    "format": "prettier --write --experimental-cli src/",
    "e2e": "playwright test",
    "e2e:install": "playwright install chromium",
    "e2e:ui": "playwright test --ui",
    "e2e:codegen": "playwright codegen https://test.classicalab.cn"
  },
  "dependencies": {
    "pinia": "^3.0.4",
    "vue": "^3.5.32",
    "vue-router": "^5.0.4"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@tsconfig/node24": "^24.0.5",
    "@types/node": "^24.13.3",
    "@vitejs/plugin-vue": "^6.0.6",
    "@vitest/coverage-v8": "^5.0.5",
    "@vue/eslint-config-typescript": "^14.7.0",
    "@vue/test-utils": "^2.4.11",
    "@vue/tsconfig": "^0.9.1",
    "eslint": "^10.2.1",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-oxlint": "~1.60.0",
    "eslint-plugin-vue": "~10.8.0",
    "happy-dom": "^15.7.4",
    "jiti": "^2.6.1",
    "jsdom": "^30.1.3",
    "npm-run-all2": "^8.0.4",
    "oxlint": "~1.60.0",
    "playwright": "^1.50.0",
    "prettier": "3.8.3",
    "typescript": "~6.0.0",
    "vite": "^8.3.5",
    "vite-plugin-vue-devtools": "^8.1.1",
    "vitest": "^5.0.5",
    "vue-tsc": "^3.2.6",
    "yaml": "^2.9.0"
  },
  "engines": {
    "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
  }
}
```

- [ ] **Step 5: 在 .gitignore 末尾追加 Playwright 产物目录**

```
# Playwright
playwright/test-results/
playwright/playwright-report/
playwright/.cache/
test-results/
playwright-report/
```

- [ ] **Step 6: 验证基础配置（先跑一个不存在的目录确认错误模式）**

```powershell
npx playwright test
```

预期输出：`Error: No tests found`（因为 playwright/e2e/ 目录还不存在）——这是预期的 RED 状态。

- [ ] **Step 7: 创建最小占位测试，跑通**

创建文件 `playwright/e2e/404.spec.ts`（只放 F1 一个 case，让框架跑起来）：

```ts
import { test, expect } from '@playwright/test'

test('F1: 访问不存在路径 → 渲染 NotFoundView', async ({ page }) => {
  await page.goto('/foo-bar-baz')
  await expect(page.locator('h1')).toHaveText('404')
})
```

跑：

```powershell
npx playwright test playwright/e2e/404.spec.ts
```

预期输出：1 test passed（Chromium 打开 test.classicalab.cn/foo-bar-baz，Vue Router pathMatch 兜底渲染 NotFoundView，h1 显示 "404"）。

- [ ] **Step 8: Commit**

```powershell
git add playwright/ package.json package-lock.json .gitignore
git commit -m "feat(e2e): scaffold playwright config + minial 404 test"
```

---

### Task 2: 写 auth fixture（JWT 构造 + localStorage 注入）

**Files:**
- Create: `playwright/e2e/fixtures/auth.ts`

- [ ] **Step 1: 创建 fixtures 目录和 auth.ts**

创建文件 `playwright/e2e/fixtures/auth.ts`：

```ts
// Fixture：构造 JWT 并存 localStorage
// authStore.initialize() 解 exp 字段判断过期，不验签名——所以 fake JWT 只要 exp 正确就能被识别

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** 构造过期 JWT（exp = now - 1h） */
export function makeExpiredJwt(): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({ exp: Math.floor(Date.now() / 1000) - 3600 })
  return `${header}.${payload}.fake-sign`
}

/** 构造有效 JWT（exp = now + 1h），fallback 用——后端 API 不可用时替代 */
export function makeValidJwt(studentId: string, role: string = 'student'): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({
    sub: studentId,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })
  return `${header}.${payload}.fake-sign`
}

/** 走后端 API 拿真实 JWT；后端不可用时 fallback 编一个 */
export async function loginAsStudent(
  page: import('@playwright/test').Page,
  studentId = '2024001',
  password = 'valid-password',
): Promise<void> {
  const apiBase = process.env.PLAYWRIGHT_API_URL || 'https://test-api.classicalab.cn'
  let jwt: string

  try {
    const res = await page.request.post(`${apiBase}/api/auth/student/login`, {
      data: { studentId, password },
      timeout: 5000,
    })
    const envelope = await res.json()
    if (!envelope.success) {
      throw new Error(`登录失败: ${envelope.message}`)
    }
    jwt = envelope.data.token
  } catch (e) {
    console.warn('[fixture] 后端 API 不可用，fallback 编 JWT:', (e as Error).message)
    jwt = makeValidJwt(studentId, 'student')
  }

  await page.addInitScript(
    ({ jwt, user }) => {
      localStorage.setItem('auth_token', jwt)
      localStorage.setItem('auth_user', JSON.stringify(user))
    },
    { jwt, user: { studentId, role: 'student', username: '测试用户' } },
  )
}

/** 构造"过期 token 存 localStorage"（A3 专用） */
export async function setExpiredToken(page: import('@playwright/test').Page): Promise<void> {
  const expiredJwt = makeExpiredJwt()
  await page.addInitScript(
    ({ token }) => {
      localStorage.setItem('auth_token', token)
    },
    { token: expiredJwt },
  )
}
```

- [ ] **Step 2: 验证 fixture 编译无误**

```powershell
npx tsc --noEmit playwright/e2e/fixtures/auth.ts
```

预期输出：无错误退出（auth.ts 用的是 TypeScript 原生 btoa + Math，无外部依赖）。

- [ ] **Step 3: 在 404.spec.ts 的 F3 case 里引入 fixture 验证实际效果**

修改 `playwright/e2e/404.spec.ts`，加入已登录态验证：

```ts
import { test, expect } from '@playwright/test'
import { loginAsStudent } from './fixtures/auth'

test('F1: 访问不存在路径 → 渲染 NotFoundView', async ({ page }) => {
  await page.goto('/foo-bar-baz')
  await expect(page.locator('h1')).toHaveText('404')
})

test('F3: 已登录状态访问不存在路径 → 仍走 404 兜底', async ({ page }) => {
  await loginAsStudent(page)
  await page.goto('/foo-bar-baz')
  await expect(page.locator('h1')).toHaveText('404')
})
```

跑：

```powershell
npx playwright test playwright/e2e/404.spec.ts
```

预期输出：2 tests passed。如果 F3 fail（比如被守卫踢去登录页），说明 pathMatch 兜底被 requiresAuth 拦截了——先查 Vitest 路由表配置是否正确（不应该，路由表里 pathMatch 那行没有 meta.requiresAuth）。

- [ ] **Step 4: Commit**

```powershell
git add playwright/
git commit -m "feat(e2e): add auth fixture (JWT constructors + localStorage injection)"
```

---

### Task 3: auth.spec.ts — A1-A4 路由守卫 + 鉴权流

**Files:**
- Create: `playwright/e2e/auth.spec.ts`

- [ ] **Step 1: 创建 auth.spec.ts（4 个 case 一次性写入）**

创建文件 `playwright/e2e/auth.spec.ts`：

```ts
import { test, expect } from '@playwright/test'
import { loginAsStudent, setExpiredToken } from './fixtures/auth'

test('A1: 未登录访问 /rules/1 → 重定向到 /student-login?redirect=/rules/1', async ({ page }) => {
  // 清空 localStorage / cookie，确保未登录态
  await page.context().clearCookies()
  await page.addInitScript(() => {
    localStorage.clear()
  })

  await page.goto('/rules/1')
  // 等守卫执行完跳转
  await page.waitForURL(/\/student-login\?redirect=/)

  const url = page.url()
  expect(url).toContain('/student-login')
  expect(new URL(url).searchParams.get('redirect')).toBe('/rules/1')
})

test('A2: 已登录访问 /rules/1 → 正常渲染（video 元素存在）', async ({ page }) => {
  await loginAsStudent(page)
  await page.goto('/rules/1')
  // RuleVideoView 渲染后会有 <video> 元素
  await expect(page.locator('video')).toBeVisible({ timeout: 10_000 })
  // 地址栏不变（没有被重定向走）
  expect(page.url()).toBe('https://test.classicalab.cn/rules/1')
})

test('A3: token 过期访问 /rules/1 → 自动登出 + 重定向登录页', async ({ page }) => {
  await page.context().clearCookies()
  await setExpiredToken(page)

  await page.goto('/rules/1')
  // 等守卫检测到过期并触发 logout + 重定向
  await page.waitForURL(/\/student-login/)

  // localStorage token 真的被 authStore.logout() 清掉了
  const tokenAfter = await page.evaluate(() => localStorage.getItem('auth_token'))
  expect(tokenAfter).toBeNull()
})

test('A4: 学生访问 /admin-console → 回首页（角色门禁）', async ({ page }) => {
  await loginAsStudent(page)
  await page.goto('/admin-console')
  // 角色不匹配 → beforeEach next({ path: '/' })
  await page.waitForURL('/')

  // 首页有 NewHomeView 的特征元素（篇目列表）
  await expect(page.locator('.article-list, .poem-list, [class*="article"]').first()).toBeVisible()
})
```

- [ ] **Step 2: 运行 auth.spec.ts 验证**

```powershell
npx playwright test playwright/e2e/auth.spec.ts
```

预期输出：4 tests passed。如果 A3 fail（过期 token 没被清），检查 authStore.isTokenExpired() 是否正确解 b64url 的 exp 字段；如果 A4 fail（学生进了 admin-console），检查路由表 `/admin-console` 的 meta.role 是否真的是 ADMIN_ROLES（Vitest routerGuards.spec.ts 应该已经测过这点，但 E2E 暴露的可能是守卫链路问题）。

- [ ] **Step 3: 如果有失败，先诊断再最小修复**

**常见失败原因和修复**（TDD 循环）：

| 失败 case | 可能原因 | 诊断命令 | 修复 |
|-----------|---------|---------|------|
| A1 不跳转 | beforeEach 守卫没挂载 | `page.evaluate(() => location.href)` | 检查 main.ts 是否调用了 `setupAuthGuard(router)` |
| A2 video 不存在 | API 数据没返回 | Playwright Inspector → Network tab | 检查 test-api.classicalab.cn 是否可用；或用 makeValidJwt fallback |
| A3 token 没清 | logout 不调 localStorage.clear | `page.evaluate(() => localStorage.getItem('auth_token'))` | 检查 authStore.logout() 实现 |
| A4 没跳首页 | role 检查在 requiresAuth 后触发 | `page.evaluate(() => location.pathname)` | 检查 guards.ts 的 `isRoleAllowed(requiredRole, currentRole)` 调用 |

- [ ] **Step 4: Commit**

```powershell
git add playwright/e2e/auth.spec.ts
git commit -m "feat(e2e): add auth guard E2E tests (A1-A4)"
```

---

### Task 4: 完善 404.spec.ts — F1-F3 完整 3 case

**Files:**
- Modify: `playwright/e2e/404.spec.ts`

- [ ] **Step 1: 重写 404.spec.ts，完整 3 case**

```ts
import { test, expect } from '@playwright/test'
import { loginAsStudent } from './fixtures/auth'

test('F1: 访问不存在路径 → 渲染 NotFoundView', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/foo-bar-baz')

  await expect(page.locator('h1')).toHaveText('404')
  await expect(page.locator('.message')).toContainText('页面未找到')
})

test('F2: 404 页面点击「返回首页」→ 跳转 home', async ({ page }) => {
  await page.goto('/foo-bar-baz')
  await expect(page.locator('h1')).toHaveText('404')

  await page.getByRole('button', { name: /返回首页/ }).click()
  await page.waitForURL('/')

  // NewHomeView 渲染完成的标识：页面不再显示 404
  await expect(page.locator('h1')).not.toHaveText('404')
})

test('F3: 已登录状态访问不存在路径 → 仍走 404 兜底（不被守卫拦截）', async ({ page }) => {
  await loginAsStudent(page)
  await page.goto('/foo-bar-baz')

  // pathMatch 兜底路由没有 requiresAuth，已登录也能进 404
  await expect(page.locator('h1')).toHaveText('404')
})
```

- [ ] **Step 2: 跑 404.spec.ts**

```powershell
npx playwright test playwright/e2e/404.spec.ts
```

预期输出：3 tests passed。如果 F2 fail（点击后没跳转），查 useNavigation.goHome() 实现——它应该调用 `router.push('/')`。

- [ ] **Step 3: Commit**

```powershell
git add playwright/e2e/404.spec.ts
git commit -m "feat(e2e): add 404 fallback E2E tests (F1-F3)"
```

---

### Task 5: login-redirect.spec.ts — R1-R3 完整 3 case

**Files:**
- Create: `playwright/e2e/login-redirect.spec.ts`

- [ ] **Step 1: 创建 login-redirect.spec.ts**

```ts
import { test, expect } from '@playwright/test'

test('R1: 完整登录 + redirect 闭环', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())

  // 1. 直接访问受保护页面 → 被守卫踢去登录页，带 redirect
  await page.goto('/rules/1')
  await page.waitForURL(/\/student-login\?redirect=/)

  // 2. 真实 UI 登录（input + submit）
  await page.locator('#studentId').fill('2024001')
  await page.locator('#password').fill('valid-password')
  await page.locator('form').submit()

  // 3. 等跳回原目标
  await page.waitForURL('/rules/1', { timeout: 15_000 })

  // 4. localStorage 真存了 token（authStore.login() 成功）
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  expect(token).toBeTruthy()
})

test('R2: redirect 参数带特殊字符 → 登录后正确解码跳回', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())

  // 直接构造带特殊字符的 redirect URL（真实守卫也会这么生成）
  const target = encodeURIComponent('/rules/1?tab=detail')
  await page.goto(`/student-login?redirect=${target}`)

  await page.locator('#studentId').fill('2024001')
  await page.locator('#password').fill('valid-password')
  await page.locator('form').submit()

  // 登录成功后 authStore.sanitizeRedirect 应该正确解码
  // 最终 URL 不应该还是编码态
  await page.waitForURL(/\/rules\/1/, { timeout: 15_000 })
  const url = page.url()
  expect(url).not.toContain('%2F')   // 已解码，不是双编码
})

test('R3: 登录页无 redirect 参数 → 登录成功去默认目标', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())

  // 直接访问登录页，不带 redirect
  await page.goto('/student-login')

  await page.locator('#studentId').fill('2024001')
  await page.locator('#password').fill('valid-password')
  await page.locator('form').submit()

  // 没有 redirect → authStore.login() 默认 push('/rules/1')
  await page.waitForURL('/rules/1', { timeout: 15_000 })
})
```

- [ ] **Step 2: 跑 login-redirect.spec.ts**

```powershell
npx playwright test playwright/e2e/login-redirect.spec.ts
```

预期输出：3 tests passed。注意 R1 会真的调 `/api/auth/student/login`，需要后端测试环境在线。如果后端不可用导致 UI 登录拿不到 token，R1 会 fail——此时需要确保测试账号 `2024001 / valid-password` 在后端存在，或者后端有 seed 逻辑初始化它。

**兜底排查**：如果 R1 确实因后端 API 不可用而 fail，**不要改生产代码**——这表明 fixture fallback 机制不足以覆盖 UI 登录路径（因为 R1 是走真实 UI form.submit，不是走 API 直接拿 token）。此时临时处理：R1 用 `loginAsStudent()` fixture 直接注入 token，把 UI 登录作为后续优化项。

- [ ] **Step 3: Commit**

```powershell
git add playwright/e2e/login-redirect.spec.ts
git commit -m "feat(e2e): add login redirect E2E tests (R1-R3)"
```

---

### Task 6: 全量测试 + 本地验证 + 跑通

**Files:**
- 无新文件，验证所有现有文件

- [ ] **Step 1: 跑全部 Playwright E2E**

```powershell
npm run e2e
```

预期输出：10 tests passed（auth 4 + 404 3 + login-redirect 3）。如果有 fail，用 `npm run e2e:ui` 打开 Inspector 定位；或者用 `npx playwright test --reporter=list` 看详细 trace。

- [ ] **Step 2: 跑 Vitest 确保没破坏现有逻辑**

```powershell
npm run test:coverage
```

预期输出：Vitest 覆盖门槛 45/42/38/45 仍然通过（Playwright 只加了文件到 playwright/ 目录，不影响 src/ 下覆盖率统计）。

- [ ] **Step 3: 跑 type-check + lint 确保新文件无错误**

```powershell
npm run type-check
npm run lint:ci
```

预期输出：type-check exit 0；oxlint + eslint exit 0。

- [ ] **Step 4: Commit 所有改动**

```powershell
git add -A
git commit -m "feat(e2e): full playwright suite (auth+404+redirect, 10 tests)"
```

---

### Task 7: CI 集成 — .github/workflows/e2e-test.yml

**Files:**
- Create: `.github/workflows/e2e-test.yml`

- [ ] **Step 1: 创建 e2e-test.yml**

```yaml
name: E2E Test (Playwright)

# 触发：监听 deploy workflow 完成后自动跑 E2E
# 设计意图：
#   前端 deploy 和后端 deploy 是两个独立 yml，没有共同触发条件，没法互相 needs。
#   workflow_run 让我们在两者都完成后才启动 E2E，时序天然对齐。
#   只在被监听的 workflow conclusion == 'success' 时跑——deploy fail 了 E2E 没意义。
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

permissions:
  contents: read

jobs:
  e2e-test:
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
        run: npm ci

      - name: Install Playwright Chromium + system deps
        run: npx playwright install --with-deps chromium

      - name: Determine base URL
        id: env
        run: |
          workflow_name="${{ github.event.workflow_run.name }}"
          if [[ "$workflow_name" == *"Test"* ]]; then
            echo "base_url=https://test.classicalab.cn" >> "$GITHUB_OUTPUT"
            echo "api_url=https://test-api.classicalab.cn" >> "$GITHUB_OUTPUT"
            echo "E2E target: TEST env"
          else
            echo "base_url=https://www.classicalab.cn" >> "$GITHUB_OUTPUT"
            echo "api_url=https://api.classicalab.cn" >> "$GITHUB_OUTPUT"
            echo "E2E target: PROD env"
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
          name: playwright-artifacts-${{ github.run_id }}
          path: |
            test-results/
            playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Commit CI workflow**

```powershell
git add .github/workflows/e2e-test.yml
git commit -m "ci(e2e): add workflow_run-triggered playwright E2E job"
```

- [ ] **Step 3: 推到 feature-1 等 CI 跑通**

```powershell
git push origin HEAD
```

然后等待 `ci-checks.yml` → `deploy-frontend-test.yml` + `deploy-backend-test.yml` → 最后 `e2e-test.yml` 依次完成。

**监控方式**（项目级规则要求）：
1. 推送后等待 30 秒
2. `curl.exe -s "https://api.github.com/repos/Luo399/wenyan-platform/actions/runs?branch=feature-1&per_page=5"` 查状态
3. 若 E2E fail → 下载 artifact `playwright-artifacts-*` → 看 test-results/ 里的 trace + screenshot
4. 修复 → 提交 → 重推 → 等待 E2E green

---

## Self-Review

### 1. Spec Coverage
| Spec Section | 实现 Task | 覆盖 |
|-------------|----------|------|
| Section 1 目录结构 | Task 1, Task 2 | ✅ playwright.config.ts + playwright/e2e/ + fixtures/auth.ts |
| Section 1 配置 | Task 1 | ✅ baseURL/ignoreHTTPSErrors/trace/screenshot/timeout |
| Section 1 scripts | Task 1 Step 4 | ✅ 4 个 e2e scripts |
| Section 2 Fixture | Task 2 | ✅ makeExpiredJwt / makeValidJwt / loginAsStudent / setExpiredToken |
| Section 2 A1-A4 | Task 3 | ✅ 4 个 case |
| Section 2 F1-F3 | Task 4 | ✅ 3 个 case |
| Section 2 R1-R3 | Task 5 | ✅ 3 个 case |
| Section 3 CI workflow_run | Task 7 | ✅ 监听 4 个 deploy yml + conclusion check + artifact 上传 |
| Section 3 运行模型 | Task 6 | ✅ 本地跑通 |
| Section 4 风险缓解 | Task 3/5 诊断表 | ✅ 常见 fail 原因 + 修复方向 |

### 2. Placeholder Scan
Grep 检查：无 TBD / TODO / "implement later" 占位符。所有代码块都是完整可运行的。

### 3. Type Consistency
- Fixture 函数签名：`loginAsStudent(page, studentId?, password?)` → Task 3/4/5 调用处都一致
- 测试命名：A1/A2/A3/A4 / F1/F2/F3 / R1/R2/R3 → 和设计文档 Table 一致
- 环境变量名：`PLAYWRIGHT_BASE_URL` / `PLAYWRIGHT_API_URL` → playwright.config.ts 和 e2e-test.yml 都用这个
- baseURL 默认值：playwright.config.ts 默认 `https://test.classicalab.cn`，fixture 默认 `https://test-api.classicalab.cn` → 和 spec Section 1/2 一致
