/**
 * useNavigation - 统一导航Composable
 *
 * 功能：
 * - 提供统一的跳转函数
 * - 当前所有页面共用 poemId，跨页跳转直接透传 currentId
 * - 支持自定义 ID（用于跨页面跳转）
 * - 提供 goHome() 用于非顺序页面（如 NotFoundView）返回首页
 *
 * 使用方式：
 * ```ts
 * // 顺序页面：可以不传，内部实时读当前路由
 * const { goNext, goPrev, goHome } = useNavigation()
 *
 * // 需要覆盖时传入提示值（非顺序页面 / 测试）
 * const { goNext } = useNavigation('rules', '1')
 *
 * // 在模板中
 * <BackContinue @back="goPrev()" @continue="goNext()" />
 * ```
 *
 * R140（跨浏览器「点继续没反应」根因修复）：
 * `rules / rule1 / rule2 / rule3` 四条路由指向同一个 RuleVideoView，
 * `stepone / steptwo / stepthree` 三条路由指向同一个 StepView。
 * vue-router 的 RouterView 不给路由组件设置 vnode key
 * （已在 node_modules/vue-router/dist/vue-router.esm-browser.js 的 RouterViewImpl 中确认），
 * 所以在这组路由之间跳转时 **组件实例被复用、setup 不会重跑**。
 * 旧实现把 `props.navKey` / `route.params.id` 作为普通值在 setup 里一次性捕获，
 * 于是从 /rules/1 进到 /rule1/1 后，currentRouteName 仍冻结在 'rules'，
 * goNext 算出的目标路径正好等于当前地址，vue-router 按重复导航静默丢弃，
 * 生产环境 debugWarn 又是空函数 —— 用户看到的就是「点了继续但页面不动」。
 * 现在改为实时读取路由，参数降级为提示值。
 */

import { computed } from 'vue'
import { useRoute, useRouter, isNavigationFailure, NavigationFailureType } from 'vue-router'
import { type RouteName, getNextPage, getPrevPage, pageSequence } from '@/config/navigation'
import { debugError, debugLog, debugWarn } from '@/utils/debug'
import { markNextEnterFromBackButton, setPendingExitType, track } from '@/utils/tracking'

/** 「继续」按钮跳转耗时告警阈值（毫秒）：超过即视为未达 <0.5s 的响应目标 */
const NAV_LATENCY_WARN_MS = 500

/**
 * 跳转兜底阈值（毫秒）：router.push 的 Promise 超过这个时间仍未落地
 * （懒加载 chunk 卡住、路由守卫挂起等），就用整页跳转把用户送出去，
 * 而不是让按钮永远点不动。取值偏保守，避免在慢网下误触发整页刷新。
 */
const NAV_STUCK_FALLBACK_MS = 8000

/** pageSequence 里的路由名集合，用于判断当前路由是否属于顺序流程 */
const SEQUENCE_NAMES = new Set<string>(pageSequence.map((p) => p.name))

/**
 * 读取高精度时间戳（毫秒）
 * performance.now 不可用时回落到 Date.now，兼容各类浏览器与测试环境。
 */
function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

/**
 * R140: 拼出可被浏览器直接跳转的完整地址。
 *
 * history 由 createWebHistory(import.meta.env.BASE_URL) 创建，
 * router.push('/rule1/1') 里的路径是相对 base 的；而 window.location
 * 是绝对语义。站点部署到子路径时，旧实现直接 `location.href = path`
 * 会丢掉 base 跳成 404，兜底反而把用户送出站点。
 */
function toAbsoluteLocation(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/'
  if (/^(https?:)?\/\//i.test(path)) return path
  if (!base || base === '/') return path
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${cleanBase}${path.startsWith('/') ? '' : '/'}${path}`
}

/**
 * 整页跳转兜底。仅在 SPA 导航链路确认失败/挂死时调用。
 * 用 replace 语义（location.replace）避免兜底跳转往历史栈里再压一条，
 * 否则用户按返回会退回到那个点不动的页面。
 */
function hardNavigate(path: string): void {
  if (typeof window === 'undefined') return
  window.location.replace(toAbsoluteLocation(path))
}

/**
 * 从 route.params 里安全取出 id（可能是 string / string[] / undefined）
 */
function pickParamId(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0] : ''
  return ''
}

/**
 * 上报「继续」按钮跳转耗时，用于统计不同浏览器环境下的响应延迟。
 *
 * - 埋点走 useTracking 的缓冲队列异步发送，不阻塞点击回调主线程
 * - totalCost 超过 NAV_LATENCY_WARN_MS 时额外输出开发环境告警
 *
 * @param routeName - 当前顺序页面名称
 * @param path - 目标路径
 * @param syncCost - 点击回调内同步阶段耗时（主线程阻塞时间）
 * @param totalCost - 从点击到路由跳转完成的端到端耗时
 */
function reportNextLatency(
  routeName: RouteName | undefined,
  path: string,
  syncCost: number,
  totalCost: number,
): void {
  debugLog('[useNavigation.goNext] 跳转耗时(ms):', { sync: syncCost, total: totalCost, path })
  if (totalCost > NAV_LATENCY_WARN_MS) {
    debugWarn(
      `[useNavigation.goNext] 跳转耗时 ${totalCost}ms 超过 ${NAV_LATENCY_WARN_MS}ms 阈值，目标页: ${path}`,
    )
  }
  track('interaction', routeName || 'unknown', {
    module_type: 'navigation',
    action: 'go_next',
    sync_cost: syncCost,
    cost_time: totalCost,
    target_path: path,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  })
}

/**
 * @param routeNameHint - 路由名提示值；实时路由可用时被忽略
 * @param idHint - 篇目 ID 提示值；实时路由 params.id 可用时被忽略
 */
export function useNavigation(routeNameHint?: RouteName, idHint?: string) {
  const router = useRouter()
  const route = useRoute()

  /**
   * R140: 实时路由名。
   * 当前路由在 pageSequence 中时以实时值为准（组件实例被复用时也不会过期），
   * 否则回落到提示值，保证非顺序页面（登录页、404 页）行为不变。
   */
  const liveRouteName = computed<RouteName | undefined>(() => {
    const name = typeof route.name === 'string' ? route.name : ''
    if (name && SEQUENCE_NAMES.has(name)) return name as RouteName
    return routeNameHint
  })

  /** R140: 实时篇目 ID，取不到时用提示值 */
  const liveId = computed<string>(() => pickParamId(route.params.id) || idHint || '')

  /**
   * 进行中的导航标记。
   * 移动端/触屏上「继续」容易被连点两下，两次 push 会让目标页加载两遍、
   * 埋点翻倍；导航链路收尾前忽略后续点击。
   */
  let navigationInFlight = false

  /**
   * 跳转到首页
   *
   * 路径来源：pageSequence 中 name === 'home' 的配置（单一事实源），
   * 避免多处硬编码 router.push('/')。
   */
  function goHome() {
    const homePage = pageSequence.find((p) => p.name === 'home')
    if (!homePage) {
      // 配置异常兜底：理论上 pageSequence 必含 home
      debugError('pageSequence 中未找到 home 配置，无法跳转首页')
      return
    }
    const path = homePage.getPath()
    router.push(path).catch((err: unknown) => {
      debugError('[useNavigation.goHome] router.push 失败:', err)
      hardNavigate(path)
    })
  }

  /**
   * 获取目标页面的 ID
   *
   * 当前所有页面共用 poemId（数字格式），无需跨页 ID 转换：
   * 直接透传实时 ID，缺失时回落到默认值 '1'。
   */
  function getTargetId(): string {
    return liveId.value || getDefaultId()
  }

  /**
   * 获取页面的默认 ID
   */
  function getDefaultId(): string {
    // 所有页面共用 poemId（数字格式），默认值为 '1'
    return '1'
  }

  /**
   * 是否已经位于目标地址。
   *
   * 命中即说明这次 push 一定会被 vue-router 当作重复导航丢弃，
   * 提前返回并打出可诊断日志，避免「按钮点了没反应」这种无从下手的现象。
   */
  function isAlreadyAt(path: string): boolean {
    return router.currentRoute.value.fullPath === path
  }

  /**
   * 跳转到下一页
   *
   * 非顺序页面（实时路由和提示值都给不出顺序页名）调用时仅 warn 不跳转。
   */
  function goNext(targetId?: string) {
    const startTime = nowMs()

    const routeName = liveRouteName.value
    if (!routeName) {
      debugWarn('useNavigation.goNext：未提供 currentRouteName，非顺序页面不支持 goNext')
      return
    }
    const nextPage = getNextPage(routeName)
    if (!nextPage) {
      debugWarn('useNavigation.goNext：已是最后一页，无下一页')
      return
    }
    const id = targetId ?? getTargetId()
    const path = nextPage.getPath(id)

    if (isAlreadyAt(path)) {
      debugWarn('[useNavigation.goNext] 目标与当前地址相同，忽略本次跳转:', path)
      return
    }
    if (navigationInFlight) {
      debugLog('[useNavigation.goNext] 上一次跳转尚未收尾，忽略重复点击:', path)
      return
    }

    // 标记退出类型为"前进"
    setPendingExitType('forward')
    // 同步阶段耗时：点击回调内主线程阻塞时间，要求 < 0.5s
    // 注意：此处不得再序列化 nextPage 等大对象到 console，否则会拖慢点击响应
    const syncCost = Math.round(nowMs() - startTime)
    debugLog('[useNavigation.goNext] 跳转到:', path, '同步耗时(ms):', syncCost)

    navigationInFlight = true
    let settled = false

    // 兜底：push 的 Promise 挂死（chunk 卡在网络等待、守卫未放行）时整页跳转，
    // 保证用户不会被困在当前页反复点击。
    const stuckTimer = setTimeout(() => {
      if (settled) return
      if (isAlreadyAt(path)) {
        debugWarn('[useNavigation.goNext] 跳转超过', NAV_STUCK_FALLBACK_MS, 'ms 仍未落地，整页兜底:', path)
        track('interaction', routeName, {
          module_type: 'navigation',
          action: 'go_next_hard_fallback',
          target_path: path,
          cost_time: Math.round(nowMs() - startTime),
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        })
        hardNavigate(path)
      }
    }, NAV_STUCK_FALLBACK_MS)

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(stuckTimer)
      navigationInFlight = false
    }

    router
      .push(path)
      .then((result) => {
        // 端到端耗时统计 + 埋点上报（异步，不阻塞主线程）
        reportNextLatency(routeName, path, syncCost, Math.round(nowMs() - startTime))
        // R136: 检查导航结果，如果是失败类型，记录详细日志
        if (result && isNavigationFailure(result)) {
          debugWarn('[useNavigation.goNext] 导航失败:', result)
          // 被守卫中止/重定向（例如令牌过期跳登录页）时不做整页跳转，
          // 否则会覆盖守卫给出的目标。
          if (result.type === NavigationFailureType.cancelled || result.type === NavigationFailureType.aborted) {
            track('interaction', routeName, {
              module_type: 'navigation',
              action: 'go_next_blocked',
              target_path: path,
              failure_type: result.type,
              user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            })
          }
        }
      })
      .catch((err: unknown) => {
        debugError('[useNavigation.goNext] router.push 失败:', err)
        // R136: router.push 失败时 fallback 到 router.replace
        router
          .replace(path)
          .then((result) => {
            if (result && isNavigationFailure(result)) {
              debugWarn('[useNavigation.goNext] router.replace 也未生效:', result)
            }
          })
          .catch((err2: unknown) => {
            debugError('[useNavigation.goNext] router.replace 也失败:', err2)
            // 最后的 fallback：整页跳转（带 base，见 toAbsoluteLocation）
            hardNavigate(path)
          })
      })
      .finally(finish)
  }

  /**
   * 跳转到上一页
   *
   * 非顺序页面调用时仅 warn 不跳转。
   * 已是第一页时改为调用 goHome()（替代原 router.push('/') 硬编码）。
   */
  function goPrev(targetId?: string) {
    const routeName = liveRouteName.value
    if (!routeName) {
      debugWarn('useNavigation.goPrev：未提供 currentRouteName，非顺序页面不支持 goPrev')
      return
    }
    const prevPage = getPrevPage(routeName)
    if (!prevPage) {
      // 没有上一页时，返回首页（走配置，不硬编码）
      setPendingExitType('backward')
      goHome()
      return
    }
    // 标记后退按钮，下个页面的 step_enter 会带上 from_back_button=true
    markNextEnterFromBackButton()
    const id = targetId ?? getTargetId()
    const path = prevPage.getPath(id)
    if (isAlreadyAt(path)) {
      debugLog('[useNavigation.goPrev] 目标与当前地址相同，忽略:', path)
      return
    }
    router.push(path).catch((err: unknown) => {
      debugError('[useNavigation.goPrev] router.push 失败:', err)
      hardNavigate(path)
    })
  }

  /**
   * 跳转到指定页面
   */
  function goTo(routeName: RouteName, id?: string) {
    const page = pageSequence.find((p) => p.name === routeName)
    if (!page) {
      debugError(`页面 ${routeName} 不存在`)
      return
    }
    const targetId = id ?? getTargetId()
    const path = page.getPath(targetId)
    if (isAlreadyAt(path)) {
      debugLog('[useNavigation.goTo] 目标与当前地址相同，忽略:', path)
      return
    }
    router.push(path).catch((err: unknown) => {
      debugError('[useNavigation.goTo] router.push 失败:', err)
      hardNavigate(path)
    })
  }

  /**
   * 获取当前页面的顺序索引
   *
   * 非顺序页面返回 -1。
   */
  const currentIndex = computed(() => {
    const name = liveRouteName.value
    if (!name) return -1
    return pageSequence.findIndex((p) => p.name === name)
  })

  /**
   * 判断是否有下一页
   * 非顺序页面（未传 currentRouteName）返回 false
   */
  const hasNext = computed(() => {
    if (!liveRouteName.value) return false
    return currentIndex.value < pageSequence.length - 1
  })

  /**
   * 判断是否有上一页
   * 非顺序页面（未传 currentRouteName）返回 false
   */
  const hasPrev = computed(() => {
    if (!liveRouteName.value) return false
    return currentIndex.value > 0
  })

  return {
    goNext,
    goPrev,
    goTo,
    goHome,
    currentIndex,
    hasNext,
    hasPrev,
  }
}
