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
    // src 单元测试 + tests/ 下的存量测试（此前 tests/**/*.spec.ts 从未被执行）
    include: ['src/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/backend/tests/**'],
    // tests/setup.ts 只做三件事：mock ResizeObserver、mock HTMLMediaElement 的
    // play/pause/load、stub 全局 fetch。均基于 vi.fn()，与 happy-dom 的
    // window 实现不冲突，因此保留 environment: 'happy-dom' 并直接启用。
    setupFiles: ['tests/setup.ts'],
    // 覆盖率门槛（`npm run test:coverage` 才生效）：provider 必须是 'v8'，
    // vitest 4 已移除 'c8' provider，写 'c8' 会直接报 "Cannot find dependency 'c8'"。
    // 首轮阈值取 2026-10-29 实测值向下取整（stmts 14.93 / branch 11.49 / funcs 16.76 / lines 14.09）。
    // 2026-10-29 同日把 `--coverage` 接进 CI 的 quality-check，在导出树上重测两次：
    //   tip d99b4fd → stmts 20.73 / funcs 22.50 / branch 15.21 / lines 20.17（16 文件 260 例）
    //   tip 79555e5（并入 figma 资产测试与 23 号位挂载断言）→ 23.08 / 25.11 / 16.84 / 22.46（19 文件 278 例）
    // 门槛按两次实测的**下界**再向下取整，每项留 ≥2 个点余量：CI 与本机都量过 18/20/13/18 这一档能绿。
    // 作用是「不许往下走」，不是「达标线」——往上提要跟着补测试。
    // 2026-10-29 并入 feature-1 后重测：include 重新含 tests/**/*.spec.ts（64 文件 967 例），
    // 实测 stmts 53.05 / branch 44.58 / funcs 51.25 / lines 53.84。18/20/13/18 这一档
    // 已经不构成任何约束，按实测下界留 ≥5 个点余量重定为 45/38/42/45。
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/__tests__/**', 'src/**/main.ts', 'src/**/*.d.ts', 'src/mock/**'],
      thresholds: {
        lines: 45,
        functions: 42,
        branches: 38,
        statements: 45,
      },
    },
  },
})
