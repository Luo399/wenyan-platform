import { ref } from 'vue'
import { get } from '@/utils/api'
import { debugError } from '@/utils/debug'

/**
 * 学生查询 Composable
 *
 * 提供共享的学生信息查询功能，消除 LoginModal 和 StudentDisplay 的重复调用
 *
 * 注意：学生实体类型统一从 @/types/student 的 StudentInfo 导入；
 *      本 composable 的返回基于 name 字符串，因此不再本地定义重复类型。
 */
export function useStudentQuery() {
  const isQuerying = ref(false)
  const queryError = ref<string | null>(null)

  /**
   * 根据学号查询学生姓名
   *
   * @param studentId - 学号
   * @returns 学生姓名（查询失败返回空字符串）
   */
  async function queryStudentName(studentId: string): Promise<string> {
    const trimmedId = studentId.trim()
    if (!trimmedId) {
      return ''
    }

    isQuerying.value = true
    queryError.value = null

    try {
      const response = await get<{ name: string }>(`/api/students/${trimmedId}`)
      if (response.success && response.data) {
        return response.data.name || ''
      }
      return ''
    } catch (err) {
      debugError('[useStudentQuery] 查询学生信息失败:', err)
      queryError.value = err instanceof Error ? err.message : '查询失败'
      return ''
    } finally {
      isQuerying.value = false
    }
  }

  return {
    isQuerying,
    queryError,
    queryStudentName,
  }
}
