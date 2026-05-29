/**
 * 对话数据适配器
 * 负责对 level2_dialog JSON 数据进行清洗、格式化和转换操作
 */

// 原始数据类型定义
export interface RawDialogItem {
  text_id: string | null
  pre_dialog: string | null
  audio_file: string | null
  icon_dialog: string | null
}

// 处理后的数据类型定义
export interface ProcessedDialogItem {
  textId: string
  dialogText: string
  audioFile: string | null
  iconDialog: string | null
}

/**
 * 处理对话数据
 * @param rawData 原始对话数据
 * @returns 处理后的对话数据
 */
export function adaptDialogData(rawData: RawDialogItem[] | null): ProcessedDialogItem[] {
  if (!rawData || !Array.isArray(rawData)) {
    console.warn('对话数据为空或格式异常')
    return []
  }

  return rawData
    .filter(item => item && item.text_id)
    .map(item => ({
      textId: item.text_id || '',
      dialogText: item.pre_dialog || '',
      audioFile: item.audio_file || null,
      iconDialog: item.icon_dialog || null
    }))
    .filter(item => item.dialogText.trim())
}

/**
 * 获取所有对话数据
 * @param data 处理后的对话数据
 * @returns 对话数据数组
 */
export function getAllDialogs(data: ProcessedDialogItem[]): ProcessedDialogItem[] {
  return [...data]
}

/**
 * 获取特定索引的对话
 * @param data 处理后的对话数据
 * @param index 索引
 * @returns 对应的对话数据
 */
export function getDialogByIndex(data: ProcessedDialogItem[], index: number): ProcessedDialogItem | null {
  return data[index] || null
}

/**
 * 获取特定说话者的所有对话
 * @param data 处理后的对话数据
 * @param speakerName 说话者名称
 * @returns 该说话者的所有对话
 */
export function getDialogsBySpeaker(data: ProcessedDialogItem[], speakerName: string): ProcessedDialogItem[] {
  return data.filter(item => item.dialogText.includes(speakerName))
}