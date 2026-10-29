import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    // Vue DevTools 只在 dev server 注入：生产构建既不需要它的调试面板，
    // 也不该把 devtools 的注入代码带进线上产物。
    ...(command === 'serve' ? [vueDevTools()] : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // 生产包不输出 sourcemap：nginx 直接把 dist 当静态目录，.map 等于把源码公开
    sourcemap: false,
    // 显式写死目标语法级别（Vite 8 默认即为 es2020 系，锁定防止上游默认值变化）
    target: 'es2020',
    // Vite 8 由 rolldown 打包，build.rollupOptions 已废弃，对应项为 build.rolldownOptions
    rolldownOptions: {
      output: {
        /**
         * 框架层单独拆一个 vendor chunk：
         * - vue / vue-router / pinia 版本稳定，可长期命中浏览器缓存，
         *   业务代码发版时学生不必重新下载这一坨
         * - rolldown 的 manualChunks 只保留函数式写法（对象式 { vendor: [...] } 已移除）
         */
        manualChunks(id: string): string | null {
          if (!id.includes('node_modules')) return null
          if (/[\\/]node_modules[\\/](vue|vue-router|pinia|@vue)[\\/]/.test(id)) return 'vendor'
          return null
        },
      },
    },
  },
}))
