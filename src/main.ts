import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// 全局设计 Token（Figma 配色/字体/间距/圆角）
import './assets/styles/design-tokens.css'
import { setupAuthGuard } from './router/guards'
import { useStudentStore } from './stores/student'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 注册路由守卫（鉴权依赖 authStore，须在 pinia 注册后调用）
setupAuthGuard(router)

// 从 localStorage 恢复学号与登录状态
const studentStore = useStudentStore(pinia)
studentStore.restoreFromStorage()

const authStore = useAuthStore(pinia)
authStore.initialize()

app.mount('#app')
