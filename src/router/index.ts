import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import type { Role } from '@/stores/auth'

// 首屏组件同步加载
import NewHomeView from '@/views/NewHomeView.vue'

// R114: 扩展 RouteMeta 类型，避免 meta 字段无类型提示
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    /**
     * 可选：限定访问角色。单个值或数组，数组表示「命中其中任一角色即可」。
     *
     * 取值要和后端接口的 requireRole 对齐，否则前端放进去了、
     * 接口回来 403，页面只剩一片加载失败。
     */
    role?: Role | Role[]
  }
}

// 非首屏组件懒加载
const DetailView = () => import('@/views/DetailView.vue')
const RuleVideoView = () => import('@/views/RuleVideoView.vue')
// R1: 三个步骤路由合并为同一个 StepView 组件，靠 route.name 区分行为
const StepView = () => import('@/views/StepView.vue')
const AnswerQueryView = () => import('@/views/AnswerQueryView.vue')

// R114: 标注 RouteRecordRaw 类型，保证 meta 字段有类型检查
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: NewHomeView,
  },
  {
    path: '/student-login',
    name: 'student-login',
    component: () => import('@/views/StudentLoginView.vue'),
  },
  {
    path: '/teacher-login',
    name: 'teacher-login',
    component: () => import('@/views/TeacherLoginView.vue'),
  },
  {
    path: '/teacher-register',
    name: 'teacher-register',
    component: () => import('@/views/TeacherRegisterView.vue'),
  },
  {
    path: '/rules/:id',
    name: 'rules',
    component: RuleVideoView,
    props: { videoKey: 'bg', navKey: 'rules', titlePrefix: '规则介绍' },
    meta: { requiresAuth: true },
  },
  {
    path: '/stepone/:id',
    name: 'stepone',
    component: StepView,
    meta: { requiresAuth: true },
  },
  {
    path: '/rule1/:id',
    name: 'rule1',
    component: RuleVideoView,
    props: { videoKey: '1', navKey: 'rule1', titlePrefix: '规则介绍（一）' },
    meta: { requiresAuth: true },
  },
  {
    path: '/rule2/:id',
    name: 'rule2',
    component: RuleVideoView,
    props: { videoKey: '2', navKey: 'rule2', titlePrefix: '规则介绍（二）' },
    meta: { requiresAuth: true },
  },
  {
    path: '/rule3/:id',
    name: 'rule3',
    component: RuleVideoView,
    props: { videoKey: '3', navKey: 'rule3', titlePrefix: '规则介绍（三）' },
    meta: { requiresAuth: true },
  },
  {
    path: '/stepthree/:id',
    name: 'stepthree',
    component: StepView,
    meta: { requiresAuth: true },
  },
  {
    path: '/steptwo/:id',
    name: 'steptwo',
    component: StepView,
    meta: { requiresAuth: true },
  },
  {
    path: '/detail/:id',
    name: 'detail',
    component: DetailView,
    meta: { requiresAuth: true },
  },
  {
    path: '/answer-query',
    name: 'answer-query',
    component: AnswerQueryView,
    // 后端 /api/answers/* 只放 teacher/admin/super_admin，学生进来只会拿到 403
    meta: { requiresAuth: true, role: ['teacher', 'admin', 'super_admin'] },
  },
  {
    path: '/admin-login',
    name: 'admin-login',
    component: () => import('@/views/AdminLoginView.vue'),
  },
  {
    path: '/admin-console',
    name: 'admin-console',
    component: () => import('@/views/AdminConsoleView.vue'),
    meta: { requiresAuth: true, role: ['admin', 'super_admin'] },
  },
  {
    path: '/admin-dashboard',
    name: 'admin-dashboard',
    component: () => import('@/views/AdminDashboardView.vue'),
    meta: { requiresAuth: true, role: ['admin', 'super_admin'] },
  },
  {
    path: '/teacher-completion',
    name: 'teacher-completion',
    component: () => import('@/views/TeacherCompletionView.vue'),
    // 后端 /api/teacher/completion/* 用 requireRole('teacher')，管理员也不放行
    meta: { requiresAuth: true, role: 'teacher' },
  },
  {
    path: '/teacher-dashboard',
    name: 'teacher-dashboard',
    component: () => import('@/views/TeacherDashboardView.vue'),
    meta: { requiresAuth: true, role: 'teacher' },
  },
  {
    path: '/resource-upload',
    name: 'resource-upload',
    component: () => import('@/views/ResourceUploadTool.vue'),
    // 后端 /api/upload/resource 用 requireRole(['teacher', 'admin'])
    meta: { requiresAuth: true, role: ['teacher', 'admin'] },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // R140: 显式声明滚动行为。
  // 之前没有配置，各浏览器自行决定新页面继承还是保留上一个页面的滚动位置：
  // 步骤页（StepView / DetailView）内容比一屏长，用户滚到底部点固定在屏底的「继续」后，
  // 部分环境会把新页面也停在同一个滚动位置（看起来像"点了没跳转"），部分环境才回到顶部。
  scrollBehavior(to, from, savedPosition) {
    // 浏览器前进/后退：用它自己存的位置，保持原生手感
    if (savedPosition) return savedPosition
    // 同一个页面只换篇目（/rules/1 → /rules/2）：留在顶部即可，不必锚点跳转
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    if (to.name !== from.name) return { top: 0 }
    return false
  },
})

export default router
