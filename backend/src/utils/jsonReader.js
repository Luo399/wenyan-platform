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
 * 从对象中提取正确答案
 * @param {object} obj - 包含答案字段的对象
 * @returns {any|undefined} - 正确答案，不存在则返回 undefined
 */
function extractAnswer(obj) {
  if (obj.correctAnswer !== undefined) return obj.correctAnswer;
  if (obj.correct_answer !== undefined) return obj.correct_answer;
  return undefined;
}

/**
 * 匹配题目ID（支持多种ID字段）
 * @param {object} obj - 对象
 * @param {string} questionId - 题目ID
 * @returns {boolean} - 是否匹配
 */
function matchesQuestionId(obj, questionId) {
  return obj.id === questionId || obj.question_id === questionId || obj.questionId === questionId;
}

/**
 * 在题目数组中查找（用于 questions/quiz 数组）
 * @param {Array} arr - 数组
 * @param {string} questionId - 题目ID
 * @returns {any|undefined} - 找到的答案或 undefined
 */
function findAnswerInQuestionArray(arr, questionId) {
  if (!Array.isArray(arr)) return undefined;
  const item = arr.find((q) => q.id === questionId || q.questionId === questionId);
  if (item) {
    const answer = extractAnswer(item);
    if (answer !== undefined) return answer;
  }
  return undefined;
}

/**
 * 在 blocks 中查找 quiz 块
 * @param {Array} blocks - blocks 数组
 * @param {string} questionId - 题目ID
 * @returns {any|undefined} - 找到的答案或 undefined
 */
function findAnswerInBlocks(blocks, questionId) {
  if (!Array.isArray(blocks)) return undefined;
  for (const block of blocks) {
    if (block.type === 'quiz' && block.data) {
      const blockData = block.data;
      const answer = findAnswerInQuestionArray(blockData.questions, questionId);
      if (answer !== undefined) return answer;

      if (matchesQuestionId(blockData, questionId)) {
        const blockAnswer = extractAnswer(blockData);
        if (blockAnswer !== undefined) return blockAnswer;
      }
    }
  }
  return undefined;
}

/**
 * 在 items 数组中查找（level3 adaptive quiz 结构）
 * @param {Array} items - items 数组
 * @param {string} questionId - 题目ID
 * @returns {any|undefined} - 找到的答案或 undefined
 */
function findAnswerInItems(items, questionId) {
  if (!Array.isArray(items)) return undefined;
  for (const item of items) {
    if (item.quiz && matchesQuestionId(item.quiz, questionId)) {
      const answer = extractAnswer(item.quiz);
      if (answer !== undefined) return answer;
    }
  }
  return undefined;
}

/**
 * 在扁平数组中查找
 * @param {Array} data - 数组
 * @param {string} questionId - 题目ID
 * @returns {any|undefined} - 找到的答案或 undefined
 */
function findAnswerInFlatArray(data, questionId) {
  if (!Array.isArray(data)) return undefined;
  for (const item of data) {
    if (matchesQuestionId(item, questionId)) {
      const answer = extractAnswer(item);
      if (answer !== undefined) return answer;
    }
  }
  return undefined;
}

/**
 * 根据题目ID和课文ID从JSON文件获取正确答案
 * @param {string} questionId - 题目ID
 * @param {string} wenId - 课文ID
 * @returns {any|null} - 正确答案，找不到返回null
 */
function getCorrectAnswerFromJson(questionId, wenId) {
  // 搜索策略数组，按优先级排列
  const searchStrategies = [
    (data) => findAnswerInQuestionArray(data.questions, questionId),
    (data) => findAnswerInBlocks(data.blocks, questionId),
    (data) => findAnswerInQuestionArray(data.quiz, questionId),
    (data) => findAnswerInItems(data.items, questionId),
    (data) => findAnswerInFlatArray(data, questionId),
  ];

  // 数据来源配置，按优先级排列
  const dataSources = [
    'level1_quiz',
    'level2_quiz',
    'level3_adaptive_quiz',
    'pages_level2_dialog_quiz',
    'pages_level3_adaptive_quiz',
    'text-quiz',
  ];

  for (const dir of dataSources) {
    const filePath = getDataFilePath(dir, `${wenId}.json`);
    const data = readJsonFile(filePath);
    if (!data) continue;

    for (const strategy of searchStrategies) {
      const answer = strategy(data);
      if (answer !== undefined) return answer;
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