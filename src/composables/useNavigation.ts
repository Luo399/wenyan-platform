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
import { debugError, debugWarn } from '@/utils/debug'
import { markNextEnterFromBackButton, setPendingExitType } from '@/utils/tracking'

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
      console.error('[useNavigation.goHome] router.push 失败:', err)
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
    // 调试日志：生产环境也输出，避免 debugWarn 仅在 dev 模式生效
    console.log(
      '[useNavigation.goNext] currentRouteName:',
      currentRouteName,
      'currentId:',
      currentId,
      'targetId:',
      targetId,
    )
    if (!currentRouteName) {
      console.warn('useNavigation.goNext：未提供 currentRouteName，非顺序页面不支持 goNext')
      return
    }
    const nextPage = getNextPage(currentRouteName)
    console.log('[useNavigation.goNext] nextPage:', nextPage)
    if (!nextPage) {
      console.warn('已是最后一页')
      return
    }
    // 标记退出类型为"前进"
    setPendingExitType('forward')
    const id = targetId ?? getTargetId()
    const path = nextPage.getPath(id)
    console.log('[useNavigation.goNext] pushing to:', path)
    router
      .push(path)
      .then((result) => {
        // R136: 检查导航结果，如果是失败类型，记录详细日志
        if (result && isNavigationFailure(result)) {
          console.warn('[useNavigation.goNext] 导航失败:', result)
        } else {
          console.log('[useNavigation.goNext] 导航成功到:', path)
        }
      })
      .catch((err: unknown) => {
        console.error('[useNavigation.goNext] router.push 失败:', err)
        // R136: router.push 失败时 fallback 到 router.replace
        console.log('[useNavigation.goNext] 尝试 router.replace 回退到:', path)
        router.replace(path).catch((err2: unknown) => {
          console.error('[useNavigation.goNext] router.replace 也失败:', err2)
          // 最后的 fallback：直接修改 window.location
          console.log('[useNavigation.goNext] 最终 fallback 到 window.location.href:', path)
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
      console.error('[useNavigation.goPrev] router.push 失败:', err)
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
      console.error('[useNavigation.goTo] router.push 失败:', err)
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
