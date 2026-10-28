/// <reference types="vite/client" />

/**
 * 发布新鲜度阶段 1：构建号是编译期常量，由 vite.config.ts 的 `define` 替换。
 * CI 里它是本次构建提交的短 sha，本地 dev / build 是 'local'。
 *
 * 业务代码不要直接读这个全局，走 `src/utils/buildStamp.ts` 的 getBuildId()：
 * 那边兜住了「define 没生效」的情况（typeof 对未声明标识符不会抛）。
 */
declare const __BUILD_ID__: string
