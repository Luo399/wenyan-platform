const textsService = require('../services/textsService');

/**
 * 高阶函数：创建基于 textId 的文本数据处理器
 * @param {string} serviceMethod - textsService 上的方法名
 * @param {string} errorMessage - 404 时的错误描述（如 "文本基础信息"）
 * @returns {function} Express route handler
 */
function createTextHandler(serviceMethod, errorMessage) {
  return function (req, res) {
    const { textId } = req.params;
    const data = textsService[serviceMethod](textId);

    if (data) {
      res.json({ success: true, data });
    } else {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `${errorMessage}不存在: ${textId}`,
      });
    }
  };
}

const getBasicInfo = createTextHandler('getBasicInfo', '文本基础信息');
const getWordList = createTextHandler('getWordList', '字词注释');
const getMultiRoleReading = createTextHandler('getMultiRoleReading', '多角色朗读数据');
const getLevel1Quiz = createTextHandler('getLevel1Quiz', '一级测验数据');
const getCultureCards = createTextHandler('getCultureCards', '文化卡片数据');
const getLevel2Dialog = createTextHandler('getLevel2Dialog', '二级对话数据');
const getLevel2Quiz = createTextHandler('getLevel2Quiz', '二级测验数据');
const getLevel3ScenarioText = createTextHandler('getLevel3ScenarioText', '三级情景文本');
const getLevel3AdaptiveQuiz = createTextHandler('getLevel3AdaptiveQuiz', '三级自适应测验数据');

function getTextList(req, res) {
  const page = isNaN(parseInt(req.query.page))
    ? 1
    : Math.max(1, Math.abs(parseInt(req.query.page)));

  const pageSize = isNaN(parseInt(req.query.page_size))
    ? 20
    : Math.min(100, Math.max(1, Math.abs(parseInt(req.query.page_size))));

  const result = textsService.getTextList(page, pageSize);

  res.json({
    success: true,
    data: result,
  });
}

function getTextsBatch(req, res) {
  try {
    const { text_ids } = req.body;

    if (!Array.isArray(text_ids) || text_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'text_ids 必须是非空数组',
      });
    }

    const results = textsService.getTextsBatch(text_ids);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error('批量获取文本数据失败:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
}

module.exports = {
  getBasicInfo,
  getWordList,
  getMultiRoleReading,
  getLevel1Quiz,
  getCultureCards,
  getLevel2Dialog,
  getLevel2Quiz,
  getLevel3ScenarioText,
  getLevel3AdaptiveQuiz,
  getTextList,
  getTextsBatch
};
