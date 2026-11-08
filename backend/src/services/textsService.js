const fs = require('fs');
const { readJsonFile, getDataFilePath } = require('../utils/jsonReader');

function getBasicInfo(textId) {
  const filePath = getDataFilePath('text_basic_info', `${textId}.json`);
  return readJsonFile(filePath);
}

function getWordList(textId) {
  const filePath = getDataFilePath('word_list', `${textId}.json`);
  return readJsonFile(filePath);
}

function getMultiRoleReading(textId) {
  const filePath = getDataFilePath('multi_role_reading', `${textId}.json`);
  return readJsonFile(filePath);
}

function getLevel1Quiz(textId) {
  const filePath = getDataFilePath('level1_quiz', `${textId}.json`);
  return readJsonFile(filePath);
}

function getCultureCards(textId) {
  const filePath = getDataFilePath('culture_cards', `${textId}.json`);
  return readJsonFile(filePath);
}

function getLevel2Dialog(textId) {
  const filePath = getDataFilePath('level2_dialog', `${textId}.json`);
  return readJsonFile(filePath);
}

function getLevel2Quiz(textId) {
  const filePath = getDataFilePath('level2_quiz', `${textId}.json`);
  return readJsonFile(filePath);
}

function getLevel3ScenarioText(textId) {
  const filePath = getDataFilePath('level3_scenario_text', `${textId}.json`);
  return readJsonFile(filePath);
}

function getLevel3AdaptiveQuiz(textId) {
  const filePath = getDataFilePath('level3_quiz', `${textId}.json`);
  return readJsonFile(filePath);
}

/** 课文列表内存缓存：首次请求加载，目录 mtime 变化或 TTL 到期后失效 */
const TEXT_LIST_CACHE_TTL_MS = 60 * 1000
let textListCache = { signature: null, loadedAt: 0, texts: [] }

/**
 * 目录签名（mtime）；目录不存在时返回 missing
 */
function getDirectorySignature(dir) {
  try {
    return String(fs.statSync(dir).mtimeMs)
  } catch {
    return 'missing'
  }
}

/**
 * 从磁盘读取 text_basic_info 下全部 JSON（仅首次/缓存失效时调用）
 */
function loadTextListFromDisk(basicInfoDir) {
  const texts = []

  if (fs.existsSync(basicInfoDir)) {
    const files = fs.readdirSync(basicInfoDir)
    files.forEach((file) => {
      if (file.endsWith('.json')) {
        const filePath = `${basicInfoDir}/${file}`
        const data = readJsonFile(filePath)
        if (data && data.text_id) {
          texts.push({
            text_id: data.text_id,
            title: data.title,
            author: data.author,
            dynasty: data.dynasty,
          })
        }
      }
    })
  }

  return texts
}

function getTextList(page = 1, pageSize = 20) {
  const basicInfoDir = getDataFilePath('text_basic_info', '')
  const signature = getDirectorySignature(basicInfoDir)
  const now = Date.now()

  if (
    textListCache.signature !== signature ||
    now - textListCache.loadedAt > TEXT_LIST_CACHE_TTL_MS
  ) {
    textListCache = {
      signature,
      loadedAt: now,
      texts: loadTextListFromDisk(basicInfoDir),
    }
  }

  const texts = textListCache.texts
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTexts = texts.slice(startIndex, endIndex)

  return {
    total: texts.length,
    texts: paginatedTexts,
  }
}

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

function getPageLevel2DialogQuiz(textId) {
  const filePath = getDataFilePath('pages_level2_dialog_quiz', `${textId}.json`);
  return readJsonFile(filePath);
}

function getPageLevel3AdaptiveQuiz(textId) {
  const filePath = getDataFilePath('pages_level3_adaptive_quiz', `${textId}.json`);
  return readJsonFile(filePath);
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
  getPageLevel2DialogQuiz,
  getPageLevel3AdaptiveQuiz
};