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

export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadViteEnv(mode)
  console.log(`[Vite] 构建模式: ${mode}`)
  console.log(`[Vite] VITE_API_BASE: ${env.VITE_API_BASE}`)
  console.log(`[Vite] VITE_OSS_BASE_URL: ${env.VITE_OSS_BASE_URL}`)

  return {
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
    // 确保环境变量在构建时被正确注入
    define: {
      'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || ''),
      'import.meta.env.VITE_OSS_BASE_URL': JSON.stringify(env.VITE_OSS_BASE_URL || ''),
    },
  }
})
