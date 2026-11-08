/**
 * 构建号的可读化（发布新鲜度阶段 1）
 *
 * 为什么要有这一层：`__BUILD_ID__` 是 vite.config.ts 用 `define` 替换的编译期常量，
 * 直接把它写进模板会让组件依赖构建配置，也没法测空值 / 本地值这些边界。
 * 格式化逻辑留在 utils（分层红线：组件不碰数据来源），组件只负责摆放。
 */

/** 本地开发或注入缺失时的占位值，必须与 vite.config.ts 的退回分支一致 */
export const LOCAL_BUILD_ID = 'local'

/**
 * 读注入的构建号。
 * 用 `typeof` 兜底：万一某条构建链路没带上 `define`（比如临时换了配置文件），
 * 未声明标识符上的 typeof 只会得到 'undefined'，不会抛 ReferenceError 把整页带崩。
 */
export function getBuildId(): string {
  return normalizeBuildId(typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : '')
}

/** 去空白、转小写；空值一律当成本地构建 */
export function normalizeBuildId(raw: string | undefined | null): string {
  const id = (raw ?? '').trim().toLowerCase()
  return id === '' ? LOCAL_BUILD_ID : id
}

/** 页脚文案：CI 构建显示「构建 abc1234」，本地显示「本地构建」 */
export function formatBuildStamp(buildId: string = getBuildId()): string {
  const id = normalizeBuildId(buildId)
  return id === LOCAL_BUILD_ID ? '本地构建' : `构建 ${id}`
}
