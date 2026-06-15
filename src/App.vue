<template>
  <div id="app">
    <!-- 右上角显示学号和背景音乐控制 -->
    <div class="top-bar">
      <StudentDisplay />
      <Repeatbgm />
    </div>

    <router-view />

    <!-- 登录弹窗 -->
    <LoginModal
      :visible="showLoginModal"
      @close="handleCloseLogin"
      @login-success="handleLoginSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import StudentDisplay from '@/components/StudentDisplay.vue'
import Repeatbgm from '@/components/common/Repeatbgm.vue'
import LoginModal from '@/components/LoginModal.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()

// 登录弹窗显示状态
const showLoginModal = ref(false)

// 监听路由变化，检测是否需要登录
watch(
  () => route.name,
  (newRouteName) => {
    if (newRouteName && !authStore.isLoggedIn) {
      // 检查当前路由是否需要登录
      const requiresAuth = route.meta?.requiresAuth === true
      if (requiresAuth) {
        console.log('[App] 路由需要登录，显示登录弹窗')
        showLoginModal.value = true
      }
    }
  },
  { immediate: true }
)

// 关闭登录弹窗
function handleCloseLogin(): void {
  showLoginModal.value = false
}

// 登录成功处理
function handleLoginSuccess(): void {
  console.log('[App] 登录成功')
  showLoginModal.value = false
  // 可以在这里刷新页面数据或重新加载当前路由
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

#app {
  min-height: 100vh;
}

.top-bar {
  position: fixed;
  top: 0;
  right: 0;
  padding: 1rem;
  z-index: 100;
}
</style>