/**
 * 情景文本数据适配器
 * 负责对 level3_scenario_text JSON 数据进行清洗、格式化和转换操作
 */

// 原始数据类型定义
export interface RawScenarioText {
  text_id: string | null
  scenario_text: string | null
  question_number: number | null
}

// 处理后的数据类型定义
export interface ProcessedScenarioText {
  textId: string
  scenarioText: string
  questionNumber: number
}

/**
 * 处理情景文本数据
 * @param rawData 原始情景文本数据
 * @returns 处理后的情景文本数据
 */
export function adaptScenarioText(rawData: RawScenarioText[] | null): ProcessedScenarioText[] {
  if (!rawData || !Array.isArray(rawData)) {
    console.warn('情景文本数据为空或格式异常')
    return []
  }

  return rawData
    .filter(item => item && item.text_id)
    .map(item => ({
      textId: item.text_id || '',
      scenarioText: item.scenario_text || '',
      questionNumber: item.question_number || 0
    }))
    .filter(item => item.scenarioText.trim())
}

/**
 * 根据题目编号获取情景文本
 * @param data 处理后的情景文本数据
 * @param questionNumber 题目编号
 * @returns 对应的情景文本
 */
export function getScenarioTextByQuestion(
  data: ProcessedScenarioText[],
  questionNumber: number
): ProcessedScenarioText | null {
  return data.find(item => item.questionNumber === questionNumber) || null
}

/**
 * 获取所有情景文本数据
 * @param data 处理后的情景文本数据
 * @returns 情景文本数据数组
 */
export function getAllScenarios(data: ProcessedScenarioText[]): ProcessedScenarioText[] {
  return [...data]
}