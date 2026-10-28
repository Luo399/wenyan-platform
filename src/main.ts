import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// 全局设计 Token（Figma 配色/字体/间距/圆角）
import './assets/styles/design-tokens.css'
// 全局共享组件样式（表单 / 表格 / 模态框 / 操作按钮）
import './assets/styles/components.css'
import { setupAuthGuard } from './router/guards'
import { registerChunkRecovery } from './utils/chunkRecovery'
import { useStudentStore } from './stores/student'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 注册路由守卫（鉴权依赖 authStore，须在 pinia 注册后调用）
setupAuthGuard(router)

// 懒加载路由的 chunk 拉不到时（多为旧版本 index.html 引用了已下线的 chunk）整页重载一次。
// 放在 setupAuthGuard 之后：守卫链按注册顺序执行，这样记录到的 pendingPath 是最终目标地址。
registerChunkRecovery(router)

// 从 localStorage 恢复学号与登录状态
const studentStore = useStudentStore(pinia)
studentStore.restoreFromStorage()

const authStore = useAuthStore(pinia)
authStore.initialize()

// 暴露全局引用，方便调试（生产环境也保留，用于排查导航问题）
;(window as unknown as Record<string, unknown>).__router = router

app.mount('#app')
