/**
 * 课文数据服务模块
 * 提供课文相关的数据访问功能
 */

const fs = require('fs');
const { readJsonFile, getDataFilePath } = require('../utils/jsonReader');

/**
 * 获取课文基础信息
 * @param {string} textId - 课文ID
 * @returns {object|null} - 课文基础信息
 */
function getBasicInfo(textId) {
  const filePath = getDataFilePath('text_basic_info', `${textId}.json`);
  return readJsonFile(filePath);
}

/**
 * 获取字词注释列表
 * @param {string} textId - 课文ID
 * @returns {object|null} - 字词注释数据
 */
function getWordList(textId) {
  const filePath = getDataFilePath('word_list', `${textId}.json`);
  return readJsonFile(filePath);
}

/**
 * 获取多角色朗读数据
 * @param {string} textId - 课文ID
 * @returns {object|null} - 多角色朗读数据
 */
function getMultiRoleReading(textId) {
  const filePath = getDataFilePath('multi_role_reading', `${textId}.json`);
  return readJsonFile(filePath);
}

/**
 * 获取一级测验数据
 * @param {string} textId - 课文ID
 * @returns {object|null} - 一级测验数据
 */
function getLevel1Quiz(textId) {
  const filePath = getDataFilePath('level1_quiz', `${textId}.json`);
  return readJsonFile(filePath);
}

/**
 * 获取二级对话数据
 * @param {string} textId - 课文ID
 * @returns {object|null} - 二级对话数据
 */
function getLevel2Dialog(textId) {
  const filePath = getDataFilePath('level2_dialog', `${textId}.json`);
  return readJsonFile(filePath);
}

/**
 * 获取二级测验数据
 * @param {string} textId - 课文ID
 * @returns {object|null} - 二级测验数据
 */
function getLevel2Quiz(textId) {
  const filePath = getDataFilePath('level2_quiz', `${textId}.json`);
  return readJsonFile(filePath);
}

/**
 * 获取三级情景文本数据
 * @param {string} textId - 课文ID
 * @returns {object|null} - 三级情景文本数据
 */
function getLevel3ScenarioText(textId) {
  const filePath = getDataFilePath('level3_scenario_text', `${textId}.json`);
  return readJsonFile(filePath);
}

/**
 * 获取三级自适应测验数据
 * @param {string} textId - 课文ID
 * @returns {object|null} - 三级自适应测验数据
 */
function getLevel3AdaptiveQuiz(textId) {
  const filePath = getDataFilePath('level3_adaptive_quiz', `${textId}.json`);
  return readJsonFile(filePath);
}

/**
 * 获取课文列表（支持分页）
 * @param {number} [page=1] - 页码
 * @param {number} [pageSize=20] - 每页数量
 * @returns {object} - 课文列表及分页信息
 */
function getTextList(page = 1, pageSize = 20) {
  const basicInfoDir = getDataFilePath('text_basic_info', '');
  
  const texts = [];
  
  if (fs.existsSync(basicInfoDir)) {
    const files = fs.readdirSync(basicInfoDir);
    files.forEach((file) => {
      if (file.endsWith('.json')) {
        const filePath = `${basicInfoDir}/${file}`;
        const data = readJsonFile(filePath);
        if (data && data.text_id) {
          texts.push({
            text_id: data.text_id,
            title: data.title,
            author: data.author,
            dynasty: data.dynasty,
          });
        }
      }
    });
  }

  // 分页处理
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTexts = texts.slice(startIndex, endIndex);

  return {
    total: texts.length,
    texts: paginatedTexts,
  };
}

/**
 * 批量获取课文数据
 * @param {Array} textIds - 课文ID数组
 * @returns {Array} - 课文数据数组
 */
function getTextsBatch(textIds) {
  return textIds.map((textId) => {
    const basicInfoPath = getDataFilePath('text_basic_info', `${textId}.json`);
    const wordListPath = getDataFilePath('word_list', `${textId}.json`);
    const basicInfo = readJsonFile(basicInfoPath);
    const wordList = readJsonFile(wordListPath);

    return {
      text_id: textId,
      basic_info: basicInfo,
      word_list: wordList || [],
    };
  });
}

/**
 * 获取页面配置数据（二级对话测验页面）
 * @param {string} textId - 课文ID
 * @returns {object|null} - 页面配置数据
 */
function getPageLevel2DialogQuiz(textId) {
  const filePath = getDataFilePath('pages_level2_dialog_quiz', `${textId}.json`);
  return readJsonFile(filePath);
}

/**
 * 获取页面配置数据（三级自适应测验页面）
 * @param {string} textId - 课文ID
 * @returns {object|null} - 页面配置数据
 */
function getPageLevel3AdaptiveQuiz(textId) {
  const filePath = getDataFilePath('pages_level3_adaptive_quiz', `${textId}.json`);
  return readJsonFile(filePath);
}

module.exports = {
  getBasicInfo,
  getWordList,
  getMultiRoleReading,
  getLevel1Quiz,
  getLevel2Dialog,
  getLevel2Quiz,
  getLevel3ScenarioText,
  getLevel3AdaptiveQuiz,
  getTextList,
  getTextsBatch,
  getPageLevel2DialogQuiz,
  getPageLevel3AdaptiveQuiz
};