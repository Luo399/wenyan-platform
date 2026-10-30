import { defineConfig } from 'vitest/config'

/**
 * 插件单元测试独立配置
 * 说明：仓库根目录已有 vitest.config.ts（面向 Vue 前端，include 限定 tests/**），
 *       figma-plugin 是独立 npm 包，需在自身目录提供独立配置，避免被根配置覆盖。
 */
export default defineConfig({
  // 显式钉住本包 tsconfig：不指定时 Vite 8 的 oxc 转换会向上找到仓库根
  // tsconfig.json，再沿 references 命中 tsconfig.node.json 的 `@tsconfig/node24`。
  // CI 的 figma-plugin-check 只安装插件自身依赖，根 node_modules 不存在，
  // 转换阶段会直接报 TSCONFIG_ERROR（本地根依赖齐全，反而复现不到）。
  tsconfig: './tsconfig.json',
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
})