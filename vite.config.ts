import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import legacy from '@vitejs/plugin-legacy'

// 加载环境变量
function loadViteEnv(mode: string) {
  return loadEnv(mode, process.cwd())
}

// JSON 响应头插件
function jsonCharsetPlugin(): Plugin {
  return {
    name: 'vite-plugin-json-charset',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    jsonCharsetPlugin(),
    // Legacy 插件：支持 IE 11 及其他旧浏览器
    legacy({
      targets: ['ie >= 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: {
      strict: false,
    },
    proxy: {
      '/api': {
        target: 'http://8.138.106.162',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
