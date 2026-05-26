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

// 从 localStorage 恢复学号
import { useStudentStore } from './stores/student'
const studentStore = useStudentStore(pinia)
studentStore.restoreFromStorage()

app.mount('#app')
