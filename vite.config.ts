import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/**
 * 发布新鲜度阶段 1：把「这份产物是哪次构建」变成编译期常量。
 *
 * 只用 CI 已经提供的量，不要掺 Date.now()：时间戳会让同一份输入每次产出不同字节，
 * 和素材链路「产物字节稳定」的既有约定冲突，也没法拿它判断两个浏览器是不是同一版本。
 * GITHUB_SHA 在 GitHub Actions 每次运行里必然存在（就是本次 checkout 的提交）；
 * 本地 dev / build 拿不到就退回 LOCAL_BUILD_ID，与 src/utils/buildStamp.ts 对齐。
 */
const LOCAL_BUILD_ID = 'local'

function resolveBuildId(): string {
  const shortSha = (process.env.GITHUB_SHA ?? '').trim().toLowerCase().slice(0, 7)
  return /^[0-9a-f]{7}$/.test(shortSha) ? shortSha : LOCAL_BUILD_ID
}

const buildId = resolveBuildId()

/**
 * 构建号同时写进 index.html 的 `<meta name="build-id">`。
 * 页脚那个号是给人在浏览器里看的，这条是给 curl / CI 看的：
 * 「线上现在是哪个提交」不必去解析 JS 产物，一条 grep 就能回答。
 */
const buildIdMeta: Plugin = {
  name: 'inject-build-id-meta',
  transformIndexHtml() {
    return [
      {
        tag: 'meta',
        attrs: { name: 'build-id', content: buildId },
        injectTo: 'head-prepend',
      },
    ]
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    buildIdMeta,
  ],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
