import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 从 localStorage 恢复学号
import { useStudentStore } from './stores/student'
const studentStore = useStudentStore(pinia)
studentStore.restoreFromStorage()

app.mount('#app')
