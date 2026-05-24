import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import DetailView from '@/views/DetailView.vue'
import RuleView from '@/views/RuleView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/detail/:id',
      name: 'detail',
      component: DetailView,
    },
    {
      path: '/rules/:id',
      name: 'rules',
      component: RuleView,
    },
  ],
})

export default router
