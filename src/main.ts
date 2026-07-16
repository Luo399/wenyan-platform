import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 从 localStorage 恢复认证状态
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore(pinia)
authStore.initialize()

app.mount('#app')
