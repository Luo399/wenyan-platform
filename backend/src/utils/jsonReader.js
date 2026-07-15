const fs = require('fs');
const path = require('path');
const config = require('../config/app');

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
    console.error(`读取文件失败 ${filePath}:`, err);
    return null;
  }
}

function getDataFilePath(dirName, fileName) {
  return path.join(config.data.basePath, dirName, fileName);
}

function getCorrectAnswerFromJson(questionId, wenId) {
  const possibleDirs = ['level1_quiz', 'level2_quiz', 'level3_adaptive_quiz'];

  for (const dir of possibleDirs) {
    const filePath = getDataFilePath(dir, `${wenId}.json`);
    const data = readJsonFile(filePath);

    if (data) {
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

      if (data.blocks && Array.isArray(data.blocks)) {
        for (const block of data.blocks) {
          if (block.type === 'quiz' && block.data) {
            const blockData = block.data;
            if (blockData.questions && Array.isArray(blockData.questions)) {
              const question = blockData.questions.find(
                (q) => q.id === questionId || q.questionId === questionId
              );
              if (
                question &&
                (question.correctAnswer !== undefined || question.correct_answer !== undefined)
              ) {
                return question.correctAnswer ?? question.correct_answer;
              }
            } else if (
              (blockData.id === questionId ||
                blockData.question_id === questionId ||
                blockData.questionId === questionId) &&
              (blockData.correctAnswer !== undefined ||
                blockData.correct_answer !== undefined)
            ) {
              return blockData.correctAnswer ?? blockData.correct_answer;
            }
          }
        }
      }

      if (data.quiz && Array.isArray(data.quiz)) {
        const question = data.quiz.find((q) => q.id === questionId || q.questionId === questionId);
        if (
          question &&
          (question.correctAnswer !== undefined || question.correct_answer !== undefined)
        ) {
          return question.correctAnswer ?? question.correct_answer;
        }
      }

      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.quiz) {
            const quiz = item.quiz;
            if (
              (quiz.id === questionId ||
                quiz.question_id === questionId ||
                quiz.questionId === questionId) &&
              (quiz.correctAnswer !== undefined || quiz.correct_answer !== undefined)
            ) {
              return quiz.correctAnswer ?? quiz.correct_answer;
            }
          }
        }
      }

      if (Array.isArray(data)) {
        for (const item of data) {
          if (
            (item.id === questionId ||
              item.question_id === questionId ||
              item.questionId === questionId) &&
            (item.correctAnswer !== undefined || item.correct_answer !== undefined)
          ) {
            return item.correctAnswer ?? item.correct_answer;
          }
        }
      }
    }
  }

  const pageConfigs = [
    getDataFilePath('pages_level2_dialog_quiz', `${wenId}.json`),
    getDataFilePath('pages_level3_adaptive_quiz', `${wenId}.json`),
    getDataFilePath('text-quiz', `${wenId}.json`),
  ];

  for (const filePath of pageConfigs) {
    const data = readJsonFile(filePath);
    if (data) {
      if (data.blocks && Array.isArray(data.blocks)) {
        for (const block of data.blocks) {
          if (block.type === 'quiz' && block.data) {
            const blockData = block.data;
            if (blockData.questions && Array.isArray(blockData.questions)) {
              const question = blockData.questions.find(
                (q) => q.id === questionId || q.questionId === questionId
              );
              if (
                question &&
                (question.correctAnswer !== undefined || question.correct_answer !== undefined)
              ) {
                return question.correctAnswer ?? question.correct_answer;
              }
            } else if (
              (blockData.id === questionId ||
                blockData.question_id === questionId ||
                blockData.questionId === questionId) &&
              (blockData.correctAnswer !== undefined ||
                blockData.correct_answer !== undefined)
            ) {
              return blockData.correctAnswer ?? blockData.correct_answer;
            }
          }
        }
      }

      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.quiz) {
            const quiz = item.quiz;
            if (
              (quiz.id === questionId ||
                quiz.question_id === questionId ||
                quiz.questionId === questionId) &&
              (quiz.correctAnswer !== undefined || quiz.correct_answer !== undefined)
            ) {
              return quiz.correctAnswer ?? quiz.correct_answer;
            }
          }
        }
      }
    }
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