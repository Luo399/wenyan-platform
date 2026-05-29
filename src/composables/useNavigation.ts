/**
 * useNavigation - 统一导航Composable（纯净版）
 *
 * 功能：
 * - 提供统一的页面导航路径计算
 * - 自动处理 ID 转换
 * - 支持自定义 ID（用于跨页面跳转）
 * - 纯函数设计，无副作用，易于测试
 *
 * 使用方式：
 * ```ts
 * const { nextPath, prevPath, goNext, goPrev } = useNavigation('rules', '1')
 *
 * // 获取路径（纯计算）
 * console.log(nextPath.value) // '/rule1/1'
 *
 * // 使用内置导航（需要传入router）
 * <BackContinue @back="goPrev(router)" @continue="goNext(router)" />
 * ```
 */

import { computed, type ComputedRef } from 'vue'
import type { Router } from 'vue-router'
import {
  type RouteName,
  getNextPage,
  getPrevPage,
  transformId,
  pageSequence,
} from '@/config/navigation'
import { debugWarn, debugError } from '@/utils/debug'

export interface NavigationResult {
  nextPath: ComputedRef<string | null>
  prevPath: ComputedRef<string | null>
  goNext: (router: Router) => void
  goPrev: (router: Router) => void
  goTo: (router: Router, routeName: RouteName, id?: string) => boolean
  currentIndex: ComputedRef<number>
  hasNext: ComputedRef<boolean>
  hasPrev: ComputedRef<boolean>
}

export function useNavigation(currentRouteName: RouteName, currentId?: string): NavigationResult {
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
    return '1'
  }

  /**
   * 当前页面的顺序索引
   */
  const currentIndex = computed(() => {
    return pageSequence.findIndex((p) => p.name === currentRouteName)
  })

  /**
   * 是否有下一页
   */
  const hasNext = computed(() => {
    return currentIndex.value < pageSequence.length - 1
  })

  /**
   * 是否有上一页
   */
  const hasPrev = computed(() => {
    return currentIndex.value > 0
  })

  /**
   * 下一页路径（纯计算，无副作用）
   */
  const nextPath = computed<string | null>(() => {
    const nextPage = getNextPage(currentRouteName)
    if (!nextPage) {
      return null
    }
    const id = getTargetId(nextPage.name)
    return nextPage.getPath(id)
  })

  /**
   * 上一页路径（纯计算，无副作用）
   */
  const prevPath = computed<string | null>(() => {
    const prevPage = getPrevPage(currentRouteName)
    if (!prevPage) {
      return '/'
    }
    const id = getTargetId(prevPage.name)
    return prevPage.getPath(id)
  })

  /**
   * 跳转到下一页（需要传入router）
   * 如果已是最后一页，则返回首页
   */
  function goNext(router: Router) {
    const path = nextPath.value
    if (!path) {
      // 最后一页，返回首页
      router.push('/')
      return
    }
    router.push(path)
  }

  /**
   * 跳转到上一页（需要传入router）
   */
  function goPrev(router: Router) {
    const path = prevPath.value
    if (!path) {
      debugWarn('已是第一页')
      return
    }
    router.push(path)
  }

  /**
   * 跳转到指定页面（需要传入router）
   * @returns 是否跳转成功
   */
  function goTo(router: Router, routeName: RouteName, id?: string): boolean {
    const page = pageSequence.find((p) => p.name === routeName)
    if (!page) {
      debugError(`页面 ${routeName} 不存在`)
      return false
    }
    const targetId = id ?? getTargetId(routeName)
    const path = page.getPath(targetId)
    router.push(path)
    return true
  }

  return {
    nextPath,
    prevPath,
    goNext,
    goPrev,
    goTo,
    currentIndex,
    hasNext,
    hasPrev,
  }
}
