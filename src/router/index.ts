import { createRouter, createWebHistory } from 'vue-router'

// 首屏组件同步加载
import HomeView from '@/views/HomeView.vue'

// 非首屏组件懒加载
const DetailView = () => import('@/views/DetailView.vue')
const RuleVideoView = () => import('@/views/RuleVideoView.vue')
const StepOneView = () => import('@/views/StepOneView.vue')
const StepTwoView = () => import('@/views/StepTwoView.vue')
const StepThreeView = () => import('@/views/StepThreeView.vue')
const BlockDemoView = () => import('@/views/BlockDemoView.vue')
const AnswerQueryView = () => import('@/views/AnswerQueryView.vue')

export const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/rules/:id',
    name: 'rules',
    component: RuleVideoView,
    props: { videoKey: 'bg', navKey: 'rules', titlePrefix: '规则介绍' },
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
  },
  {
    path: '/rule2/:id',
    name: 'rule2',
    component: RuleVideoView,
    props: { videoKey: '2', navKey: 'rule2', titlePrefix: '规则介绍（二）' },
  },
  {
    path: '/rule3/:id',
    name: 'rule3',
    component: RuleVideoView,
    props: { videoKey: '3', navKey: 'rule3', titlePrefix: '规则介绍（三）' },
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
    path: '/block-demo',
    name: 'block-demo',
    component: BlockDemoView,
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
