const fs = require('fs');
const path = require('path');
const config = require('../config/app');
const logger = require('./logger');

/**
 * S03: textId / wenId 白名单校验，防止路径穿越
 * 允许 字母、数字、下划线、连字符；目录名（dirName）固定来自服务端代码，不受用户输入控制
 */
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function assertSafeTextId(id) {
  if (!id || typeof id !== 'string' || !SAFE_ID_PATTERN.test(id)) {
    const err = new Error('Invalid textId format');
    err.statusCode = 400;
    err.error = 'INVALID_TEXT_ID';
    err.message = 'textId 格式非法';
    throw err;
  }
  return id;
}

function safeParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
    return null;
  } catch (err) {
    logger.error(`读取文件失败 ${filePath}:`, err);
    return null;
  }
}

function getDataFilePath(dirName, fileName) {
  // S03: 用户可控的文件名（textId/wenId）必须通过白名单校验；空串用于目录枚举（getTextList）
  if (fileName && !SAFE_ID_PATTERN.test(fileName.replace(/\.json$/, ''))) {
    const err = new Error('Invalid textId format');
    err.statusCode = 400;
    err.error = 'INVALID_TEXT_ID';
    err.message = 'textId 格式非法';
    throw err;
  }
  return path.join(config.data.basePath, dirName, fileName);
}

function extractAnswer(obj) {
  if (obj && (obj.correctAnswer !== undefined || obj.correct_answer !== undefined)) {
    return obj.correctAnswer ?? obj.correct_answer;
  }
  return undefined;
}

function matchesId(obj, questionId) {
  return obj.id === questionId || obj.question_id === questionId || obj.questionId === questionId;
}

function findAnswerInData(data, questionId) {
  if (!data) return undefined;

  // data.questions 数组
  if (data.questions && Array.isArray(data.questions)) {
    const found = data.questions.find((q) => matchesId(q, questionId));
    const answer = extractAnswer(found);
    if (answer !== undefined) return answer;
  }

  // data.blocks 数组（含 block.type === 'quiz' 的块）
  if (data.blocks && Array.isArray(data.blocks)) {
    for (const block of data.blocks) {
      if (block.type === 'quiz' && block.data) {
        const blockData = block.data;
        if (blockData.questions && Array.isArray(blockData.questions)) {
          const found = blockData.questions.find((q) => matchesId(q, questionId));
          const answer = extractAnswer(found);
          if (answer !== undefined) return answer;
        } else {
          const answer = matchesId(blockData, questionId) ? extractAnswer(blockData) : undefined;
          if (answer !== undefined) return answer;
        }
      }
    }
  }

  // data.quiz 数组
  if (data.quiz && Array.isArray(data.quiz)) {
    const found = data.quiz.find((q) => matchesId(q, questionId));
    const answer = extractAnswer(found);
    if (answer !== undefined) return answer;
  }

  // data.items 数组（含 item.quiz）
  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      if (item.quiz) {
        const answer = matchesId(item.quiz, questionId) ? extractAnswer(item.quiz) : undefined;
        if (answer !== undefined) return answer;
      }
    }
  }

  // 顶层是数组的情况
  if (Array.isArray(data)) {
    for (const item of data) {
      const answer = matchesId(item, questionId) ? extractAnswer(item) : undefined;
      if (answer !== undefined) return answer;
    }
  }

  return undefined;
}

function getCorrectAnswerFromJson(questionId, wenId) {
  // S03: wenId 用户可控（来自 req.params），先做白名单校验再拼接路径
  if (!SAFE_ID_PATTERN.test(wenId || '')) {
    return null;
  }
  const searchPaths = [
    ...['level1_quiz', 'level2_quiz', 'level3_adaptive_quiz'].map(
      (dir) => getDataFilePath(dir, `${wenId}.json`)
    ),
    getDataFilePath('pages_level2_dialog_quiz', `${wenId}.json`),
    getDataFilePath('pages_level3_adaptive_quiz', `${wenId}.json`),
    getDataFilePath('text-quiz', `${wenId}.json`),
  ];

  for (const filePath of searchPaths) {
    const data = readJsonFile(filePath);
    const answer = findAnswerInData(data, questionId);
    if (answer !== undefined) return answer;
  }

  return null;
}

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