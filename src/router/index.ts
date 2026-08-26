import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// 首屏组件同步加载
import NewHomeView from '@/views/NewHomeView.vue'

// R114: 扩展 RouteMeta 类型，避免 meta 字段无类型提示
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

// 非首屏组件懒加载
const DetailView = () => import('@/views/DetailView.vue')
const RuleVideoView = () => import('@/views/RuleVideoView.vue')
const StepOneView = () => import('@/views/StepOneView.vue')
const StepTwoView = () => import('@/views/StepTwoView.vue')
const StepThreeView = () => import('@/views/StepThreeView.vue')
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
    path: '/rules/:id',
    name: 'rules',
    component: RuleVideoView,
    props: { videoKey: 'bg', navKey: 'rules', titlePrefix: '规则介绍' },
    meta: { requiresAuth: true },
  },
  {
    path: '/stepone/:id',
    name: 'stepone',
    component: StepOneView,
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
    component: StepThreeView,
    meta: { requiresAuth: true },
  },
  {
    path: '/steptwo/:id',
    name: 'steptwo',
    component: StepTwoView,
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
    meta: { requiresAuth: true },
  },
  {
    path: '/admin-login',
    name: 'admin-login',
    component: () => import('@/views/AdminLoginView.vue'),
  },
  {
    path: '/resource-upload',
    name: 'resource-upload',
    component: () => import('@/views/ResourceUploadTool.vue'),
    meta: { requiresAuth: true },
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
})

export default router
