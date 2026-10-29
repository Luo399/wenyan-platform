import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue() as any],
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
    include: ['src/**/*.test.ts'],
    // 注意：tests/**/*.spec.ts 那批老测试用了过期的 @vue/test-utils 1.x 写法
    // 且 jsdom 30 + Node 20 有 webidl 兼容性问题，暂不纳入；后续统一处理后再加
    exclude: ['**/node_modules/**', '**/backend/tests/**'],
    // P0-3: 覆盖率阈值强制——首轮用保守值（实测后上调）
    // 低于此阈值 CI 失败，后续根据实际覆盖率逐步提高
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/__tests__/**', 'src/**/main.ts', 'src/**/*.d.ts', 'src/mock/**'],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 20,
        statements: 30,
      },
    },
  },
})