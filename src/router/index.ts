import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/teacher/register',
      name: 'teacher-register',
      component: () => import('@/views/TeacherRegisterView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/teacher/students',
      name: 'teacher-students',
      component: () => import('@/views/TeacherStudentManageView.vue'),
      meta: { requiresAuth: true, roles: ['teacher', 'admin'] },
    },
    {
      path: '/rules/:id',
      name: 'rules',
      component: () => import('@/views/RuleView.vue'),
      meta: { requiresAuth: true },
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
      meta: { requiresAuth: true },
    },
    {
      path: '/rule2/:id',
      name: 'rule2',
      component: () => import('@/views/RuleView2.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/rule3/:id',
      name: 'rule3',
      component: () => import('@/views/RuleView3.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/detail/:id',
      name: 'detail',
      component: () => import('@/views/DetailView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

// 全局路由守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // 未登录且访问需要登录的页面
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next('/login')
    return
  }

  // 已登录且访问游客页面（登录/注册）
  if (to.meta.guestOnly && authStore.isLoggedIn) {
    next('/')
    return
  }

  // 角色权限校验
  if (to.meta.roles && Array.isArray(to.meta.roles)) {
    const allowedRoles = to.meta.roles as string[]
    if (!allowedRoles.includes(authStore.user?.role || '')) {
      next('/')
      return
    }
  }

  next()
})

export default router
