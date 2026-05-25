import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue(), vueDevTools()],
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
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
      }
      next()
    })
  },
})
