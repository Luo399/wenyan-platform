import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    // happy-dom 比 jsdom 稳：jsdom 30 + Node 20 内置 undici 在 CacheStorage 初始化时
    // 触发 webidl.util.markAsUncloneable 不存在；happy-dom 无此问题
    environment: 'happy-dom',
    // threads 比 forks 稳：forks 模式下 jsdom 30 + Node 20 会触发 webidl.markAsUncloneable 序列化崩溃
    pool: 'threads',
    // src 单元测试 + tests/ 下的存量测试（此前 tests/**/*.spec.ts 从未被执行）
    include: ['src/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/backend/tests/**'],
    // tests/setup.ts 只做三件事：mock ResizeObserver、mock HTMLMediaElement 的
    // play/pause/load、stub 全局 fetch。均基于 vi.fn()，与 happy-dom 的
    // window 实现不冲突，因此保留 environment: 'happy-dom' 并直接启用。
    setupFiles: ['tests/setup.ts'],
    // P0-3: 覆盖率阈值强制——低于此阈值 CI 失败
    // 阈值 40/40/30/40（lines/functions/branches/statements）
    coverage: {
      // vitest 4 已移除 c8 provider，必须使用 v8
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/__tests__/**', 'src/**/main.ts', 'src/**/*.d.ts', 'src/mock/**'],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40,
      },
    },
  },
})