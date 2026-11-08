/**
 * 懒加载路由 chunk 加载失败自愈（发布新鲜度方案 · 阶段 3）
 *
 * 要解决的现象：
 * 前端每次构建都会产出带 content hash 的新 chunk 文件名，用户浏览器里跑的还是旧 index.html
 * 引用的旧入口 JS。当他点「继续」触发路由懒加载时，请求的是已经不在服务器上的旧 chunk，
 * 动态 import 失败 → 页面原地不动、也不报错。不同浏览器文案还各不相同，很容易被误判成导航 bug。
 *
 * 处理办法（业界通用做法）：识别这类失败 → 整页重新加载「本次要去的目标地址」，
 * 让浏览器重新拿到最新的 index.html 和最新入口 JS，再去请求新的 chunk 文件名。
 * 不能只重试 import：旧入口 JS 里的 chunk 依赖图已经写死在内存中，
 * 不重新加载文档不可能拿到新文件名。
 *
 * 死循环防护：新 index.html 有可能还没刷到（CDN 回源、浏览器缓存），无脑刷新会一直循环。
 * 这里用 sessionStorage 记一条「已为哪个地址自动重载过」，同一地址只重载一次；
 * 真正到达该地址（afterEach）后才释放，之后如果再坏还能再自愈一次。
 * 另加两道闸：本文档内只安排一次重载（in-memory），两次重载之间有冷却窗口。
 *
 * 放弃自动重载时不静默失败：写一条 hint 到 sessionStorage 并派发事件，
 * 供阶段 4 的版本提示 UI 读取（本模块不自己弹提示，避免和页面组件耦合）。
 */

import type { Router } from 'vue-router'
import { debugLog, debugWarn } from '@/utils/debug'

/** sessionStorage：已经为哪个地址自动重载过（防死循环） */
export const CHUNK_RELOAD_KEY = 'wenyan:chunk-reload'
/** sessionStorage：放弃自动重载时的提示，供 UI 读取 */
export const CHUNK_RELOAD_HINT_KEY = 'wenyan:chunk-reload-hint'
/** 放弃自动重载时派发的 window 事件名，detail 为 ChunkRecoveryHint */
export const CHUNK_RELOAD_FAILED_EVENT = 'wenyan:chunk-reload-failed'

/** 同一会话内两次自动重载的最小间隔：防止连续换页失败造成刷新风暴 */
const DEFAULT_RELOAD_COOLDOWN_MS = 10_000

/**
 * 各浏览器 / 构建工具对「动态 import 的 chunk 拿不到」的不同文案。
 * 只匹配这些：业务接口的 `Failed to fetch`、`Network Error` 一律不算，
 * 否则一次断网就会把用户正在答题的页面整页刷掉。
 */
const CHUNK_FAILURE_PATTERNS: readonly RegExp[] = [
  /failed to fetch dynamically imported module/i, // Chrome / Edge
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari 17+
  /failed to load module script/i, // Safari 旧版
  /unable to preload css for/i, // Vite modulePreload 的 CSS chunk 失败
  /expected .*javascript module/i, // 返回了 HTML/JSON 而不是 JS（常见于 404 回落页）
  /loading (?:css )?chunk .*failed/i, // webpack 风格 "Loading chunk 12 failed"
]

/** 自动重载记录 */
export interface ChunkReloadRecord {
  /** 要去的地址（router fullPath：path + query + hash，不含 base） */
  path: string
  /** 写入时间戳，用于冷却判断 */
  at: number
}

/** 放弃自动重载时留下的提示 */
export interface ChunkRecoveryHint {
  path: string
  reason: 'offline' | 'already-reloaded' | 'cooldown' | 'unavailable-storage'
  at: number
}

/** 只用到这三个方法的 Storage 子集，便于单测塞假实现 */
export type ChunkRecoveryStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * 外部依赖全部注入（对齐 ClassPicker 的可选注入约定）：
 * 单测里不需要真的跳转页面，也不依赖 happy-dom 的 location。
 */
export interface ChunkRecoveryDeps {
  /** 取 sessionStorage；隐私模式 / 被禁用时返回 null */
  getStorage: () => ChunkRecoveryStorageLike | null
  /** 当前地址（router 视角：去掉 base 的 pathname + search + hash） */
  getCurrentPath: () => string
  /** 整页跳转到给定地址（入参是 router fullPath，base 由实现方拼） */
  navigateToPath: (fullPath: string) => void
  /** 整页重载当前文档 */
  reloadPage: () => void
  now: () => number
  isOffline: () => boolean
  emitHint: (hint: ChunkRecoveryHint) => void
}

export interface ChunkRecovery {
  /**
   * 处理一次可能的 chunk 加载失败。
   * @param error 原始错误（router.onError 的 error / vite:preloadError 的 payload）
   * @param targetPath 本次导航要去的路由地址；缺省时用当前地址
   * @returns 是否安排了整页重载
   */
  handleFailure: (error: unknown, targetPath?: string | null) => boolean
  /** 导航成功后调用：真正到达目标地址才释放防死循环记录 */
  confirmNavigation: (fullPath: string) => void
}

/**
 * 判断是否「chunk 加载失败」类错误。
 * 只认动态 import / 预加载失败的文案，以及 webpack 的 ChunkLoadError。
 */
export function isChunkLoadFailure(error: unknown): boolean {
  if (error === null || error === undefined) return false

  const like = error as { name?: unknown; message?: unknown }
  if (typeof like.name === 'string' && like.name === 'ChunkLoadError') return true

  let text: string
  if (typeof like.message === 'string') text = like.message
  else if (typeof error === 'string') text = error
  else text = String(error)

  return CHUNK_FAILURE_PATTERNS.some((pattern) => pattern.test(text))
}

/** Vite 的 BASE_URL 约定以 / 开头，但可能为空串；统一成首尾都有 / */
export function normalizeBase(base: string | undefined): string {
  if (!base) return '/'
  const withLeading = base.startsWith('/') ? base : `/${base}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}

/** location.pathname → router 视角路径（去掉部署 base 前缀） */
export function stripBase(pathname: string, base: string): string {
  const normalized = normalizeBase(base)
  if (normalized === '/') return pathname || '/'
  if (pathname.startsWith(normalized)) return `/${pathname.slice(normalized.length)}`
  return pathname || '/'
}

/** router fullPath → 可以直接交给 location.assign 的地址（补上部署 base） */
export function withBase(fullPath: string, base: string): string {
  const normalized = normalizeBase(base)
  const relative = fullPath.startsWith('/') ? fullPath.slice(1) : fullPath
  return `${normalized}${relative}`
}

/** router 视角的地址规范化：空值算首页，保证一定以 / 开头 */
function toAbsolutePath(fullPath: string | null | undefined): string {
  const raw = (fullPath ?? '').trim()
  if (!raw) return '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

function readRecord(storage: ChunkRecoveryStorageLike | null): ChunkReloadRecord | null {
  if (!storage) return null
  let raw: string | null = null
  try {
    raw = storage.getItem(CHUNK_RELOAD_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Partial<ChunkReloadRecord>
      if (typeof record.path === 'string' && typeof record.at === 'number') {
        return { path: record.path, at: record.at }
      }
    }
  } catch {
    // 数据损坏（老版本写的值等）：按「没记录」处理，下面的写入会覆盖它
  }
  return null
}

/** 纯逻辑工厂：所有副作用从 deps 注入，单测直接验证行为 */
export function createChunkRecovery(
  deps: ChunkRecoveryDeps,
  options: { cooldownMs?: number } = {},
): ChunkRecovery {
  const cooldownMs = options.cooldownMs ?? DEFAULT_RELOAD_COOLDOWN_MS

  /**
   * 同一个文档内只安排一次重载。
   * vite:preloadError 和 router.onError 会先后命中同一次失败，
   * 没有这个标志的话第二发会误报「已放弃」。
   */
  let reloadScheduled = false

  function giveUp(target: string, reason: ChunkRecoveryHint['reason']): false {
    const hint: ChunkRecoveryHint = { path: target, reason, at: deps.now() }
    debugWarn('[chunkRecovery] 放弃自动重载：', reason, target)
    try {
      deps.getStorage()?.setItem(CHUNK_RELOAD_HINT_KEY, JSON.stringify(hint))
    } catch {
      // sessionStorage 写不进去就算了，事件仍然会派发
    }
    try {
      deps.emitHint(hint)
    } catch {
      // 监听方报错不影响自愈流程
    }
    return false
  }

  return {
    handleFailure(error, targetPath) {
      if (!isChunkLoadFailure(error)) return false
      if (reloadScheduled) return false

      const target = toAbsolutePath(targetPath ?? deps.getCurrentPath())
      debugLog('[chunkRecovery] 检测到 chunk 加载失败，准备整页重载到', target)

      if (deps.isOffline()) return giveUp(target, 'offline')

      const storage = deps.getStorage()
      const record = readRecord(storage)
      if (record && record.path === target) return giveUp(target, 'already-reloaded')
      if (record && deps.now() - record.at < cooldownMs) return giveUp(target, 'cooldown')
      if (!storage) return giveUp(target, 'unavailable-storage')

      try {
        storage.setItem(CHUNK_RELOAD_KEY, JSON.stringify({ path: target, at: deps.now() }))
      } catch {
        return giveUp(target, 'unavailable-storage')
      }

      // 先置标志再跳转：跳转期间的其它错误不该重复处理
      reloadScheduled = true
      const current = toAbsolutePath(deps.getCurrentPath())
      if (current === target) deps.reloadPage()
      else deps.navigateToPath(target)
      return true
    },

    confirmNavigation(fullPath) {
      const storage = deps.getStorage()
      if (!storage) return
      const path = toAbsolutePath(fullPath)
      if (readRecord(storage)?.path !== path) return
      try {
        storage.removeItem(CHUNK_RELOAD_KEY)
        storage.removeItem(CHUNK_RELOAD_HINT_KEY)
      } catch {
        // 清不掉就维持现状：最坏是这次会话不再自动重载，不会出现死循环
      }
    },
  }
}

function createBrowserDeps(): ChunkRecoveryDeps {
  const base = normalizeBase(import.meta.env.BASE_URL)

  return {
    getStorage: () => {
      try {
        const storage = window.sessionStorage
        if (!storage) return null
        // 探一次真实读取：Safari 无痕模式下访问 sessionStorage 会直接抛
        storage.getItem(CHUNK_RELOAD_KEY)
        return storage
      } catch {
        return null
      }
    },
    getCurrentPath: () =>
      stripBase(window.location.pathname, base) + window.location.search + window.location.hash,
    navigateToPath: (fullPath) => {
      window.location.assign(withBase(fullPath, base))
    },
    reloadPage: () => {
      window.location.reload()
    },
    now: () => Date.now(),
    // 断网时不重载：重载只会拿到浏览器的旧缓存，还白费用户一次等待
    isOffline: () => typeof navigator !== 'undefined' && navigator.onLine === false,
    emitHint: (hint) => {
      window.dispatchEvent(new CustomEvent(CHUNK_RELOAD_FAILED_EVENT, { detail: hint }))
    },
  }
}

/**
 * 挂到 router 上：监听 Vite 的预加载失败事件 + vue-router 的导航错误。
 *
 * @param router 应用唯一的 router 实例
 * @param overrides 依赖覆盖（单测用）
 * @returns 卸载函数（移除事件与钩子）
 */
export function registerChunkRecovery(
  router: Router,
  overrides: Partial<ChunkRecoveryDeps> = {},
): () => void {
  const deps: ChunkRecoveryDeps = { ...createBrowserDeps(), ...overrides }
  const recovery = createChunkRecovery(deps)

  /**
   * vue-router 在解析懒加载组件之前就跑完 beforeEach，失败时 currentRoute 还停在上一个页面，
   * 所以「要重载到哪个地址」必须在导航开始时就记下来。
   */
  let pendingPath: string | null = null

  const stopBeforeEach = router.beforeEach((to) => {
    // 必须是代码块：箭头函数直接 return 字符串会被 vue-router 当成「重定向到该地址」
    pendingPath = to.fullPath
  })

  const stopAfterEach = router.afterEach((to) => {
    pendingPath = null
    recovery.confirmNavigation(to.fullPath)
  })

  const stopOnError = router.onError((error, to) => {
    // vue-router 5 的 onError 会带上「当时正在去往哪里」，优先用它；
    // pendingPath 只给非路由导航触发的 Vite 预加载失败兜底
    recovery.handleFailure(error, to.fullPath || pendingPath)
  })

  const onPreloadError = (event: Event) => {
    // 不调 preventDefault：Vite 会把错误继续抛出，router.onError 也会命中同一处理；
    // 谁先到都无所谓，reloadScheduled 保证一次失败只重载一次
    const payload = (event as unknown as { payload?: unknown }).payload
    recovery.handleFailure(payload, pendingPath)
  }
  window.addEventListener('vite:preloadError', onPreloadError)

  debugLog('[chunkRecovery] 懒加载 chunk 失败自愈已注册')

  return () => {
    window.removeEventListener('vite:preloadError', onPreloadError)
    stopBeforeEach()
    stopAfterEach()
    stopOnError()
  }
}
