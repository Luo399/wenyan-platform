/// <reference types="vite/client" />

/**
 * 环境变量类型声明（与 vite/client 内置的 ImportMetaEnv 合并）
 *
 * 字段来源（新增/删除变量时同步维护这里，否则拼错名字只会在运行时静默 undefined）：
 * - VITE_API_BASE_URL：src/utils/api.ts、src/utils/asset.ts、src/utils/tracking.ts
 * - VITE_OSS_BASE_URL：src/utils/asset.ts
 * - VITE_TEST_ACCOUNTS：src/components/LoginModal.vue、src/views/StudentLoginView.vue
 *
 * src/config/poemAssets.ts 是纯静态清单，不读任何 import.meta.env.*，故此处无对应字段。
 */
interface ImportMetaEnv {
  /** 后端 API 根地址（不带结尾斜杠），如 https://api.classicalab.cn */
  readonly VITE_API_BASE_URL: string
  /** OSS/CDN 资源根地址；未配置时资源 URL 退化为站内相对路径 */
  readonly VITE_OSS_BASE_URL?: string
  /** 登录页测试账号提示（JSON 数组字符串），仅 DEV 且解析出条目时才展示 */
  readonly VITE_TEST_ACCOUNTS?: string
}

/**
 * 发布新鲜度阶段 1：构建号是编译期常量，由 vite.config.ts 的 `define` 替换。
 * CI 里它是本次构建提交的短 sha，本地 dev / build 是 'local'。
 *
 * 业务代码不要直接读这个全局，走 `src/utils/buildStamp.ts` 的 getBuildId()：
 * 那边兜住了「define 没生效」的情况（typeof 对未声明标识符不会抛）。
 */
declare const __BUILD_ID__: string
