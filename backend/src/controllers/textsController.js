/**
 * 课文数据控制器模块
 * 处理课文相关的HTTP请求
 */

const textsService = require('../services/textsService');

/**
 * 创建标准文本 getter 处理函数
 * @param {Function} serviceMethod - textsService 上的方法
 * @param {string} resourceName - 资源名称（用于 404 错误消息）
 * @returns {Function} Express handler
 */
function createTextHandler(serviceMethod, resourceName) {
  return function (req, res) {
    const { textId } = req.params;
    const data = serviceMethod(textId);

    if (data) {
      res.json({ success: true, data });
    } else {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `${resourceName}不存在: ${textId}`,
      });
    }
  };
}

const getBasicInfo = createTextHandler(textsService.getBasicInfo, '文本基础信息');
const getWordList = createTextHandler(textsService.getWordList, '字词注释');
const getMultiRoleReading = createTextHandler(textsService.getMultiRoleReading, '多角色朗读数据');
const getLevel1Quiz = createTextHandler(textsService.getLevel1Quiz, '一级测验数据');
const getCultureCards = createTextHandler(textsService.getCultureCards, '文化卡片数据');
const getLevel2Dialog = createTextHandler(textsService.getLevel2Dialog, '二级对话数据');
const getLevel2Quiz = createTextHandler(textsService.getLevel2Quiz, '二级测验数据');
const getLevel3ScenarioText = createTextHandler(textsService.getLevel3ScenarioText, '三级情景文本');
const getLevel3AdaptiveQuiz = createTextHandler(textsService.getLevel3AdaptiveQuiz, '三级自适应测验数据');

/**
 * 获取课文列表（支持分页）
 * GET /api/texts
 */
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

/**
 * 批量获取课文数据
 * POST /api/texts/batch
 */
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