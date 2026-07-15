import { ref } from 'vue'
import { get } from '@/utils/api'

export function useStudentQuery() {
  const studentName = ref('')
  const isQuerying = ref(false)

  async function queryStudentName(studentId: string): Promise<void> {
    if (!studentId.trim()) {
      studentName.value = ''
      return
    }

    isQuerying.value = true
    try {
      const response = await get(`/api/students/${studentId.trim()}`)
      if (response.success && response.data) {
        studentName.value = response.data.name || ''
      } else {
        studentName.value = ''
      }
    } catch (err) {
      console.error('查询学生信息失败:', err)
      studentName.value = ''
    } finally {
      isQuerying.value = false
    }
  }

  return {
    studentName,
    isQuerying,
    queryStudentName,
  }
}
