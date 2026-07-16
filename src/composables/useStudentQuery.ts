import { ref, type Ref, unref } from 'vue'
import { get } from '@/utils/api'

export function useStudentQuery(studentId: Ref<string> | string) {
  const studentName = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchName(): Promise<void> {
    const id = unref(studentId).trim()
    if (!id) {
      studentName.value = ''
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await get(`/api/students/${id}`)
      if (response.success && response.data) {
        studentName.value = response.data.name || ''
      } else {
        studentName.value = ''
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '查询学生信息失败'
      studentName.value = ''
    } finally {
      loading.value = false
    }
  }

  return { studentName, loading, error, fetchName }
}
