/**
 * 答案比较工具模块
 * B04: 统一的答案比较逻辑，消除 controller/service 双份实现
 */

/**
 * 多选答案归一化为集合：
 * - 先按 String().trim() 归一化，与单选的类型转换语义保持一致
 * - 再去重，避免 ['a','a'] 与 ['a','b'] 因长度相同被误判
 * @param {Array} answer - 答案数组
 * @returns {Set<string>}
 */
function toAnswerSet(answer) {
  const set = new Set()
  for (const item of answer) {
    set.add(String(item).trim())
  }
  return set
}

/**
 * 比较用户答案与正确答案
 * @param {*} userAnswer - 用户答案
 * @param {*} correctAnswer - 正确答案
 * @returns {{ score: number, isCorrect: number }} - 分数(0/100)和是否正确(0/1)
 */
function compareAnswers(userAnswer, correctAnswer) {
  let isCorrect = 0

  // 空答案判定为错误
  if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
    return { score: 0, isCorrect: 0 }
  }

  // 正确答案缺失时无法判断，按错误处理
  if (correctAnswer === undefined || correctAnswer === null || correctAnswer === '') {
    return { score: 0, isCorrect: 0 }
  }

  // 多选：集合比较（各自去重后比较长度与成员）
  if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
    const userSet = toAnswerSet(userAnswer)
    const correctSet = toAnswerSet(correctAnswer)
    if (userSet.size !== correctSet.size) {
      return { score: 0, isCorrect: 0 }
    }
    isCorrect = [...userSet].every((item) => correctSet.has(item)) ? 1 : 0
  } else if (Array.isArray(userAnswer) || Array.isArray(correctAnswer)) {
    // 一个数组一个非数组，判定为错误
    isCorrect = 0
  } else {
    // 单选：直接比较（转为字符串处理）
    isCorrect = String(userAnswer).trim() === String(correctAnswer).trim() ? 1 : 0
  }

  return { score: isCorrect === 1 ? 100 : 0, isCorrect }
}

module.exports = { compareAnswers }
