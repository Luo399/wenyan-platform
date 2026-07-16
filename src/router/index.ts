import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
      path: '/detail/:id',
      name: 'detail',
      component: () => import('@/views/DetailView.vue'),
    },
  ],
})

export default router
