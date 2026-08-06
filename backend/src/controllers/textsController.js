/**
 * 课文数据控制器模块
 * 处理课文相关的HTTP请求
 */

const textsService = require('../services/textsService')
const logger = require('../utils/logger')

// ==================== 高阶函数：统一 getter 处理逻辑 ====================

/**
 * 创建文本数据获取处理器
 * @param {Function} serviceFn - 服务函数
 * @param {string} dataName - 数据名称（用于错误消息）
 * @param {Function} [responseFormatter] - 可选的响应格式化函数
 * @returns {Function} - Express 路由处理器
 */
function createTextHandler(serviceFn, dataName, responseFormatter = null) {
  return (req, res) => {
    const { textId } = req.params
    // S03: textId 白名单校验，防止路径穿越
    if (!/^[A-Za-z0-9_-]+$/.test(textId || '')) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TEXT_ID',
        message: 'textId 格式非法',
      })
    }
    const data = serviceFn(textId)

    if (data) {
      const responseData = responseFormatter ? responseFormatter(textId, data) : data
      res.json({ success: true, data: responseData })
    } else {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `${dataName}不存在: ${textId}`,
      })
    }
  }
}

// ==================== 路由处理器 ====================

const getBasicInfo = createTextHandler(textsService.getBasicInfo, '文本基础信息')
const getWordList = createTextHandler(textsService.getWordList, '字词注释')
const getMultiRoleReading = createTextHandler(textsService.getMultiRoleReading, '多角色朗读数据')
const getLevel1Quiz = createTextHandler(textsService.getLevel1Quiz, '一级测验数据')
const getCultureCards = createTextHandler(textsService.getCultureCards, '文化卡片数据')
const getLevel2Dialog = createTextHandler(textsService.getLevel2Dialog, '二级对话数据')
const getLevel2Quiz = createTextHandler(
  textsService.getLevel2Quiz,
  '二级测验数据',
  (textId, data) => ({ text_id: textId, questions: data })
)
const getLevel3ScenarioText = createTextHandler(textsService.getLevel3ScenarioText, '三级情景文本')
const getLevel3AdaptiveQuiz = createTextHandler(
  textsService.getLevel3AdaptiveQuiz,
  '三级自适应测验数据',
  (textId, data) => ({ text_id: textId, adaptive_questions: data })
)

/**
 * 获取课文列表（支持分页）
 * GET /api/texts
 */
function getTextList(req, res) {
  const page = isNaN(parseInt(req.query.page))
    ? 1
    : Math.max(1, Math.abs(parseInt(req.query.page)))

  const pageSize = isNaN(parseInt(req.query.page_size))
    ? 20
    : Math.min(100, Math.max(1, Math.abs(parseInt(req.query.page_size))))

  const result = textsService.getTextList(page, pageSize)
  res.json({ success: true, data: result })
}

function getTextsBatch(req, res) {
  try {
    const { text_ids } = req.body

    if (!Array.isArray(text_ids) || text_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'text_ids 必须是非空数组',
      })
    }

    // S03: 批量接口同样校验 text_id 白名单
    const SAFE_ID = /^[A-Za-z0-9_-]+$/
    const invalid = text_ids.find((id) => typeof id !== 'string' || !SAFE_ID.test(id))
    if (invalid !== undefined) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TEXT_ID',
        message: `text_ids 含非法值: ${String(invalid)}`,
      })
    }

    const results = textsService.getTextsBatch(text_ids)
    res.json({ success: true, data: results })
  } catch (err) {
    logger.error('批量获取文本数据失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
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
  getTextsBatch,
}