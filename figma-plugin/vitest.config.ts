import { defineConfig } from 'vitest/config'

/**
 * 插件单元测试独立配置
 * 说明：仓库根目录已有 vitest.config.ts（面向 Vue 前端，include 限定 tests/**），
 *       figma-plugin 是独立 npm 包，需在自身目录提供独立配置，避免被根配置覆盖。
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
})