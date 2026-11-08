/**
 * 多角色朗读数据契约
 *
 * 独立于组件定义：MultiRoleReading.vue 与 MultiRoleReadingItem.vue 互相引用时，
 * 若把类型放在父组件里再 `import type` 回来，circular-dependency-scanner 仍会
 * 判定为循环（字面量 import 边），CI 的 circular-check 会失败。
 */

/** 单句朗读片段 */
export interface MultiRoleSegment {
  sentence_index: number
  time_range: string
  role_name: string
  dialogue: string
}

/** 整篇多角色朗读数据 */
export interface MultiRoleData {
  text_id: string
  audio_file: string
  segments: MultiRoleSegment[]
}
