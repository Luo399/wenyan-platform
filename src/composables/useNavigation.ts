/**
 * useNavigation - 统一导航Composable
 *
 * 功能：
 * - 提供统一的跳转函数
 * - 自动处理 ID 转换
 * - 支持自定义 ID（用于跨页面跳转）
 *
 * 使用方式：
 * ```ts
 * const { goNext, goPrev, currentPage } = useNavigation('rules', '1')
 *
 * // 在模板中
 * <BackContinue @back="goPrev()" @continue="goNext()" />
 * ```
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  type RouteName,
  getNextPage,
  getPrevPage,
  transformId,
  pageSequence,
} from '@/config/navigation'

export function useNavigation(currentRouteName: RouteName, currentId?: string) {
  const router = useRouter()

  /**
   * 获取转换后的 ID
   */
  function getTargetId(targetRouteName: RouteName): string {
    const newId = transformId(currentRouteName, targetRouteName, currentId || '')
    return newId || currentId || getDefaultId(targetRouteName)
  }

  /**
   * 获取页面的默认 ID
   */
  function getDefaultId(routeName: RouteName): string {
    const pageIndex = pageSequence.findIndex((p) => p.name === routeName)
    // 根据页面类型返回合理的默认值
    switch (routeName) {
      case 'audio':
        return 'WEN_01'
      default:
        return '1'
    }
  }

  /**
   * 跳转到下一页
   */
  function goNext(targetId?: string) {
    const nextPage = getNextPage(currentRouteName)
    if (!nextPage) {
      console.warn('已是最后一页')
      return
    }
    const id = targetId ?? getTargetId(nextPage.name)
    const path = nextPage.getPath(id)
    router.push(path)
  }

  /**
   * 跳转到上一页
   */
  function goPrev(targetId?: string) {
    const prevPage = getPrevPage(currentRouteName)
    if (!prevPage) {
      // 没有上一页时，返回首页
      router.push('/')
      return
    }
    const id = targetId ?? getTargetId(prevPage.name)
    const path = prevPage.getPath(id)
    router.push(path)
  }

  /**
   * 跳转到指定页面
   */
  function goTo(routeName: RouteName, id?: string) {
    const page = pageSequence.find((p) => p.name === routeName)
    if (!page) {
      console.error(`页面 ${routeName} 不存在`)
      return
    }
    const targetId = id ?? getTargetId(routeName)
    const path = page.getPath(targetId)
    router.push(path)
  }

  /**
   * 获取当前页面的顺序索引
   */
  const currentIndex = computed(() => {
    return pageSequence.findIndex((p) => p.name === currentRouteName)
  })

  /**
   * 判断是否有下一页
   */
  const hasNext = computed(() => {
    return currentIndex.value < pageSequence.length - 1
  })

  /**
   * 判断是否有上一页
   */
  const hasPrev = computed(() => {
    return currentIndex.value > 0
  })

  return {
    goNext,
    goPrev,
    goTo,
    currentIndex,
    hasNext,
    hasPrev,
  }
}
