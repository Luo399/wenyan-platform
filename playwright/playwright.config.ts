import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 *
 * 设计意图：
 * - baseURL 默认指向测试环境 test.classicalab.cn，可通过 PLAYWRIGHT_BASE_URL 环境变量覆盖
 *   （CI workflow 根据触发的是 test 还是 prod deploy 动态设置）
 * - ignoreHTTPSErrors: true 跳过测试环境无效证书（ERR_CERT_COMMON_NAME_INVALID）
 * - trace/screenshot/video 三件套确保失败时能回溯问题
 * - 首批只跑 Chromium，WebKit/Firefox 后续扩展
 *
 * 运行：
 *   本地：npm run e2e                           → 默认 against test env
 *   本地：npx playwright test --grep "F1"       → 跑单个 case
 *   CI  ：workflow_run 监听 deploy 完成后自动触发
 */
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
