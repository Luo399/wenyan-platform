const textsService = require('../services/textsService');

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