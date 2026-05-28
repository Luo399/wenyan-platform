import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import DetailView from '@/views/DetailView.vue'
import RuleView from '@/views/RuleView.vue'
import RuleView1 from '@/views/RuleView1.vue'
import RuleView2 from '@/views/RuleView2.vue'
import RuleView3 from '@/views/RuleView3.vue'
import StepOneView from '@/views/StepOneView.vue'
import StepThreeView from '@/views/StepThreeView.vue'
import StepTwoView from '@/views/StepTwoView.vue'
import BlockDemoView from '@/views/BlockDemoView.vue'

export const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/rules/:id',
    name: 'rules',
    component: RuleView,
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
    component: RuleView1,
  },
  {
    path: '/rule2/:id',
    name: 'rule2',
    component: RuleView2,
  },
  {
    path: '/rule3/:id',
    name: 'rule3',
    component: RuleView3,
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