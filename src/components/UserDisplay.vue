<template>
  <div class="user-display">
    <!-- 未登录 -->
    <span v-if="!authStore.isLoggedIn" class="login-link" @click="goLogin">
      请登录
    </span>

    <!-- 学生 -->
    <div v-else-if="authStore.isStudent" class="user-info">
      <span class="info-text" @click="toggleMenu">
        学号：{{ studentId }}
      </span>
      <div v-if="showMenu" class="dropdown-menu">
        <div class="menu-item" @click="openChangePassword">修改密码</div>
        <div class="menu-item" @click="handleLogout">退出登录</div>
      </div>
    </div>

    <!-- 教师/管理员 -->
    <div v-else class="user-info">
      <span class="info-text" @click="toggleMenu">
        {{ teacherName }}
        <span v-if="authStore.isAdmin" class="badge">管理员</span>
      </span>
      <div v-if="showMenu" class="dropdown-menu">
        <div v-if="!authStore.isAdmin" class="menu-item" @click="goManage">
          学生管理
        </div>
        <div v-if="authStore.isAdmin" class="menu-item" @click="goAdmin">
          教师管理
        </div>
        <div class="menu-item" @click="openChangePassword">修改密码</div>
        <div class="menu-item" @click="handleLogout">退出登录</div>
      </div>
    </div>

    <ChangePasswordModal :visible="showPasswordModal" @close="showPasswordModal = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ChangePasswordModal from './ChangePasswordModal.vue'

const router = useRouter()
const authStore = useAuthStore()

const showMenu = ref(false)
const showPasswordModal = ref(false)

const studentId = computed(() => {
  const u = authStore.user as { student_id?: string } | null
  return u?.student_id || ''
})

const teacherName = computed(() => {
  const u = authStore.user as { name?: string } | null
  return u?.name || ''
})

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function goLogin() {
  router.push('/login')
}

function goManage() {
  showMenu.value = false
  router.push('/teacher/students')
}

function goAdmin() {
  showMenu.value = false
  // TODO: 管理员后台页面
  alert('管理员后台功能开发中')
}

function openChangePassword() {
  showMenu.value = false
  showPasswordModal.value = true
}

function handleLogout() {
  showMenu.value = false
  authStore.logout()
  router.push('/login')
}

// 点击外部关闭菜单
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.user-display')) {
    showMenu.value = false
  }
}

window.addEventListener('click', handleClickOutside)
</script>

<style scoped>
.user-display {
  position: relative;
  display: flex;
  align-items: center;
}

.login-link {
  color: #4f46e5;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  transition: background 0.2s;
}

.login-link:hover {
  background: #eef2ff;
}

.user-info {
  position: relative;
}

.info-text {
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.info-text:hover {
  background: #f3f4f6;
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  background: #ef4444;
  color: white;
  font-size: 0.625rem;
  border-radius: 0.25rem;
  font-weight: 600;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  min-width: 140px;
  z-index: 100;
  overflow: hidden;
}

.menu-item {
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
  transition: background 0.15s;
}

.menu-item:hover {
  background: #f3f4f6;
}
</style>
