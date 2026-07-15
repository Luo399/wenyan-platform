import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

export const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/rules/:id',
    name: 'rules',
    component: () => import('@/views/RuleView.vue'),
  },
  {
    path: '/stepone/:id',
    name: 'stepone',
    component: () => import('@/views/StepOneView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/rule1/:id',
    name: 'rule1',
    component: () => import('@/views/RuleView1.vue'),
  },
  {
    path: '/rule2/:id',
    name: 'rule2',
    component: () => import('@/views/RuleView2.vue'),
  },
  {
    path: '/rule3/:id',
    name: 'rule3',
    component: () => import('@/views/RuleView3.vue'),
  },
  {
    path: '/stepthree/:id',
    name: 'stepthree',
    component: () => import('@/views/StepThreeView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/steptwo/:id',
    name: 'steptwo',
    component: () => import('@/views/StepTwoView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/block-demo',
    name: 'block-demo',
    component: () => import('@/views/BlockDemoView.vue'),
  },
  {
    path: '/detail/:id',
    name: 'detail',
    component: () => import('@/views/DetailView.vue'),
  },
  {
    path: '/answer-query',
    name: 'answer-query',
    component: () => import('@/views/AnswerQueryView.vue'),
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
  routes: routes,
})

// 注册路由守卫
import { setupAuthGuard } from './guards'
setupAuthGuard(router)

export default router
