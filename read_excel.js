import xlsx from 'xlsx'
const XLSX = xlsx
import fs from 'fs'

const workbook = XLSX.readFile('开发需求填写.dbt.xlsx')

// 读取 level1_word_list
const wordListSheet = workbook.Sheets['level1_word_list']
const wordListData = XLSX.utils.sheet_to_json(wordListSheet)

// 读取 level1_multi_role_reading
const multiRoleSheet = workbook.Sheets['level1_multi_role_reading']
const multiRoleData = XLSX.utils.sheet_to_json(multiRoleSheet)

// 筛选 WEN_01 的数据
const wen01WordList = wordListData.filter((item) => item['所属课文编号'] === 'WEN_01')
const wen01MultiRole = multiRoleData.filter((item) => item['所属课文编号'] === 'WEN_01')

// 处理 word_list 数据
const processedWordList = wen01WordList.map((item) => {
  const followUpQuestions = item['追问问题'] || ''
  return {
    text_id: item['所属课文编号'] || '',
    word: item['字词'] || '',
    basic_meaning: item['基本释义'] || '',
    synonym_analysis: item['近义辨析'] || '',
    follow_up_questions:
      followUpQuestions === '无' || followUpQuestions.trim() === ''
        ? []
        : followUpQuestions.split('；'),
  }
})

// 处理 multi_role_reading 数据
const processedMultiRole = wen01MultiRole.map((item) => {
  return {
    text_id: item['所属课文编号'] || '',
    sentence_index: parseInt(item['句子序号']) || 0,
    time_range: item['时间段'] || '',
    role_name: item['角色名称'] || '',
    dialogue: item['对话内容'] || '',
    audio_file: item['音频文件（只填1次）'] || '',
  }
})

// 保存文件
fs.writeFileSync('public/data/word_list/WEN_01.json', JSON.stringify(processedWordList, null, 2))
fs.writeFileSync(
  'public/data/multi_role_reading/WEN_01.json',
  JSON.stringify(processedMultiRole, null, 2),
)

console.log('WEN_01_word_list.json 已生成')
console.log('WEN_01_multi_role_reading.json 已生成')
