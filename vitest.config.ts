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
    environment: 'jsdom',
    // threads 比 forks 稳：forks 模式下 jsdom 30 + Node 20 会触发 webidl.markAsUncloneable 序列化崩溃
    pool: 'threads',
    // 只跑 src 下的新测试；tests/**/*.spec.ts 那批老测试用了过期的 @vue/test-utils 1.x 写法
    // 且 jsdom 30 + Node 20 有 webidl 兼容性问题，后续统一处理
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/backend/tests/**'],
  },
})