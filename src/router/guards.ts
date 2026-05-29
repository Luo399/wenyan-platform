/**
 * 路由守卫配置
 * 
 * 功能：
 * - 登录状态检测
 * - 答题页面的登录验证
 * - 自动触发登录弹窗
 */

import type { Router, RouteLocationNormalized, NavigationGuardNext } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * 检查路由是否需要登录
 * 使用路由元信息中的requiresAuth标记
 */
function requiresAuth(to: RouteLocationNormalized): boolean {
  return !!to.meta.requiresAuth
}

/**
 * 创建路由守卫
 */
export function setupAuthGuard(router: Router): void {
  router.beforeEach(
    async (
      to: RouteLocationNormalized,
      from: RouteLocationNormalized,
      next: NavigationGuardNext
    ) => {
      const authStore = useAuthStore()

      // 检查是否需要登录
      if (requiresAuth(to) && !authStore.isLoggedIn) {
        console.log('[AuthGuard] 需要登录，触发登录弹窗')
        
        // 在路由元信息中标记需要登录
        to.meta.showLoginModal = true
        
        // 允许访问但标记需要登录
        next()
      } else {
        next()
      }
    }
  )
}

/**
 * 全局登录状态检查组合式函数
 */
export function useAuthGuard() {
  const authStore = useAuthStore()
  
  return {
    isLoggedIn: authStore.isLoggedIn,
    user: authStore.user,
    login: authStore.login,
    logout: authStore.logout,
    hasError: authStore.error !== null,
    error: authStore.error
  }
}