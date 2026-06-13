/**
 * JSON文件读取工具模块
 * 提供安全的JSON文件读取功能
 */

const fs = require('fs');
const path = require('path');
const config = require('../config/app');

/**
 * 安全解析JSON字符串
 */
function safeParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * 从JSON文件读取数据
 * @param {string} filePath - 文件路径
 * @returns {object|null} - 解析后的JSON数据，读取失败返回null
 */
function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
    return null;
  } catch (err) {
    console.error(`读取文件失败 ${filePath}:`, err);
    return null;
  }
}

/**
 * 构建数据文件路径
 * @param {string} dirName - 数据目录名
 * @param {string} fileName - 文件名
 * @returns {string} - 完整路径
 */
function getDataFilePath(dirName, fileName) {
  return path.join(config.data.basePath, dirName, fileName);
}

/**
 * 根据题目ID和课文ID从JSON文件获取正确答案
 * @param {string} questionId - 题目ID
 * @param {string} wenId - 课文ID
 * @returns {any|null} - 正确答案，找不到返回null
 */
function getCorrectAnswerFromJson(questionId, wenId) {
  const possibleDirs = ['level1_quiz', 'level2_quiz', 'level3_adaptive_quiz'];

  for (const dir of possibleDirs) {
    const filePath = getDataFilePath(dir, `${wenId}.json`);
    const data = readJsonFile(filePath);

    if (data) {
      // 尝试在 questions 数组中查找
      if (data.questions && Array.isArray(data.questions)) {
        const question = data.questions.find(
          (q) => q.id === questionId || q.questionId === questionId
        );
        if (
          question &&
          (question.correctAnswer !== undefined || question.correct_answer !== undefined)
        ) {
          return question.correctAnswer ?? question.correct_answer;
        }
      }

      // 尝试在 blocks 中查找 quiz 块
      if (data.blocks && Array.isArray(data.blocks)) {
        for (const block of data.blocks) {
          if (block.type === 'quiz' && block.data && block.data.questions) {
            const question = block.data.questions.find(
              (q) => q.id === questionId || q.questionId === questionId
            );
            if (
              question &&
              (question.correctAnswer !== undefined || question.correct_answer !== undefined)
            ) {
              return question.correctAnswer ?? question.correct_answer;
            }
          }
        }
      }

      // 尝试在 quiz 数组中查找（扁平结构）
      if (data.quiz && Array.isArray(data.quiz)) {
        const question = data.quiz.find((q) => q.id === questionId || q.questionId === questionId);
        if (
          question &&
          (question.correctAnswer !== undefined || question.correct_answer !== undefined)
        ) {
          return question.correctAnswer ?? question.correct_answer;
        }
      }
    }
  }

  // 如果在测验文件中找不到，尝试从页面配置文件中查找
  const pageConfigs = [
    getDataFilePath('pages_level2_dialog_quiz', `${wenId}.json`),
    getDataFilePath('pages_level3_adaptive_quiz', `${wenId}.json`),
  ];

  for (const filePath of pageConfigs) {
    const data = readJsonFile(filePath);
    if (data && data.blocks && Array.isArray(data.blocks)) {
      for (const block of data.blocks) {
        if (block.type === 'quiz' && block.data && block.data.questions) {
          const question = block.data.questions.find(
            (q) => q.id === questionId || q.questionId === questionId
          );
          if (
            question &&
            (question.correctAnswer !== undefined || question.correct_answer !== undefined)
          ) {
            return question.correctAnswer ?? question.correct_answer;
          }
        }
      }
    }
  }

  return null;
}

/**
 * 处理答案值，确保格式正确
 * @param {any} value - 答案值
 * @returns {any} - 处理后的答案值
 */
function processAnswerValue(value) {
  if (value === null || value === undefined) return null;
  if (value === 'unknown') return null;
  if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

module.exports = {
  safeParse,
  readJsonFile,
  getDataFilePath,
  getCorrectAnswerFromJson,
  processAnswerValue
};