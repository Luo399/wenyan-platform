import { computed } from 'vue'
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
    // 兼容学生和教师角色（学生返回 student_id，其他返回空）
    const user = authStore.user as Record<string, any>
    return user.student_id || ''
  })

  function getStudentName(): string {
    if (!authStore.isLoggedIn || !authStore.user) {
      return ''
    }
    const user = authStore.user as Record<string, any>
    return user.name || user.student_name || ''
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

  return {
    studentId,
    getStudentName,
    getStudentInfo,
    clearCache,
  }
}
