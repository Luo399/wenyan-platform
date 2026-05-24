import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import DetailView from '@/views/DetailView.vue'
import RuleView from '@/views/RuleView.vue'
import AudioPlayerView from '@/views/AnnotatedSegmentView.vue'

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
      component: RuleView,
    },
    {
      path: '/audio/:id',
      name: 'audio',
      component: AudioPlayerView,
    },
    {
      path: '/detail/:id',
      name: 'detail',
      component: DetailView,
    },
  ],
})

export default router
