/**
 * questionId 统一工具（P2 收尾）
 *
 * 背景：此前 questionId 的来源与 fallback 格式散落多处——
 *   - Figma JSON / 适配器提供的真实 question_id（如 "q1"、“1”）
 *   - useQuizProgress 的兜底拼接：`${wenId}_question_${index}`（0 基、无前缀语义）
 *   - AdaptQuiz/Level1Quiz 本地记录各自拼接 `_level{n}_q{no}` 风格
 * 造成同一课文内 ID 风格不统一、无前缀序号跨课文易混淆。
 *
 * 统一规则（单一事实来源）：
 * 1. 数据源已提供 question_id → 原样透传（后端按 wen_id 维度隔离，无需再加工）；
 * 2. 数据缺失时才生成兜底 ID：`${wenId}_q${number}`（1 基、带课文前缀，
 *    确定性生成且跨课文不冲突）。
 */

/**
 * 生成兜底 questionId：`${wenId}_q${questionNumber}`
 * @param wenId - 课文 ID（WEN_xx）
 * @param questionNumber - 题目序号（从 1 开始）
 */
export function buildQuestionId(wenId: string, questionNumber: number): string {
  return `${wenId}_q${questionNumber}`
}

/**
 * 统一的 questionId 解析入口：
 * 数据源 questionId 存在时原样返回；否则用 buildQuestionId 生成兜底 ID。
 *
 * @param wenId - 课文 ID
 * @param questionId - 数据源提供的题目 ID（可空）
 * @param questionNumber - 题目序号（从 1 开始，用于兜底 ID）
 */
export function resolveQuestionId(
  wenId: string,
  questionId: string | undefined,
  questionNumber: number,
): string {
  if (questionId && questionId.trim() !== '') {
    return questionId
  }
  return buildQuestionId(wenId, questionNumber)
}
