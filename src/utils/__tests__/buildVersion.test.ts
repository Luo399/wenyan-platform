/**
 * buildVersion 单测（发布新鲜度方案 · 阶段 4）
 *
 * 锁死四件事：
 * 1. 指纹口径不混用：build-id 只和 build-id 比，拿不到就返回 null，绝不猜「有更新」。
 * 2. 探测失败 / 离线一律静默，且不会自己刷页面 —— 只派发事件。
 * 3. 同一份新构建在一篇文档里只提示一次；用户点过「稍后再说」就不再唠叨。
 * 4. 节流：首屏不查、10 分钟一次、切回标签页不能打成一串请求。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 日志在单测里静音：本模块的 debugWarn 只在开发环境有意义
vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}))

import {
  CHUNK_RELOAD_HINT_KEY,
  type ChunkRecoveryHint,
  type ChunkRecoveryStorageLike,
} from '@/utils/chunkRecovery'
import {
  NEW_VERSION_DISMISS_KEY,
  NEW_VERSION_EVENT,
  PROBE_INTERVAL_MS,
  PROBE_MIN_GAP_MS,
  RECOVERY_HINT_TTL_MS,
  clearRecoveryHint,
  createVersionProbe,
  describeRecoveryHint,
  dismissVersion,
  fingerprintKey,
  getLocalFingerprint,
  isRecoveryHintFresh,
  isUpdatable,
  parseFingerprint,
  readRecoveryHint,
  registerVersionProbe,
  shouldCheck,
  type VersionFingerprint,
  type VersionProbeDeps,
} from '@/utils/buildVersion'

function createMemoryStorage(): ChunkRecoveryStorageLike & { dump: Map<string, string> } {
  const dump = new Map<string, string>()
  return {
    dump,
    getItem: (key: string) => dump.get(key) ?? null,
    setItem: (key: string, value: string) => {
      dump.set(key, value)
    },
    removeItem: (key: string) => {
      dump.delete(key)
    },
  }
}

const BUILD_ID_META = '<!doctype html><html><head><meta name="build-id" content="A1B2C3D"><title>x</title></head><body></body></html>'
const ENTRY_CHUNK_HTML =
  '<!doctype html><html><head></head><body><script type="module" src="/assets/index-PXv-Td1Z.js"></script></body></html>'

describe('parseFingerprint', () => {
  it('优先取 meta build-id，并统一成小写', () => {
    expect(parseFingerprint(BUILD_ID_META)).toEqual({ kind: 'build-id', value: 'a1b2c3d' })
  })

  it('属性顺序颠倒（content 在前）也认', () => {
    const html = '<meta content="deadbe" name="build-id">'
    expect(parseFingerprint(html)).toEqual({ kind: 'build-id', value: 'deadbe' })
  })

  it('没有 meta 时退回入口 chunk 文件名', () => {
    expect(parseFingerprint(ENTRY_CHUNK_HTML)).toEqual({
      kind: 'entry-chunk',
      value: '/assets/index-PXv-Td1Z.js',
    })
  })

  it('空串 / 非字符串 / 既无 meta 又无入口 chunk 都给不出指纹', () => {
    expect(parseFingerprint('')).toBeNull()
    expect(parseFingerprint(null)).toBeNull()
    expect(parseFingerprint('<html><body>只有正文</body></html>')).toBeNull()
  })
})

describe('getLocalFingerprint', () => {
  it('本页面指纹与构建号同源：vitest 注入的是 abc1234', () => {
    expect(getLocalFingerprint()).toEqual({ kind: 'build-id', value: 'abc1234' })
  })
})

describe('isUpdatable', () => {
  const local: VersionFingerprint = { kind: 'build-id', value: 'abc1234' }

  it('同口径不同值才算有更新', () => {
    expect(isUpdatable(local, { kind: 'build-id', value: '4b44b2f' })).toBe(true)
    expect(isUpdatable(local, { kind: 'build-id', value: 'abc1234' })).toBe(false)
  })

  it('口径不同不比较，缺一边也不比较（宁可不提示，也不误报）', () => {
    expect(isUpdatable(local, { kind: 'entry-chunk', value: '/assets/index-abc.js' })).toBe(false)
    expect(isUpdatable(null, local)).toBe(false)
    expect(isUpdatable(local, null)).toBe(false)
  })
})

describe('shouldCheck 与 fingerprintKey', () => {
  it('从未查过、到了间隔、时钟回拨都允许查；间隔内不允许', () => {
    expect(shouldCheck(null, 1_000)).toBe(true)
    expect(shouldCheck(1_000, 1_000 + PROBE_MIN_GAP_MS)).toBe(true)
    expect(shouldCheck(1_000, 1_000 + PROBE_MIN_GAP_MS - 1)).toBe(false)
    expect(shouldCheck(5_000, 1_000)).toBe(true)
  })

  it('指纹键把口径一起编进去，两种口径不会互相顶掉', () => {
    expect(fingerprintKey({ kind: 'build-id', value: 'abc1234' })).toBe('build-id:abc1234')
  })
})

describe('dismissVersion / 阶段 3 hint 的读写与文案', () => {
  it('「稍后再说」记住的是具体指纹，换一个新构建还能再提示', () => {
    const storage = createMemoryStorage()
    dismissVersion({ kind: 'build-id', value: '4b44b2f' }, storage)
    expect(storage.dump.get(NEW_VERSION_DISMISS_KEY)).toBe('build-id:4b44b2f')
  })

  it('存储为 null 时不抛错（Safari 无痕下 sessionStorage 直接访问就会抛）', () => {
    expect(() => dismissVersion({ kind: 'build-id', value: 'x' }, null)).not.toThrow()
    expect(readRecoveryHint(null)).toBeNull()
    expect(() => clearRecoveryHint(null)).not.toThrow()
  })

  function hint(reason: ChunkRecoveryHint['reason'], at = 1000): ChunkRecoveryHint {
    return { path: '/stepone/3', reason, at }
  }

  it('hint 能写能读能清，字段不合法的旧值按「没有」处理', () => {
    const storage = createMemoryStorage()
    expect(readRecoveryHint(storage)).toBeNull()

    storage.setItem(CHUNK_RELOAD_HINT_KEY, JSON.stringify(hint('cooldown')))
    expect(readRecoveryHint(storage)).toEqual(hint('cooldown'))

    clearRecoveryHint(storage)
    expect(readRecoveryHint(storage)).toBeNull()

    storage.setItem(CHUNK_RELOAD_HINT_KEY, 'not json')
    expect(readRecoveryHint(storage)).toBeNull()

    storage.setItem(CHUNK_RELOAD_HINT_KEY, JSON.stringify({ path: '/x', at: 1 }))
    expect(readRecoveryHint(storage)).toBeNull()
  })

  it('四种放弃原因都有给用户的一句话，且互不相同', () => {
    const reasons: ChunkRecoveryHint['reason'][] = [
      'offline',
      'already-reloaded',
      'cooldown',
      'unavailable-storage',
    ]
    const texts = reasons.map((reason) => describeRecoveryHint(hint(reason)))
    texts.forEach((text) => expect(text.length).toBeGreaterThan(10))
    expect(new Set(texts).size).toBe(reasons.length)
    expect(describeRecoveryHint(null)).toBe('')
  })

  it('超出有效期的旧 hint 不再提示', () => {
    const at = 100_000
    expect(isRecoveryHintFresh(hint('cooldown', at), at + RECOVERY_HINT_TTL_MS)).toBe(true)
    expect(isRecoveryHintFresh(hint('cooldown', at), at + RECOVERY_HINT_TTL_MS + 1)).toBe(false)
    // 时间比现在还早（时钟被改）也当旧记录处理
    expect(isRecoveryHintFresh(hint('cooldown', at), at - 1)).toBe(false)
    expect(isRecoveryHintFresh(null, at)).toBe(false)
  })
})

interface ProbeHarness {
  deps: VersionProbeDeps
  html: (value: string | null) => void
  emit: ReturnType<typeof vi.fn>
}

function createHarness(): ProbeHarness {
  let currentHtml: string | null = BUILD_ID_META
  const emit = vi.fn()
  const deps: VersionProbeDeps = {
    fetchIndexHtml: vi.fn(async () => {
      if (currentHtml === null) throw new Error('index.html 404')
      return currentHtml
    }),
    getLocalFingerprint: () => ({ kind: 'build-id', value: 'abc1234' }),
    emitNewVersion: emit,
    getStorage: () => createMemoryStorage(),
    now: () => 5_000,
    isOffline: () => false,
  }
  return {
    deps,
    emit,
    html: (value) => {
      currentHtml = value
    },
  }
}

describe('createVersionProbe', () => {
  it('线上换了构建号 → 派发一次事件，同一份新构建不重复提示', async () => {
    const harness = createHarness()
    const probe = createVersionProbe(harness.deps)

    await expect(probe.check()).resolves.toBe('notified')
    expect(harness.emit).toHaveBeenCalledWith({ kind: 'build-id', value: 'a1b2c3d' })

    await expect(probe.check()).resolves.toBe('already-notified')
    expect(harness.emit).toHaveBeenCalledTimes(1)
    expect(probe.notifiedFingerprint()).toBe('build-id:a1b2c3d')
  })

  it('线上还是同一份构建 → 不打扰用户', async () => {
    const harness = createHarness()
    harness.deps.getLocalFingerprint = () => ({ kind: 'build-id', value: 'a1b2c3d' })
    const probe = createVersionProbe(harness.deps)

    await expect(probe.check()).resolves.toBe('up-to-date')
    expect(harness.emit).not.toHaveBeenCalled()
  })

  it('用户点过「稍后再说」→ 同一指纹不再提示', async () => {
    const harness = createHarness()
    const storage = createMemoryStorage()
    harness.deps.getStorage = () => storage
    const probe = createVersionProbe(harness.deps)

    await expect(probe.check()).resolves.toBe('notified')
    dismissVersion({ kind: 'build-id', value: 'a1b2c3d' }, storage)

    // 换个新探测对象（模拟另一篇文档 / 定时器重启），也不能再提示同一个
    const next = createVersionProbe(harness.deps)
    await expect(next.check()).resolves.toBe('dismissed')
    expect(next.notifiedFingerprint()).toBeNull()
  })

  it('离线不发请求；请求失败静默；拿不到指纹只说 unknown', async () => {
    const harness = createHarness()
    harness.deps.isOffline = () => true
    const probe = createVersionProbe(harness.deps)
    await expect(probe.check()).resolves.toBe('skipped')
    expect(harness.deps.fetchIndexHtml).not.toHaveBeenCalled()

    harness.deps.isOffline = () => false
    harness.html(null)
    await expect(probe.check()).resolves.toBe('skipped')

    harness.html('<html><body>网关错误页</body></html>')
    await expect(probe.check()).resolves.toBe('unknown')
    expect(harness.emit).not.toHaveBeenCalled()
  })

  it('本地开发（没有真实构建号）不提示', async () => {
    const harness = createHarness()
    harness.deps.getLocalFingerprint = () => null
    const probe = createVersionProbe(harness.deps)
    await expect(probe.check()).resolves.toBe('unknown')
    expect(harness.emit).not.toHaveBeenCalled()
  })

  it('监听方抛错不污染探测，也不影响事件本身', async () => {
    const harness = createHarness()
    harness.deps.emitNewVersion = () => {
      throw new Error('组件里报错了')
    }
    const probe = createVersionProbe(harness.deps)

    await expect(probe.check()).resolves.toBe('notified')
  })
})

describe('registerVersionProbe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('首屏不查，到间隔才查', async () => {
    const fetchIndexHtml = vi.fn(async () => BUILD_ID_META)
    const unregister = registerVersionProbe({
      fetchIndexHtml,
      getLocalFingerprint: () => ({ kind: 'build-id', value: 'abc1234' }),
      getStorage: () => createMemoryStorage(),
      now: () => Date.now(),
      isOffline: () => false,
      emitNewVersion: () => undefined,
    })

    expect(fetchIndexHtml).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS)
    expect(fetchIndexHtml).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS)
    expect(fetchIndexHtml).toHaveBeenCalledTimes(2)

    unregister()
    await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS)
    expect(fetchIndexHtml).toHaveBeenCalledTimes(2)
  })

  it('页面反复可见时受最小间隔节流，不会打成一串请求', async () => {
    const fetchIndexHtml = vi.fn(async () => BUILD_ID_META)
    let clock = 1_000
    const unregister = registerVersionProbe({
      fetchIndexHtml,
      getLocalFingerprint: () => ({ kind: 'build-id', value: 'abc1234' }),
      getStorage: () => createMemoryStorage(),
      now: () => clock,
      isOffline: () => false,
      emitNewVersion: () => undefined,
    })

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })

    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchIndexHtml).toHaveBeenCalledTimes(1)

    // 连着切回标签页：还在最小间隔内
    clock += 1_000
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchIndexHtml).toHaveBeenCalledTimes(1)

    clock += PROBE_MIN_GAP_MS
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchIndexHtml).toHaveBeenCalledTimes(2)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    clock += PROBE_INTERVAL_MS
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchIndexHtml).toHaveBeenCalledTimes(2)

    // 还原：把实例上的覆盖删掉，回到 happy-dom 自己的实现
    delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState
    unregister()
  })

  it('不覆写 emitNewVersion 时，探测结果就是 window 上的自定义事件', async () => {
    const listener = vi.fn()
    window.addEventListener(NEW_VERSION_EVENT, listener)

    // 只替掉取 HTML 这一步，派发走浏览器默认实现（和线上完全一致）
    const unregister = registerVersionProbe({
      fetchIndexHtml: async () => BUILD_ID_META,
      getLocalFingerprint: () => ({ kind: 'build-id', value: 'abc1234' }),
    })

    await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS)
    expect(listener).toHaveBeenCalledTimes(1)
    const event = listener.mock.calls[0][0] as CustomEvent<VersionFingerprint>
    expect(event.detail).toEqual({ kind: 'build-id', value: 'a1b2c3d' })

    window.removeEventListener(NEW_VERSION_EVENT, listener)
    unregister()
  })
})
