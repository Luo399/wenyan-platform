import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 测试：全局错误捕获（正式上线后请删除）
app.config.errorHandler = (err, instance, info) => {
  console.error('【全局错误】', err)
  console.error('【错误信息】', info)
  console.error('【组件实例】', instance)
}

// 初始化认证状态（确保 Pinia 实例挂载后，api.ts 中的 useAuthStore() 才能正常工作）
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore(pinia)
authStore.initialize()

// 启动 mock 服务（仅开发环境）
import { startMockService } from './mock/setup'
startMockService().catch(console.error)

app.mount('#app')
