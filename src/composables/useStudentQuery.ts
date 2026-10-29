import { ref } from 'vue'
import { get, ApiError } from '@/utils/api'
import { debugError } from '@/utils/debug'
import { getAuthData } from '@/utils/localStorage'

/**
 * 学生查询 Composable
 *
 * 提供共享的学生信息查询功能，消除 LoginModal 和 StudentDisplay 的重复调用
 *
 * 注意：学生实体类型统一从 @/types/student 的 StudentInfo 导入；
 *      本 composable 的返回基于 name 字符串，因此不再本地定义重复类型。
 *
 * R105（安全收紧）：`/api/students/:id/name` 现在需要登录才能访问。
 *   学号→姓名的公开映射本身就是「枚举学号 → 拿姓名 → 猜口令」的前置步骤，
 *   因此未登录时直接返回空串、不发请求；调用方（登录页/StudentDisplay）
 *   本来就只在 name 非空时展示，未登录就不再显示姓名。
 */
export function useStudentQuery() {
  const isQuerying = ref(false)
  const queryError = ref<string | null>(null)

  /**
   * 根据学号查询学生姓名
   *
   * @param studentId - 学号
   * @returns 学生姓名（未登录/学生不存在/查询失败均返回空字符串）
   */
  async function queryStudentName(studentId: string): Promise<string> {
    const trimmedId = studentId.trim()
    if (!trimmedId) {
      return ''
    }

    // 未登录不发请求：接口需要身份，且公开枚举姓名本身就是信息泄露
    if (!getAuthData().token) {
      return ''
    }

    isQuerying.value = true
    queryError.value = null

    try {
      const response = await get<{ name: string; student_id?: string }>(
        `/api/students/${encodeURIComponent(trimmedId)}/name`,
      )
      if (response.success && response.data) {
        return response.data.name || ''
      }
      return ''
    } catch (err) {
      // 学生不存在是输入过程中的正常状态，不当作错误提示
      if (err instanceof ApiError && err.status === 404) {
        return ''
      }
      // 登录态正好失效时也不要打扰用户，交给统一的 401 处理
      if (err instanceof ApiError && err.status === 401) {
        return ''
      }
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
