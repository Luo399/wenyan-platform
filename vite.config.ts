import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

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
  plugins: [vue(), vueDevTools(), jsonCharsetPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    fs: {
      strict: false,
    },
  },
})
