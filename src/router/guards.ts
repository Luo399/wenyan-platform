/**
 * 路由守卫配置
 *
 * 功能：
 * - 登录状态检测
 * - 答题页面的登录验证
 * - 未登录时重定向到首页并携带 redirect 参数，登录成功后跳回原目标页
 * - token 过期自动登出
 */

import type { Router, RouteLocationNormalized, NavigationGuardNext } from 'vue-router'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { debugLog } from '@/utils/debug'

/**
 * 检查路由是否需要登录
 * 使用路由元信息中的 requiresAuth 标记
 */
function requiresAuth(to: RouteLocationNormalized): boolean {
  return !!to.meta.requiresAuth
}

/**
 * 创建路由守卫
 *
 * R03: 未登录访问鉴权页时重定向到首页并携带 ?redirect=<原目标>，
 * 替代原"设置 showLoginModal meta 后 next() 放行"的死代码逻辑。
 * 原逻辑下鉴权页内容会直接渲染，且登录成功后无法回到原目标页。
 */
export function setupAuthGuard(router: Router): void {
  router.beforeEach(
    (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
      const authStore = useAuthStore()

      // token 过期自动登出，避免用过期 token 访问鉴权页
      if (authStore.token && authStore.isTokenExpired()) {
        debugLog('[AuthGuard] token 已过期，自动登出')
        authStore.logout()
      }

      // 需要登录但未登录：重定向到首页并携带 redirect 参数
      if (requiresAuth(to) && !authStore.isLoggedIn) {
        debugLog('[AuthGuard] 需要登录，重定向到首页并携带 redirect:', to.fullPath)
        next({ name: 'home', query: { redirect: to.fullPath } })
        return
      }

      next()
    },
  )
}

/**
 * 全局登录状态检查组合式函数
 *
 * R38: 不再直接解构 store 方法（会丢失 this 上下文，虽然 pinia setup store 不依赖 this，
 * 但直接解构方法仍是反模式），改为包装调用并返回计算属性。
 */
export function useAuthGuard() {
  const authStore = useAuthStore()

  return {
    isLoggedIn: authStore.isLoggedIn,
    user: authStore.user,
    error: authStore.error,
    hasError: computed(() => authStore.error !== null),
    login: (studentId: string, password: string, studentName?: string) =>
      authStore.login(studentId, password, studentName),
    logout: () => authStore.logout(),
  }
}
