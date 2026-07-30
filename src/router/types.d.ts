/**
 * 路由元信息类型扩展
 *
 * 为所有路由 meta 字段提供类型声明，避免 any 类型与隐式字段。
 */
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 该路由是否需要登录才能访问 */
    requiresAuth?: boolean
    /** 已废弃：原用于触发登录弹窗，目前由守卫重定向到首页处理（保留以兼容历史路由配置） */
    showLoginModal?: boolean
    /** 是否为公开页面（无需登录） */
    public?: boolean
  }
}
