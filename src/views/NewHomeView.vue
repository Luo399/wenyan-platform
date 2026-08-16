<template>
  <div class="new-home" :style="{ backgroundImage: `url(${bgUrl})` }">
    <PoetryMenu />

    <div class="main-content">
      <!-- 标题图 -->
      <img class="home-title" :src="titleUrl" alt="文言文预习平台" />

      <!-- 副标题 -->
      <p class="home-subtitle">品读经典，传承文化</p>

      <!-- 进入学习按钮 -->
      <button type="button" class="enter-btn" @click="goToStudentLogin" aria-label="进入学习">
        进入学习
      </button>

      <!-- 登录入口 -->
      <div class="login-links">
        <button type="button" class="login-link" @click="goToLogin('student')">学生登录</button>
        <span class="link-separator">|</span>
        <button type="button" class="login-link" @click="goToLogin('teacher')">教师登录</button>
      </div>
      <div class="admin-entry">
        <button type="button" class="admin-link" @click="router.push('/admin-login')">管理员</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PoetryMenu from '@/components/PoetryMenu.vue'
import { useAuthStore } from '@/stores/auth'
import { getAssetUrl } from '@/utils/asset'
import { track } from '@/utils/tracking'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// 首页埋点
const enterTime = Date.now()
onMounted(() => {
  track('step_enter', 'home', {})
})
onUnmounted(() => {
  const duration = Date.now() - enterTime
  track('step_exit', 'home', { duration })
})

// 背景图
const bgUrl = getAssetUrl('images', 'home_bg.png')
// 标题图
const titleUrl = getAssetUrl('images', 'home_title.png')

// 跳转到登录页
function goToLogin(role: 'student' | 'teacher') {
  const redirect = route.query.redirect as string | undefined
  if (role === 'teacher') {
    router.push(
      redirect ? `/teacher-login?redirect=${encodeURIComponent(redirect)}` : '/teacher-login',
    )
  } else {
    router.push(
      redirect ? `/student-login?redirect=${encodeURIComponent(redirect)}` : '/student-login',
    )
  }
}

// 进入学习：已登录直接跳转规则页，否则跳转学生登录页并携带 redirect 参数
function goToStudentLogin() {
  if (authStore.isLoggedIn) {
    // 已登录，直接跳转到规则页
    const redirect = route.query.redirect as string | undefined
    if (redirect && redirect !== '/') {
      router.push(redirect)
    } else {
      router.push('/rules/1')
    }
  } else {
    // 未登录，跳转到学生登录页，携带 redirect 参数
    const redirect = route.query.redirect as string | undefined
    if (redirect) {
      router.push(`/student-login?redirect=${encodeURIComponent(redirect)}`)
    } else {
      router.push('/student-login')
    }
  }
}
</script>

<style scoped>
.new-home {
  display: flex;
  min-height: 100vh;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
}

.main-content {
  margin-left: var(--sidebar-width);
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xl);
}

/* 标题图 */
.home-title {
  width: clamp(300px, 48vw, 900px);
  height: auto;
  display: block;
}

/* 副标题 */
.home-subtitle {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-heading);
  color: var(--color-primary);
  margin: 0;
  letter-spacing: 0.15em;
}

/* 进入学习按钮 */
.enter-btn {
  width: clamp(280px, 28vw, 528px);
  height: clamp(80px, 8vw, 163px);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-weight: var(--font-weight-semibold);
  font-size: clamp(2rem, 5vw, 5rem);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
  line-height: 1;
}

.enter-btn:hover {
  background-color: var(--color-primary-hover);
}

.enter-btn:active {
  transform: scale(0.98);
}

/* 登录入口链接 */
.login-links {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.login-link {
  background: none;
  border: none;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s ease;
}

.login-link:hover {
  color: var(--color-primary-hover);
}

.link-separator {
  color: var(--color-text-secondary);
  font-size: var(--font-size-body);
}

/* 管理员入口 */
.admin-entry {
  text-align: center;
  margin-top: var(--spacing-xs);
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
