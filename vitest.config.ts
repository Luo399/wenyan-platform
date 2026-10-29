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
  // 阶段 1 的构建号是编译期常量：真实构建由 vite.config.ts 注入提交短 sha，
  // 测试这边给一个 sha 形态的固定值，让 BuildStamp 的用例跑在和线上一致的条件下。
  define: {
    __BUILD_ID__: JSON.stringify('abc1234'),
  },
  test: {
    globals: true,
    // happy-dom 比 jsdom 稳：jsdom 30 + Node 20 内置 undici 在 CacheStorage 初始化时
    // 触发 webidl.util.markAsUncloneable 不存在；happy-dom 无此问题
    environment: 'happy-dom',
    // threads 比 forks 稳：forks 模式下 jsdom 30 + Node 20 会触发 webidl.markAsUncloneable 序列化崩溃
    pool: 'threads',
    // 只跑 src 下的新测试；tests/**/*.spec.ts 那批老测试用了过期的 @vue/test-utils 1.x 写法
    // 且 jsdom 30 + Node 20 有 webidl 兼容性问题，后续统一处理
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/backend/tests/**'],
    // 覆盖率门槛（`npm run test:coverage` 才生效）：provider 必须是 'v8'，
    // vitest 4 已移除 'c8' provider，写 'c8' 会直接报 "Cannot find dependency 'c8'"。
    // 首轮阈值取 2026-10-29 实测值向下取整（stmts 14.93 / branch 11.49 / funcs 16.76 / lines 14.09）。
    // 2026-10-29 同日把 `--coverage` 接进 CI 的 quality-check，在导出树上重测两次：
    //   tip d99b4fd → stmts 20.73 / funcs 22.50 / branch 15.21 / lines 20.17（16 文件 260 例）
    //   tip 79555e5（并入 figma 资产测试与 23 号位挂载断言）→ 23.08 / 25.11 / 16.84 / 22.46（19 文件 278 例）
    // 门槛按两次实测的**下界**再向下取整，每项留 ≥2 个点余量：CI 与本机都量过 18/20/13/18 这一档能绿。
    // 作用是「不许往下走」，不是「达标线」——往上提要跟着补测试。
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/__tests__/**', 'src/**/main.ts', 'src/**/*.d.ts', 'src/mock/**'],
      thresholds: {
        lines: 18,
        functions: 20,
        branches: 13,
        statements: 18,
      },
    },
  },
})
