/**
 * 新版本探测与提示数据（发布新鲜度阶段 4）
 *
 * 只做一件事：定期用与用户刷新时**完全相同**的路径去取 index.html，比对版本指纹，
 * 发现不同就派发一个事件，由界面提示用户「可以刷新了」。
 *
 * 两条硬约束：
 * 1. **绝不自动刷新**。学生可能正在答题，页面被刷掉就是丢数据 —— 方案里定的就是只提示。
 *    这里的「刷新页面」按钮由用户点击，属于用户主动行为。
 * 2. 探测失败一律静默（仅开发环境留一行日志）。这是锦上添花的提示，
 *    不能变成控制台里的新错误源，更不能因为探测挂了影响正常页面。
 *
 * 阶段 3（chunkRecovery）放弃自动重载时会写一条 hint 并派发事件；
 * 那些文案的「给用户看的那句话」也放在本模块，组件只管展示，不承载判断。
 */
import { getBuildId, LOCAL_BUILD_ID } from '@/utils/buildStamp'
import { debugWarn } from '@/utils/debug'
import {
  CHUNK_RELOAD_HINT_KEY,
  normalizeBase,
  withBase,
  type ChunkRecoveryHint,
  type ChunkRecoveryStorageLike,
} from '@/utils/chunkRecovery'

/** 版本指纹；kind 决定 value 的口径，两种口径之间不互相比较 */
export interface VersionFingerprint {
  kind: 'build-id' | 'entry-chunk'
  value: string
}

/** 检测到新版本时派发的事件名，detail 是 VersionFingerprint */
export const NEW_VERSION_EVENT = 'wenyan:new-version'

/** 用户点了「稍后再说」之后，这个指纹在本会话内不再提示 */
export const NEW_VERSION_DISMISS_KEY = 'wenyan:new-version-dismissed'

/** 定时探测间隔：10 分钟。页面挂一节课也不会多打几个请求 */
export const PROBE_INTERVAL_MS = 10 * 60 * 1000

/** 两次探测的最小间隔：切回标签页会连着触发可见性事件，别打成一串请求 */
export const PROBE_MIN_GAP_MS = 60 * 1000

const BUILD_ID_META_RE = /<meta[^>]+name=["']build-id["'][^>]*content=["']([^"']+)["']/i
// Vite 现在输出的是 name 在前，但 HTML 属性顺序不保证，两种都认
const BUILD_ID_META_REVERSED_RE = /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']build-id["']/i
const ENTRY_CHUNK_RE = /\/assets\/index-[A-Za-z0-9_-]+\.js/

/** 从 index.html 文本里取版本指纹；两种口径都没有就返回 null */
export function parseFingerprint(html: string | null | undefined): VersionFingerprint | null {
  if (!html) return null

  const meta = BUILD_ID_META_RE.exec(html)?.[1] ?? BUILD_ID_META_REVERSED_RE.exec(html)?.[1]
  const buildId = (meta ?? '').trim().toLowerCase()
  if (buildId) return { kind: 'build-id', value: buildId }

  const chunk = ENTRY_CHUNK_RE.exec(html)?.[0]
  if (chunk) return { kind: 'entry-chunk', value: chunk }

  return null
}

/** 本页面自己的指纹；本地开发（没有真实构建号）不参与探测 */
export function getLocalFingerprint(): VersionFingerprint | null {
  const buildId = getBuildId()
  return buildId === LOCAL_BUILD_ID ? null : { kind: 'build-id', value: buildId }
}

/** 口径相同且值不同才算「有更新」；口径不同宁可不说，避免误报 */
export function isUpdatable(
  local: VersionFingerprint | null,
  remote: VersionFingerprint | null,
): boolean {
  if (!local || !remote) return false
  return local.kind === remote.kind && local.value !== remote.value
}

/** 节流判断：从未查过、到了间隔、或时钟回拨，都允许查 */
export function shouldCheck(
  lastStartedAt: number | null,
  nowAt: number,
  minGapMs: number = PROBE_MIN_GAP_MS,
): boolean {
  if (lastStartedAt === null) return true
  if (nowAt < lastStartedAt) return true
  return nowAt - lastStartedAt >= minGapMs
}

/** 指纹在存储里的键值，同一份文档 / 同一会话都靠它去重 */
export function fingerprintKey(fingerprint: VersionFingerprint): string {
  return `${fingerprint.kind}:${fingerprint.value}`
}

/** 记住用户已经「稍后再说」过的指纹，本会话不再重复提示 */
export function dismissVersion(
  fingerprint: VersionFingerprint | null,
  storage: ChunkRecoveryStorageLike | null = readVersionStorage(),
): void {
  if (!fingerprint || !storage) return
  try {
    storage.setItem(NEW_VERSION_DISMISS_KEY, fingerprintKey(fingerprint))
  } catch {
    // 写不进去就算了：最坏是多提示一次，不影响功能
  }
}

function readDismissed(storage: ChunkRecoveryStorageLike | null): string | null {
  if (!storage) return null
  try {
    return storage.getItem(NEW_VERSION_DISMISS_KEY)
  } catch {
    return null
  }
}

/**
 * 读 sessionStorage；隐私模式 / 被禁用时返回 null。
 * 必须真的试读一次：Safari 无痕模式下光是访问 sessionStorage 就会抛。
 */
export function readVersionStorage(): ChunkRecoveryStorageLike | null {
  try {
    const storage = window.sessionStorage
    if (!storage) return null
    storage.getItem(NEW_VERSION_DISMISS_KEY)
    return storage
  } catch {
    return null
  }
}

/**
 * 阶段 3 留下的「本次没能自动重载」记录有效期。
 * 超时的旧记录不再弹：那次失败多半已经被后面的正常导航盖过去了，
 * 留一条「请刷新」在下面反而是误导。
 */
export const RECOVERY_HINT_TTL_MS = 10 * 60 * 1000

export function isRecoveryHintFresh(
  hint: ChunkRecoveryHint | null | undefined,
  nowAt: number,
): boolean {
  if (!hint) return false
  return nowAt - hint.at <= RECOVERY_HINT_TTL_MS && nowAt - hint.at >= 0
}

/**
 * 阶段 3 留下的「本次没能自动重载」记录。
 * 组件挂载时读一次，补上「事件先于组件监听就绪」那一段窗口。
 */
export function readRecoveryHint(
  storage: ChunkRecoveryStorageLike | null = readVersionStorage(),
): ChunkRecoveryHint | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(CHUNK_RELOAD_HINT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ChunkRecoveryHint>
    if (typeof parsed.path !== 'string' || typeof parsed.at !== 'number') return null
    if (!isRecoveryReason(parsed.reason)) return null
    return { path: parsed.path, reason: parsed.reason, at: parsed.at }
  } catch {
    return null
  }
}

const RECOVERY_REASONS: readonly ChunkRecoveryHint['reason'][] = [
  'offline',
  'already-reloaded',
  'cooldown',
  'unavailable-storage',
]

function isRecoveryReason(value: unknown): value is ChunkRecoveryHint['reason'] {
  return RECOVERY_REASONS.includes(value as ChunkRecoveryHint['reason'])
}

/** 用户处理完之后清掉，否则下次进页面还会看到同一条旧提示 */
export function clearRecoveryHint(
  storage: ChunkRecoveryStorageLike | null = readVersionStorage(),
): void {
  if (!storage) return
  try {
    storage.removeItem(CHUNK_RELOAD_HINT_KEY)
  } catch {
    // 清不掉就算了：最坏是提示多留一次
  }
}

/**
 * 阶段 3 的放弃原因 → 给学生/老师看的一句话。
 * 用 Record 而不是 switch：以后 ChunkRecoveryHint 加了新 reason，这里编译期就会漏。
 */
const RECOVERY_HINT_COPY: Record<ChunkRecoveryHint['reason'], string> = {
  offline: '网络暂时连不上，页面需要的文件没能加载。等网络恢复后刷新页面即可。',
  'already-reloaded': '已经自动刷新过一次还是没拿到最新页面，请稍后手动刷新，或告诉老师。',
  cooldown: '短时间内连续有页面加载失败，这次先不自动刷新，请稍后手动刷新页面。',
  'unavailable-storage': '浏览器不允许记录刷新状态，这次没有自动刷新，请手动刷新页面。',
}

export function describeRecoveryHint(hint: ChunkRecoveryHint | null | undefined): string {
  if (!hint) return ''
  return RECOVERY_HINT_COPY[hint.reason] ?? RECOVERY_HINT_COPY.cooldown
}

export type ProbeOutcome =
  | 'notified'
  | 'already-notified'
  | 'dismissed'
  | 'up-to-date'
  | 'unknown'
  | 'skipped'

export interface VersionProbeDeps {
  /** 取线上 index.html 文本；失败请抛错，由探测层吞掉 */
  fetchIndexHtml: () => Promise<string>
  getLocalFingerprint: () => VersionFingerprint | null
  emitNewVersion: (remote: VersionFingerprint) => void
  getStorage: () => ChunkRecoveryStorageLike | null
  now: () => number
  /** 离线时不发请求，也不提示 */
  isOffline: () => boolean
}

export interface VersionProbe {
  check: () => Promise<ProbeOutcome>
  /** 已经提示过的指纹，同一份文档只提示一次 */
  notifiedFingerprint: () => string | null
}

export function createVersionProbe(deps: VersionProbeDeps): VersionProbe {
  let notified: string | null = null

  return {
    notifiedFingerprint: () => notified,
    async check() {
      if (deps.isOffline()) return 'skipped'

      let html: string
      try {
        html = await deps.fetchIndexHtml()
      } catch {
        // 探测请求失败不提示、不重试：用户正在用的页面没有受影响
        return 'skipped'
      }

      const remote = parseFingerprint(html)
      const local = deps.getLocalFingerprint()
      if (!remote || !local) return 'unknown'
      if (!isUpdatable(local, remote)) return 'up-to-date'

      const key = fingerprintKey(remote)
      if (notified === key) return 'already-notified'
      if (readDismissed(deps.getStorage()) === key) return 'dismissed'

      notified = key
      try {
        deps.emitNewVersion(remote)
      } catch {
        // 监听方报错不影响探测本身
      }
      debugWarn('[buildVersion] 发现新版本，已提示用户', key)
      return 'notified'
    },
  }
}

function createBrowserDeps(): VersionProbeDeps {
  // base 是部署子路径用的（当前生产/测试都在根路径），和整页重载走同一套拼接
  const base = normalizeBase(import.meta.env.BASE_URL)
  const url = withBase('/index.html', base)

  return {
    async fetchIndexHtml() {
      // 不加时间戳参数：探测要走的就是用户刷新时会走的那条路径。
      // index.html 本身是 no-cache，加时间戳只会绕过边缘节点，反而测出「线上并不提供的那份」。
      const response = await fetch(url, { cache: 'no-store', credentials: 'omit' })
      if (!response.ok) throw new Error(`index.html ${response.status}`)
      return response.text()
    },
    getLocalFingerprint,
    emitNewVersion: (remote) => {
      window.dispatchEvent(new CustomEvent(NEW_VERSION_EVENT, { detail: remote }))
    },
    getStorage: readVersionStorage,
    now: () => Date.now(),
    isOffline: () => typeof navigator !== 'undefined' && navigator.onLine === false,
  }
}

/**
 * 接线：定时 + 页面重新可见时探测。返回卸载函数。
 *
 * 首屏不查 —— 这份页面本身就是刚从 index.html 加载的，再问一次「有没有新版」是白费一个请求。
 */
export function registerVersionProbe(
  overrides: Partial<VersionProbeDeps> = {},
): () => void {
  const deps: VersionProbeDeps = { ...createBrowserDeps(), ...overrides }
  const probe = createVersionProbe(deps)

  let lastStartedAt: number | null = null

  const runCheck = () => {
    const nowAt = deps.now()
    if (!shouldCheck(lastStartedAt, nowAt)) return
    lastStartedAt = nowAt
    void probe.check()
  }

  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') runCheck()
  }

  const intervalId = window.setInterval(runCheck, PROBE_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    window.clearInterval(intervalId)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

/**
 * 用户点「刷新页面」时才调用；本模块没有任何路径会自动触发它。
 * 单独包一层是为了让单测能替换，不用真的去操作 location。
 */
export function requestManualRefresh(
  reload: () => void = () => window.location.reload()
): void {
  reload()
}
