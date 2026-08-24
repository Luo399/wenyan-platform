<template>
  <div class="new-home">
    <!-- 新选篇面板（逻辑完全迁移自 PoetryMenu，视觉对齐 Figma article_list 系列） -->
    <NewMenu />

    <!-- 登录入口悬浮条（右上角，保留学生/教师登录能力） -->
    <div class="login-bar">
      <button type="button" class="login-chip" @click="openLogin('student')">学生登录</button>
      <span class="sep" aria-hidden="true">|</span>
      <button type="button" class="login-chip" @click="openLogin('teacher')">教师登录</button>
    </div>

    <!-- 管理员入口（左下角） -->
    <div class="admin-entry">
      <button type="button" class="admin-link" @click="router.push('/admin-login')">管理员</button>
    </div>

    <!-- 登录弹窗 -->
    <LoginModal
      :visible="showLoginModal"
      :role="loginRole"
      @close="closeLogin"
      @login-success="handleLoginSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NewMenu from '@/components/NewMenu.vue'
import LoginModal from '@/components/LoginModal.vue'
import { useNavigation } from '@/composables/useNavigation'
import { track } from '@/utils/tracking'

const router = useRouter()
const route = useRoute()
const { goTo } = useNavigation()

// 首页埋点
const enterTime = Date.now()
onMounted(() => {
  track('step_enter', 'home', {})
})
onUnmounted(() => {
  const duration = Date.now() - enterTime
  track('step_exit', 'home', { duration })
})

// 登录弹窗控制
const showLoginModal = ref(false)
const loginRole = ref<'student' | 'teacher'>('student')

function openLogin(role: 'student' | 'teacher') {
  loginRole.value = role
  showLoginModal.value = true
}

function closeLogin() {
  showLoginModal.value = false
}

function handleLoginSuccess() {
  showLoginModal.value = false
  // 优先跳转 redirect 参数指向的页面（路由守卫携带），否则跳转 rules/1
  const redirect = route.query.redirect as string | undefined
  if (redirect && redirect !== '/') {
    window.location.href = redirect
  } else {
    goTo('rules', '1')
  }
}
</script>

<style scoped>
/* 首页容器：选篇面板全屏铺底，登录入口浮于右上角 */
.new-home {
  min-height: 100vh;
}

/* 登录入口悬浮条 */
.login-bar {
  position: fixed;
  top: var(--spacing-md);
  right: var(--spacing-xl);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-lg);
  background-color: rgba(255, 255, 255, 0.85);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-small);
}

.login-chip {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
  padding: 0;
  line-height: 1.6;
  transition: color 0.2s ease;
}

.login-chip:hover {
  color: var(--color-primary-hover);
}

.sep {
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
}

/* 管理员入口（左下角） */
.admin-entry {
  position: fixed;
  bottom: var(--spacing-md);
  left: var(--spacing-lg);
  z-index: 20;
}

.admin-link {
  background: none;
  border: none;
  font-family: var(--font-family-serif);
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #999);
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s ease;
}

.admin-link:hover {
  color: var(--color-primary-hover);
}
</style>
