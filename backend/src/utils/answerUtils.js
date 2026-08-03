/**
 * 答案比较工具模块
 * B04: 统一的答案比较逻辑，消除 controller/service 双份实现
 */

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

  // 多选：数组比较
  if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
    if (userAnswer.length === correctAnswer.length) {
      isCorrect = userAnswer.every((item) => correctAnswer.includes(item)) ? 1 : 0
    }
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
