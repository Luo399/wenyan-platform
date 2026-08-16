<template>
  <div class="home" :style="{ backgroundImage: `url(${bgUrl})` }">
    <PoetryMenu />

    <div class="main-content">
      <!-- 标题图（Figma: home_title.png） -->
      <img class="home-title" :src="titleUrl" alt="文言文预习平台" />

      <!-- 角色选择按钮 -->
      <div class="role-buttons">
        <button type="button" class="role-btn" @click="openLogin('student')" aria-label="学生登录">
          学生登录
        </button>
        <button type="button" class="role-btn" @click="openLogin('teacher')" aria-label="教师登录">
          教师登录
        </button>
      </div>
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
import { useRouter } from 'vue-router'
import PoetryMenu from '@/components/PoetryMenu.vue'
import LoginModal from '@/components/LoginModal.vue'
import { getAssetUrl } from '@/utils/asset'
import { track } from '@/utils/tracking'

const router = useRouter()

// 首页埋点
const enterTime = Date.now()
onMounted(() => {
  track('step_enter', 'home', {})
})
onUnmounted(() => {
  const duration = Date.now() - enterTime
  track('step_exit', 'home', { duration })
})

// 背景图（Figma: home_bg.png）
const bgUrl = getAssetUrl('images', 'home_bg.png')
// 标题图（Figma: home_title.png）
const titleUrl = getAssetUrl('images', 'home_title.png')

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
  // 登录成功后跳转到学习页面
  router.push({ name: 'rules', params: { id: '1' } })
}
</script>

<style scoped>
.home {
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

/* 标题图 - Figma: home_title.png (1677x340) */
.home-title {
  width: clamp(300px, 48vw, 900px);
  height: auto;
  display: block;
}

/* 角色选择按钮区 */
.role-buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

/* 角色按钮 - Figma: 528x163, 深红底, 橄榄绿8px边框, 50px圆角, 白字100px */
.role-btn {
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

.role-btn:hover {
  background-color: var(--color-primary-hover);
}

.role-btn:active {
  transform: scale(0.98);
}
</style>
