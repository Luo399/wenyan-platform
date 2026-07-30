import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 拆分 vendor chunk，减小首屏体积
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'video-vendor': ['video.js'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false,
  },
})
