/**
 * 课文数据控制器模块
 * 处理课文相关的HTTP请求
 */

const textsService = require('../services/textsService');

/**
 * 获取课文基础信息
 * GET /api/texts/:textId/basic-info
 */
function getBasicInfo(req, res) {
  const { textId } = req.params;
  const data = textsService.getBasicInfo(textId);

  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `文本基础信息不存在: ${textId}`,
    });
  }
}

/**
 * 获取字词注释
 * GET /api/texts/:textId/word-list
 */
function getWordList(req, res) {
  const { textId } = req.params;
  const data = textsService.getWordList(textId);

  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `字词注释不存在: ${textId}`,
    });
  }
}

/**
 * 获取多角色朗读数据
 * GET /api/texts/:textId/multi-role-reading
 */
function getMultiRoleReading(req, res) {
  const { textId } = req.params;
  const data = textsService.getMultiRoleReading(textId);

  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `多角色朗读数据不存在: ${textId}`,
    });
  }
}

/**
 * 获取一级测验数据
 * GET /api/texts/:textId/level1-quiz
 */
function getLevel1Quiz(req, res) {
  const { textId } = req.params;
  const data = textsService.getLevel1Quiz(textId);

  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `一级测验数据不存在: ${textId}`,
    });
  }
}

/**
 * 获取文化卡片数据
 * GET /api/texts/:textId/culture-cards
 */
function getCultureCards(req, res) {
  const { textId } = req.params;
  const data = textsService.getCultureCards(textId);

  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `文化卡片数据不存在: ${textId}`,
    });
  }
}

/**
 * 获取二级对话数据
 * GET /api/texts/:textId/level2-dialog
 */
function getLevel2Dialog(req, res) {
  const { textId } = req.params;
  const data = textsService.getLevel2Dialog(textId);

  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `二级对话数据不存在: ${textId}`,
    });
  }
}

/**
 * 获取二级测验数据
 * GET /api/texts/:textId/level2-quiz
 */
function getLevel2Quiz(req, res) {
  const { textId } = req.params;
  const data = textsService.getLevel2Quiz(textId);

  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `二级测验数据不存在: ${textId}`,
    });
  }
}

/**
 * 获取三级情景文本数据
 * GET /api/texts/:textId/level3-scenario-text
 */
function getLevel3ScenarioText(req, res) {
  const { textId } = req.params;
  const data = textsService.getLevel3ScenarioText(textId);

  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `三级情景文本不存在: ${textId}`,
    });
  }
}

/**
 * 获取三级自适应测验数据
 * GET /api/texts/:textId/level3-adaptive-quiz
 */
function getLevel3AdaptiveQuiz(req, res) {
  const { textId } = req.params;
  const data = textsService.getLevel3AdaptiveQuiz(textId);

  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `三级自适应测验数据不存在: ${textId}`,
    });
  }
}

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