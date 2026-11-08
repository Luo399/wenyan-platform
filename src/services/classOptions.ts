/**
 * 班级/年级选项获取服务
 * 从后端 DISTINCT 提取年级(前4) + 班级(后2)，用于 ClassPicker 下拉
 *
 * 解耦点：ClassPicker 不直接写 fetch，而是调用此 service。
 * 测试时可直接 mock 此函数或传 props 绕过网络。
 */

import { get, ApiError } from '@/utils/api'

export interface ClassOptions {
  /** 所有去重后的年级，如 ['2023', '2024', '2025'] */
  grades: string[]
  /** 年级 → 该年级下所有班级编码（6 位），如 { '2024': ['202401','202402'] } */
  gradeMap: Record<string, string[]>
}

/** 后端返回的 data 结构（与 adminController.getGradesAndClasses 对齐） */
interface GradesClassesData {
  grades?: string[]
  gradeMap?: Record<string, string[]>
}

/** 默认 API 路径（可通过 env 覆写以便测试注入） */
const DEFAULT_ENDPOINT = '/api/admin/options/grades-classes'

/**
 * 拉取年级/班级选项
 * 前端部署时 api 走同源；VITE_API_BASE_URL 已在 vite 里代理过
 *
 * 原实现裸 fetch：不带 Authorization、不判 HTTP 之外的业务失败，
 * 后端返回 success:false 时会被当成"空选项"静默吞掉。改走统一封装后，
 * 401/超时/业务失败都抛 ApiError，由调用方决定降级方式。
 */
export async function fetchGradesAndClasses(
  endpoint: string = DEFAULT_ENDPOINT,
): Promise<ClassOptions> {
  const res = await get<GradesClassesData>(endpoint)
  if (!res.success || !res.data) {
    throw new ApiError(500, 'CLASS_OPTIONS_UNAVAILABLE', res.message || '获取年级/班级选项失败')
  }
  return {
    grades: res.data.grades ?? [],
    gradeMap: res.data.gradeMap ?? {},
  }
}
