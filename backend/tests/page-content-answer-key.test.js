/**
 * 新交付页面题库（WEN_05–19、22–27）判分集成测试
 *
 * 背景：第二/三关页面 JSON 在前端（public/data）和后端（backend/data）各存一份，
 * 靠人工镜像同步。文件缺一份、答案与解析不同步，都不会报错，只会静默判错。
 *
 * 这里不 mock 文件系统，直接读真实 backend/data 走完整判分链路：
 * 1) 21 篇 × 3 题 = 63 道题都能被 getCorrectAnswerFromJson 解析，且与文件答案一致；
 * 2) submitAnswers 端到端：按题库答案提交判对，客户端谎报的 correctAnswer 不生效。
 */

process.env.TEST_MODE = 'true'
process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'

const fs = require('fs')
const path = require('path')
const { getCorrectAnswerFromJson } = require('../src/utils/jsonReader')
const { submitAnswers } = require('../src/services/answerService')
const { initAllTables } = require('../src/config/database')

const POEM_IDS = [
  'WEN_05',
  'WEN_06',
  'WEN_07',
  'WEN_08',
  'WEN_09',
  'WEN_10',
  'WEN_11',
  'WEN_12',
  'WEN_13',
  'WEN_14',
  'WEN_15',
  'WEN_16',
  'WEN_17',
  'WEN_18',
  'WEN_19',
  'WEN_22',
  'WEN_23',
  'WEN_24',
  'WEN_25',
  'WEN_26',
  'WEN_27',
]

const LEVEL2_DIR = 'pages_level2_dialog_quiz'
const LEVEL3_DIR = 'pages_level3_adaptive_quiz'
const DATA_ROOT = path.join(__dirname, '..', 'data')

function readPage(dir, wenId) {
  return JSON.parse(fs.readFileSync(path.join(DATA_ROOT, dir, `${wenId}.json`), 'utf8'))
}

/** 按页面文件顺序收集一篇的三道题：B1、B2、C1 */
function collectQuestions(wenId) {
  const questions = []

  for (const block of readPage(LEVEL2_DIR, wenId).blocks) {
    if (block.type !== 'quiz') continue
    questions.push({
      id: block.data.question_id,
      answer: block.data.correct_answer,
      level: 2,
    })
  }

  for (const item of readPage(LEVEL3_DIR, wenId).items) {
    questions.push({
      id: item.quiz.question_id,
      answer: item.quiz.correct_answer,
      level: 3,
    })
  }

  return questions
}

/** 生成一个必然不同于标准答案的合法答案（B 关字母 / C 关下标） */
function pickWrongAnswer(question) {
  if (typeof question.answer === 'number') {
    return (question.answer + 1) % 3
  }
  const index = 'ABCD'.indexOf(question.answer)
  return 'ABCD'[(index + 1) % 4]
}

describe('新交付页面题库：服务端判分键', () => {
  it('21 篇 × 3 题共 63 道题都能从 backend/data 解析出与文件一致的答案', () => {
    let count = 0
    for (const wenId of POEM_IDS) {
      const questions = collectQuestions(wenId)
      expect(questions).toHaveLength(3)
      expect(new Set(questions.map((q) => q.id)).size).toBe(3)

      for (const question of questions) {
        // 失败时 Jest 会打印实际 question.id 与 wenId 上下文
        expect(getCorrectAnswerFromJson(question.id, wenId)).toEqual(question.answer)
        count += 1
      }
    }
    expect(count).toBe(63)
  })

  it('未交付页面（WEN_20）返回 null，不会误判成空答案或 0', () => {
    expect(getCorrectAnswerFromJson('WEN_20_B1', 'WEN_20')).toBeNull()
    expect(getCorrectAnswerFromJson('WEN_20_C1', 'WEN_20')).toBeNull()
  })
})

describe('新交付页面：submitAnswers 端到端判分', () => {
  beforeAll(async () => {
    await initAllTables()
  })

  it('WEN_05 按题库答案全对 → 3/3', async () => {
    const questions = collectQuestions('WEN_05')
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.answer]))

    const result = await submitAnswers({
      studentId: '91001',
      wenId: 'WEN_05',
      submittedAt: new Date().toISOString(),
      answers,
      questions: questions.map((q) => ({ id: q.id })),
    })

    expect(result.success).toBe(true)
    expect(result.data.questionCount).toBe(3)
    expect(result.data.correctCount).toBe(3)
    expect(result.data.wrongCount).toBe(0)
    expect(result.data.avgScore).toBe(100)
  })

  it('WEN_27 全部答错且客户端谎报正确答案 → 0/3，谎报不生效', async () => {
    const questions = collectQuestions('WEN_27')
    const answers = Object.fromEntries(questions.map((q) => [q.id, pickWrongAnswer(q)]))

    const result = await submitAnswers({
      studentId: '91002',
      wenId: 'WEN_27',
      submittedAt: new Date().toISOString(),
      answers,
      // 客户端把每题都谎报成标准答案
      questions: questions.map((q) => ({ id: q.id, correctAnswer: q.answer })),
    })

    expect(result.success).toBe(true)
    expect(result.data.questionCount).toBe(3)
    expect(result.data.correctCount).toBe(0)
    expect(result.data.wrongCount).toBe(3)
    expect(result.data.avgScore).toBe(0)
  })

  it('WEN_05 第二关错一题、第三关对 → 2/3', async () => {
    const questions = collectQuestions('WEN_05')
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.answer]))
    const wrongQuestion = questions.find((q) => q.level === 2)
    answers[wrongQuestion.id] = pickWrongAnswer(wrongQuestion)

    const result = await submitAnswers({
      studentId: '91003',
      wenId: 'WEN_05',
      submittedAt: new Date().toISOString(),
      answers,
      questions: questions.map((q) => ({ id: q.id })),
    })

    expect(result.success).toBe(true)
    expect(result.data.correctCount).toBe(2)
    expect(result.data.wrongCount).toBe(1)
  })
})
