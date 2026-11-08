/**
 * chunkRecovery 单测（发布新鲜度方案 · 阶段 3）
 *
 * 锁死四件事：
 * 1. 只认「动态 import / 预加载失败」这类错误，业务接口失败绝不刷新
 *    （否则一次断网就把用户正在答题的页面刷掉）。
 * 2. 重载目标是「本次导航要去的路由地址」，不是当前地址 —— 刷新完还要回到用户要点的那一页。
 * 3. 同一地址只自动重载一次；真正到达之后才释放，防止新旧版本交替时死循环。
 * 4. 断网 / sessionStorage 不可用时放弃重载，只留提示。
 */
import { describe, it, expect, vi } from 'vitest'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'

// 日志在单测里静音：本模块的 debugLog/debugWarn 只在开发环境有意义
vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}))

import {
  CHUNK_RELOAD_FAILED_EVENT,
  CHUNK_RELOAD_HINT_KEY,
  CHUNK_RELOAD_KEY,
  createChunkRecovery,
  isChunkLoadFailure,
  normalizeBase,
  registerChunkRecovery,
  stripBase,
  withBase,
  type ChunkRecoveryDeps,
  type ChunkRecoveryHint,
  type ChunkRecoveryStorageLike,
} from '@/utils/chunkRecovery'

const CHROME_ERROR = new Error(
  'Failed to fetch dynamically imported module: https://www.classicalab.cn/assets/DetailView-legacy.js',
)
const FIREFOX_ERROR = new Error(
  'error loading dynamically imported module: https://www.classicalab.cn/assets/DetailView-legacy.js',
)
const SAFARI_ERROR = new Error('Importing a module script failed.')
const CSS_PRELOAD_ERROR = new Error('Unable to preload CSS for /assets/stepone-legacy.css')

/** 普通组件占位：只用 render，避免 happy-dom 下依赖运行时模板编译器 */
const Stub = defineComponent({
  name: 'StubView',
  render: () => h('div'),
})

type FakeStorage = ChunkRecoveryStorageLike & { dump: () => Record<string, string> }

function createFakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const map = new Map<string, string>(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    dump: () => Object.fromEntries(map),
  }
}

interface FakeOptions {
  /** 预置的 sessionStorage 内容（用于模拟"上一个文档已经重载过"） */
  initial?: Record<string, string>
  /** 模拟 Safari 无痕：sessionStorage 完全不可用 */
  noStorage?: boolean
  /** 模拟写入抛错（配额满 / 被策略禁用） */
  throwOnSet?: boolean
  currentPath?: string
  offline?: boolean
  now?: number
}

function createFakeDeps(options: FakeOptions = {}) {
  const storage = createFakeStorage(options.initial)
  if (options.throwOnSet) {
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
  }

  const calls = {
    navigateTo: [] as string[],
    reloads: 0,
    hints: [] as ChunkRecoveryHint[],
  }
  const clock = { now: options.now ?? 1_000_000 }

  const deps: ChunkRecoveryDeps = {
    getStorage: () => (options.noStorage ? null : storage),
    getCurrentPath: () => options.currentPath ?? '/',
    navigateToPath: (fullPath) => {
      calls.navigateTo.push(fullPath)
    },
    reloadPage: () => {
      calls.reloads += 1
    },
    now: () => clock.now,
    isOffline: () => options.offline ?? false,
    emitHint: (hint) => {
      calls.hints.push(hint)
    },
  }

  return { deps, calls, clock, storage }
}

/** 把 sessionStorage 里那条自动重载记录读回来 */
function reloadRecord(storage: ChunkRecoveryStorageLike): { path: string; at: number } | null {
  const raw = storage.getItem(CHUNK_RELOAD_KEY)
  if (!raw) return null
  return JSON.parse(raw) as { path: string; at: number }
}

function preloadErrorEvent(payload: unknown): Event & { payload?: unknown } {
  const event = new Event('vite:preloadError', { cancelable: true }) as Event & {
    payload?: unknown
  }
  event.payload = payload
  return event
}

describe('isChunkLoadFailure - 只认 chunk 加载失败', () => {
  it('识别各浏览器的动态 import 失败文案', () => {
    for (const error of [CHROME_ERROR, FIREFOX_ERROR, SAFARI_ERROR, CSS_PRELOAD_ERROR]) {
      expect(isChunkLoadFailure(error)).toBe(true)
    }
    expect(isChunkLoadFailure(new Error('Loading CSS chunk 12 failed'))).toBe(true)
    expect(
      isChunkLoadFailure(
        new Error(
          'Expected a JavaScript module script but the server responded with a MIME type of "text/html"',
        ),
      ),
    ).toBe(true)
    // webpack 风格：靠 name 判定，不看文案
    expect(isChunkLoadFailure({ name: 'ChunkLoadError' })).toBe(true)
  })

  it('业务接口/网络错误一律不算（绝不能因此刷新页面）', () => {
    const notChunkErrors: unknown[] = [
      new Error('Failed to fetch'),
      new Error('Network Error'),
      new Error('timeout of 5000ms exceeded'),
      new Error('Request failed with status code 500'),
      new Error('用户取消了提交'),
      'boom',
      {},
      null,
      undefined,
    ]
    for (const error of notChunkErrors) {
      expect(isChunkLoadFailure(error)).toBe(false)
    }
  })
})

describe('createChunkRecovery - 重载目标与次数', () => {
  it('目标地址与当前地址不同：整页跳转到本次要去的地址', () => {
    const { deps, calls, storage } = createFakeDeps({ currentPath: '/rule1/1' })
    const recovery = createChunkRecovery(deps)

    expect(recovery.handleFailure(CHROME_ERROR, '/stepone/1')).toBe(true)
    expect(calls.navigateTo).toEqual(['/stepone/1'])
    expect(calls.reloads).toBe(0)
    expect(reloadRecord(storage)).toEqual({ path: '/stepone/1', at: 1_000_000 })
  })

  it('目标地址就是当前地址：用 reload 而不是 assign', () => {
    const { deps, calls } = createFakeDeps({ currentPath: '/rule1/1' })
    const recovery = createChunkRecovery(deps)

    expect(recovery.handleFailure(CHROME_ERROR, '/rule1/1')).toBe(true)
    expect(calls.reloads).toBe(1)
    expect(calls.navigateTo).toEqual([])
  })

  it('没有导航目标时用当前地址兜底', () => {
    const { deps, calls, storage } = createFakeDeps({ currentPath: '/detail/3' })
    const recovery = createChunkRecovery(deps)

    expect(recovery.handleFailure(SAFARI_ERROR)).toBe(true)
    expect(calls.reloads).toBe(1)
    expect(reloadRecord(storage)).toEqual({ path: '/detail/3', at: 1_000_000 })
  })

  it('preloadError 与 onError 对同一次失败各发一弹，也只重载一次且不报"已放弃"', () => {
    const { deps, calls } = createFakeDeps({ currentPath: '/rule1/1' })
    const recovery = createChunkRecovery(deps)

    expect(recovery.handleFailure(CSS_PRELOAD_ERROR, '/stepone/1')).toBe(true)
    expect(recovery.handleFailure(CHROME_ERROR, '/stepone/1')).toBe(false)
    expect(calls.navigateTo).toEqual(['/stepone/1'])
    expect(calls.hints).toEqual([])
  })

  it('同一地址不重复重载：跨文档时靠 sessionStorage 拦住并留下提示', () => {
    const { deps, calls, storage } = createFakeDeps({
      currentPath: '/rule1/1',
      initial: { [CHUNK_RELOAD_KEY]: JSON.stringify({ path: '/stepone/1', at: 900_000 }) },
    })
    const recovery = createChunkRecovery(deps)

    expect(recovery.handleFailure(CHROME_ERROR, '/stepone/1')).toBe(false)
    expect(calls.navigateTo).toEqual([])
    expect(calls.hints.map((hint) => hint.reason)).toEqual(['already-reloaded'])
    // 提示同时写进 sessionStorage，供阶段 4 的版本提示 UI 读取
    const hint = JSON.parse(storage.getItem(CHUNK_RELOAD_HINT_KEY) ?? '{}') as ChunkRecoveryHint
    expect(hint).toEqual({ path: '/stepone/1', reason: 'already-reloaded', at: 1_000_000 })
  })

  it('冷却期内换地址也不刷；过了冷却窗口才允许', () => {
    const { deps, calls, clock, storage } = createFakeDeps({ currentPath: '/rule1/1' })
    const recovery = createChunkRecovery(deps, { cooldownMs: 10_000 })

    expect(recovery.handleFailure(CHROME_ERROR, '/stepone/1')).toBe(true)

    // 新实例模拟"新文档里另一个地址又坏了"
    clock.now = 1_005_000
    const second = createChunkRecovery(deps, { cooldownMs: 10_000 })
    expect(second.handleFailure(CHROME_ERROR, '/rule2/1')).toBe(false)
    expect(calls.hints.map((hint) => hint.reason)).toEqual(['cooldown'])

    clock.now = 1_011_000
    const third = createChunkRecovery(deps, { cooldownMs: 10_000 })
    expect(third.handleFailure(CHROME_ERROR, '/rule2/1')).toBe(true)
    expect(calls.navigateTo).toEqual(['/stepone/1', '/rule2/1'])
    expect(reloadRecord(storage)?.path).toBe('/rule2/1')
  })

  it('真正到达目标地址后释放记录，之后同地址还能再自愈', () => {
    const { deps, calls, storage } = createFakeDeps({ currentPath: '/rule1/1' })
    const recovery = createChunkRecovery(deps)

    expect(recovery.handleFailure(CHROME_ERROR, '/stepone/1')).toBe(true)
    expect(reloadRecord(storage)).not.toBeNull()

    recovery.confirmNavigation('/rule2/1')
    expect(reloadRecord(storage)).not.toBeNull() // 别的地址不该释放

    recovery.confirmNavigation('/stepone/1')
    expect(reloadRecord(storage)).toBeNull()
    expect(storage.getItem(CHUNK_RELOAD_HINT_KEY)).toBeNull()

    // 新版本又坏了一次（例如 CDN 还没刷干净）：还能再自愈一次
    const again = createChunkRecovery(deps)
    expect(again.handleFailure(CHROME_ERROR, '/stepone/1')).toBe(true)
    expect(calls.navigateTo).toEqual(['/stepone/1', '/stepone/1'])
  })

  it('非 chunk 错误：不动地址、不写记录、不提示', () => {
    const { deps, calls, storage } = createFakeDeps()
    const recovery = createChunkRecovery(deps)

    expect(recovery.handleFailure(new Error('Failed to fetch'), '/detail/1')).toBe(false)
    expect(calls).toEqual({ navigateTo: [], reloads: 0, hints: [] })
    expect(storage.dump()).toEqual({})
  })

  it('断网时放弃重载，只留 offline 提示', () => {
    const { deps, calls, storage } = createFakeDeps({ offline: true })
    const recovery = createChunkRecovery(deps)

    expect(recovery.handleFailure(CHROME_ERROR, '/stepone/1')).toBe(false)
    expect(calls.navigateTo).toEqual([])
    expect(calls.hints.map((hint) => hint.reason)).toEqual(['offline'])
    expect(storage.getItem(CHUNK_RELOAD_KEY)).toBeNull()
  })

  it('sessionStorage 不可用（Safari 无痕）时不冒险重载', () => {
    const { deps, calls } = createFakeDeps({ noStorage: true })
    const recovery = createChunkRecovery(deps)

    expect(recovery.handleFailure(CHROME_ERROR, '/stepone/1')).toBe(false)
    expect(calls.navigateTo).toEqual([])
    expect(calls.hints.map((hint) => hint.reason)).toEqual(['unavailable-storage'])
  })

  it('setItem 抛错时放弃，而不是反复刷新', () => {
    const { deps, calls } = createFakeDeps({ throwOnSet: true })
    const recovery = createChunkRecovery(deps)

    expect(recovery.handleFailure(CHROME_ERROR, '/stepone/1')).toBe(false)
    expect(calls.navigateTo).toEqual([])
    expect(calls.hints.map((hint) => hint.reason)).toEqual(['unavailable-storage'])
  })
})

describe('部署 base 拼接', () => {
  it('normalizeBase 补齐首尾斜杠', () => {
    expect(normalizeBase(undefined)).toBe('/')
    expect(normalizeBase('')).toBe('/')
    expect(normalizeBase('/app')).toBe('/app/')
    expect(normalizeBase('/app/')).toBe('/app/')
    expect(normalizeBase('app')).toBe('/app/')
  })

  it('stripBase / withBase 与 Vite 的 BASE_URL 约定一致', () => {
    expect(stripBase('/rule1/1', '/')).toBe('/rule1/1')
    expect(stripBase('/app/rule1/1', '/app/')).toBe('/rule1/1')
    expect(stripBase('/app/', '/app/')).toBe('/')
    expect(stripBase('/', '/app/')).toBe('/')
    expect(withBase('/rule1/1', '/')).toBe('/rule1/1')
    expect(withBase('/rule1/1?x=1', '/app/')).toBe('/app/rule1/1?x=1')
    expect(withBase('rule1/1', '/app/')).toBe('/app/rule1/1')
  })
})

describe('registerChunkRecovery - 与 vue-router 的真实接线', () => {
  /**
   * @param recoverAfterReload 第一次加载失败、之后成功，用来验证 afterEach 会释放记录
   */
  function createWiredRouter(recoverAfterReload = false): Router {
    let attempt = 0
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: Stub },
        { path: '/rule1/:id', name: 'rule1', component: Stub },
        {
          path: '/stepone/:id',
          name: 'stepone',
          // 模拟旧版本遗留的 chunk：文件已下线，动态 import 失败
          component: () => {
            attempt += 1
            return recoverAfterReload && attempt > 1
              ? // __esModule 标记模拟 Vite 动态 import 返回的 ESM 命名空间
                Promise.resolve({ default: Stub, __esModule: true })
              : Promise.reject(CHROME_ERROR)
          },
        },
      ],
    })
  }

  it('普通导航照常放行（记录 pendingPath 的钩子不能被当成重定向）', async () => {
    const { deps, calls } = createFakeDeps()
    const router = createWiredRouter()
    registerChunkRecovery(router, deps)

    await router.push('/rule1/1')
    expect(router.currentRoute.value.name).toBe('rule1')
    expect(calls.navigateTo).toEqual([])
    expect(calls.reloads).toBe(0)
  })

  it('懒加载失败：整页重载到导航目标地址，而不是当前地址', async () => {
    const { deps, calls, storage } = createFakeDeps({ currentPath: '/rule1/1' })
    const router = createWiredRouter()
    registerChunkRecovery(router, deps)

    await router.push('/rule1/1')
    await router.push('/stepone/1').catch(() => {
      // 组件加载失败会让 push 一起 reject，这里只关心自愈行为
    })

    expect(router.currentRoute.value.name).toBe('rule1') // 导航没成功
    expect(calls.navigateTo).toEqual(['/stepone/1']) // 但重载目标是 stepone
    expect(reloadRecord(storage)?.path).toBe('/stepone/1')
  })

  it('真正到达目标地址后由 afterEach 释放记录', async () => {
    const { deps, calls, storage } = createFakeDeps({ currentPath: '/rule1/1' })
    const router = createWiredRouter(true)
    registerChunkRecovery(router, deps)

    await router.push('/rule1/1')
    await router.push('/stepone/1').catch(() => {})
    expect(reloadRecord(storage)?.path).toBe('/stepone/1')
    expect(calls.navigateTo).toEqual(['/stepone/1'])

    // 模拟"新文档真的到达了 /stepone/1"：同地址的成功导航会走 afterEach
    await router.push('/stepone/1')
    expect(router.currentRoute.value.name).toBe('stepone')
    expect(reloadRecord(storage)).toBeNull()
    expect(calls.navigateTo).toEqual(['/stepone/1']) // 全程只安排过一次重载
  })

  it('Vite 的 vite:preloadError 事件也触发自愈，且不吞掉默认行为', () => {
    const { deps, calls } = createFakeDeps({ currentPath: '/rule1/1' })
    const router = createWiredRouter()
    registerChunkRecovery(router, deps)

    const event = preloadErrorEvent(CSS_PRELOAD_ERROR)
    window.dispatchEvent(event)

    expect(calls.reloads).toBe(1) // 没有导航目标 → 重载当前地址
    expect(calls.navigateTo).toEqual([])
    expect(event.defaultPrevented).toBe(false) // 不 preventDefault，让 router.onError 也能看到
  })

  it('卸载函数会摘掉事件监听与路由钩子', async () => {
    const { deps, calls } = createFakeDeps({ currentPath: '/rule1/1' })
    const router = createWiredRouter()
    const unregister = registerChunkRecovery(router, deps)

    unregister()

    window.dispatchEvent(preloadErrorEvent(CSS_PRELOAD_ERROR))
    expect(calls.reloads).toBe(0)
    expect(calls.navigateTo).toEqual([])

    // 钩子摘掉后 vue-router 会自己 console.error，这里静音，只验证"不再自愈"
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await router.push('/stepone/1').catch(() => {})
    consoleError.mockRestore()
    expect(calls.navigateTo).toEqual([])
  })

  it('对外常量稳定（阶段 4 的 UI 与排查脚本要靠它们对接）', () => {
    expect(CHUNK_RELOAD_FAILED_EVENT).toBe('wenyan:chunk-reload-failed')
    expect(CHUNK_RELOAD_KEY).toBe('wenyan:chunk-reload')
    expect(CHUNK_RELOAD_HINT_KEY).toBe('wenyan:chunk-reload-hint')
  })
})
