import { computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

interface StudentInfo {
  id: string
  name: string
  isLoading: boolean
  error: string | null
}

export function useStudentInfo() {
  const authStore = useAuthStore()

  const studentId = computed(() => {
    if (!authStore.isLoggedIn || !authStore.user) {
      return ''
    }
    return authStore.user.studentId
  })

  function getStudentName(): string {
    if (!authStore.isLoggedIn || !authStore.user) {
      return ''
    }
    return authStore.user.username
  }

  function getStudentInfo(): StudentInfo {
    const id = studentId.value
    if (!id) {
      return {
        id: '',
        name: '',
        isLoading: false,
        error: '未找到学生信息',
      }
    }

    return {
      id,
      name: getStudentName(),
      isLoading: false,
      error: null,
    }
  }

  function clearCache() {}

  watch(
    () => authStore.isLoggedIn,
    () => {
      clearCache()
    },
  )

  onMounted(() => {
    authStore.initialize()
  })

  return {
    studentId,
    getStudentName,
    getStudentInfo,
    clearCache,
  }
}