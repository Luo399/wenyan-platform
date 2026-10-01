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
 * // 顺序页面：传入 currentRouteName
 * const { goNext, goPrev, goHome } = useNavigation('rules', '1')
 *
 * // 非顺序页面：不传 currentRouteName，仅使用 goHome
 * const { goHome } = useNavigation()
 *
 * // 在模板中
 * <BackContinue @back="goPrev()" @continue="goNext()" />
 * ```
 */

import { computed } from 'vue'
import { useRouter, isNavigationFailure } from 'vue-router'
import { type RouteName, getNextPage, getPrevPage, pageSequence } from '@/config/navigation'
import { debugError, debugLog, debugWarn } from '@/utils/debug'
import { markNextEnterFromBackButton, setPendingExitType, track } from '@/utils/tracking'

/** 「继续」按钮跳转耗时告警阈值（毫秒）：超过即视为未达 <0.5s 的响应目标 */
const NAV_LATENCY_WARN_MS = 500

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

export function useNavigation(currentRouteName?: RouteName, currentId?: string) {
  const router = useRouter()

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
    router.push(homePage.getPath()).catch((err: unknown) => {
      debugError('[useNavigation.goHome] router.push 失败:', err)
      window.location.href = homePage.getPath()
    })
  }

  /**
   * 获取目标页面的 ID
   *
   * 当前所有页面共用 poemId（数字格式），无需跨页 ID 转换：
   * 直接透传 currentId，缺失时回落到默认值 '1'。
   */
  function getTargetId(): string {
    return currentId || getDefaultId()
  }

  /**
   * 获取页面的默认 ID
   */
  function getDefaultId(): string {
    // 所有页面共用 poemId（数字格式），默认值为 '1'
    return '1'
  }

  /**
   * 跳转到下一页
   *
   * 非顺序页面（未传 currentRouteName）调用时仅 warn 不跳转。
   */
  function goNext(targetId?: string) {
    const startTime = nowMs()

    if (!currentRouteName) {
      debugWarn('useNavigation.goNext：未提供 currentRouteName，非顺序页面不支持 goNext')
      return
    }
    const nextPage = getNextPage(currentRouteName)
    if (!nextPage) {
      debugWarn('useNavigation.goNext：已是最后一页，无下一页')
      return
    }
    // 标记退出类型为"前进"
    setPendingExitType('forward')
    const id = targetId ?? getTargetId()
    const path = nextPage.getPath(id)
    // 同步阶段耗时：点击回调内主线程阻塞时间，要求 < 0.5s
    // 注意：此处不得再序列化 nextPage 等大对象到 console，否则会拖慢点击响应
    const syncCost = Math.round(nowMs() - startTime)
    debugLog('[useNavigation.goNext] 跳转到:', path, '同步耗时(ms):', syncCost)

    router
      .push(path)
      .then((result) => {
        // 端到端耗时统计 + 埋点上报（异步，不阻塞主线程）
        reportNextLatency(currentRouteName, path, syncCost, Math.round(nowMs() - startTime))
        // R136: 检查导航结果，如果是失败类型，记录详细日志
        if (result && isNavigationFailure(result)) {
          debugWarn('[useNavigation.goNext] 导航失败:', result)
        }
      })
      .catch((err: unknown) => {
        debugError('[useNavigation.goNext] router.push 失败:', err)
        // R136: router.push 失败时 fallback 到 router.replace
        router.replace(path).catch((err2: unknown) => {
          debugError('[useNavigation.goNext] router.replace 也失败:', err2)
          // 最后的 fallback：直接修改 window.location
          window.location.href = path
        })
      })
  }

  /**
   * 跳转到上一页
   *
   * 非顺序页面（未传 currentRouteName）调用时仅 warn 不跳转。
   * 已是第一页时改为调用 goHome()（替代原 router.push('/') 硬编码）。
   */
  function goPrev(targetId?: string) {
    if (!currentRouteName) {
      debugWarn('useNavigation.goPrev：未提供 currentRouteName，非顺序页面不支持 goPrev')
      return
    }
    const prevPage = getPrevPage(currentRouteName)
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
    router.push(path).catch((err: unknown) => {
      debugError('[useNavigation.goPrev] router.push 失败:', err)
      window.location.href = path
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
    router.push(path).catch((err: unknown) => {
      debugError('[useNavigation.goTo] router.push 失败:', err)
      window.location.href = path
    })
  }

  /**
   * 获取当前页面的顺序索引
   *
   * 非顺序页面返回 -1。
   */
  const currentIndex = computed(() => {
    if (!currentRouteName) return -1
    return pageSequence.findIndex((p) => p.name === currentRouteName)
  })

  /**
   * 判断是否有下一页
   * 非顺序页面（未传 currentRouteName）返回 false
   */
  const hasNext = computed(() => {
    if (!currentRouteName) return false
    return currentIndex.value < pageSequence.length - 1
  })

  /**
   * 判断是否有上一页
   * 非顺序页面（未传 currentRouteName）返回 false
   */
  const hasPrev = computed(() => {
    if (!currentRouteName) return false
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
