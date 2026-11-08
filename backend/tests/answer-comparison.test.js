/**
 * 答案比较逻辑单元测试
 *
 * 安全加固后的契约：
 * 1. 判分只认服务端题库 JSON（answerService.getServerCorrectAnswer），
 *    客户端提交的 correctAnswer 一律忽略；取不到答案 → 500 ANSWER_KEY_UNAVAILABLE。
 * 2. 多选改多重集语义：toAnswerSet 去重后比 size 再逐项 has。
 *
 * 因此本套件分两层：
 * - 第一层直接测 compareAnswers 的类型归一化 / 集合语义（不碰数据库）
 * - 第二层用真实题库 ID 走 answerService.submitAnswers，验证"服务端判分 + 忽略客户端答案"
 *
 * 真实题库（backend/data/）：
 *   text-quiz/WEN_01.json                    → WEN_01_Q1 = 1
 *   text-quiz/WEN_02.json                    → WEN_02_Q1 = 2
 *   pages_level2_dialog_quiz/WEN_01.json     → WEN_01_B1 = 'B'
 *   pages_level2_dialog_quiz/WEN_02.json     → WEN_02_B1 = 'C'
 */

// 设置测试环境（必须在 require database 之前：DB_PATH 决定连接目标）
process.env.TEST_MODE = 'true'
process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'

const { compareAnswers } = require('../src/utils/answerUtils')
const { submitAnswers } = require('../src/services/answerService')
const { initAllTables } = require('../src/config/database')

describe('compareAnswers 类型归一化（单选）', () => {
  it('数字答案与字符串答案应判定为相同', () => {
    expect(compareAnswers(0, '0')).toEqual({ score: 100, isCorrect: 1 })
    expect(compareAnswers(1, '1')).toEqual({ score: 100, isCorrect: 1 })
    expect(compareAnswers(2, '2')).toEqual({ score: 100, isCorrect: 1 })
  })

  it('字符串答案与数字答案应判定为相同', () => {
    expect(compareAnswers('0', 0)).toEqual({ score: 100, isCorrect: 1 })
    expect(compareAnswers('1', 1)).toEqual({ score: 100, isCorrect: 1 })
  })

  it('数字0与字符串"0"应判定为相同', () => {
    expect(compareAnswers(0, '0').isCorrect).toBe(1)
  })

  it('数字1与字符串"1"应判定为相同', () => {
    expect(compareAnswers('1', 1).isCorrect).toBe(1)
  })

  it('布尔与对应字符串应判定为相同', () => {
    expect(compareAnswers(true, 'true').isCorrect).toBe(1)
    expect(compareAnswers('false', false).isCorrect).toBe(1)
    // 大小写敏感：不做 toLowerCase
    expect(compareAnswers(true, 'True').isCorrect).toBe(0)
  })

  it('前后空格应被 trim 后比较', () => {
    expect(compareAnswers('  A  ', ' A ').isCorrect).toBe(1)
  })
})

describe('compareAnswers 多选（多重集语义）', () => {
  it('答案顺序不同但内容相同应判定为正确', () => {
    expect(compareAnswers(['B', 'A', 'C'], ['A', 'B', 'C'])).toEqual({ score: 100, isCorrect: 1 })
  })

  it('答案内容不同应判定为错误', () => {
    expect(compareAnswers(['A', 'C'], ['A', 'B'])).toEqual({ score: 0, isCorrect: 0 })
  })

  it('答案数量不同应判定为错误', () => {
    expect(compareAnswers(['A'], ['A', 'B'])).toEqual({ score: 0, isCorrect: 0 })
  })

  it('空数组与空数组应判定为正确', () => {
    expect(compareAnswers([], [])).toEqual({ score: 100, isCorrect: 1 })
  })

  it('混合类型数组比较应正确处理', () => {
    // 数组元素按 String(item).trim() 归一化后再比较
    expect(compareAnswers([1, 'B', 3], ['1', 'B', '3']).isCorrect).toBe(1)
    expect(compareAnswers([0, '1', 2], ['0', 1, '2']).isCorrect).toBe(1)
  })

  it('去重后长度不一致应判定为错误（["a","a"] vs ["a","b"]）', () => {
    // 安全加固点：去重后 size 1 != 2，不能被"长度都为 2"骗过
    expect(compareAnswers(['a', 'a'], ['a', 'b'])).toEqual({ score: 0, isCorrect: 0 })
  })

  it('重复选项去重后与单元素集合等价（["a","a"] vs ["a"]）', () => {
    // 锁定当前实现：两边去重后都是 {a}
    expect(compareAnswers(['a', 'a'], ['a'])).toEqual({ score: 100, isCorrect: 1 })
    expect(compareAnswers(['a', 'b', 'b'], ['a', 'b'])).toEqual({ score: 100, isCorrect: 1 })
  })

  it('数组与标量混比应判定为错误', () => {
    expect(compareAnswers(['A'], 'A')).toEqual({ score: 0, isCorrect: 0 })
    expect(compareAnswers('A', ['A'])).toEqual({ score: 0, isCorrect: 0 })
  })
})

describe('compareAnswers 边界条件', () => {
  it('空答案（null / undefined / 空字符串）一律判错，不因两边都空而判对', () => {
    expect(compareAnswers(null, null)).toEqual({ score: 0, isCorrect: 0 })
    expect(compareAnswers(undefined, undefined)).toEqual({ score: 0, isCorrect: 0 })
    expect(compareAnswers('', '')).toEqual({ score: 0, isCorrect: 0 })
  })

  it('正确答案缺失时按错误处理（绝不"无答案即正确"）', () => {
    expect(compareAnswers('A', null)).toEqual({ score: 0, isCorrect: 0 })
    expect(compareAnswers('A', undefined)).toEqual({ score: 0, isCorrect: 0 })
    expect(compareAnswers('A', '')).toEqual({ score: 0, isCorrect: 0 })
  })

  it('数字0应与空字符串判定为不同', () => {
    expect(compareAnswers(0, '').isCorrect).toBe(0)
  })

  it('NaN应与NaN判定为相同（String(NaN) 归一化）', () => {
    expect(compareAnswers(NaN, NaN).isCorrect).toBe(1)
  })
})

describe('服务端判分：真实题库 + 忽略客户端 correctAnswer', () => {
  beforeAll(async () => {
    await initAllTables()
  })

  it('Level1 选择题（真实答案索引，客户端伪造答案被忽略）', async () => {
    const result = await submitAnswers({
      studentId: '90001',
      wenId: 'WEN_01',
      submittedAt: new Date().toISOString(),
      answers: { WEN_01_Q1: 1 },
      // 客户端谎报正确答案，服务端应以题库的 1 为准
      questions: [{ id: 'WEN_01_Q1', correctAnswer: 999 }],
    })

    expect(result.success).toBe(true)
    expect(result.data.correctCount).toBe(1)
    expect(result.data.avgScore).toBe(100)
  })

  it('Level2 对话选择题（真实字母答案）应正确判定', async () => {
    const result = await submitAnswers({
      studentId: '90002',
      wenId: 'WEN_02',
      submittedAt: new Date().toISOString(),
      answers: { WEN_02_Q1: 2, WEN_02_B1: 'C' },
      questions: [
        { id: 'WEN_02_Q1', correctAnswer: 'x' },
        { id: 'WEN_02_B1', correctAnswer: 'x' },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.data.questionCount).toBe(2)
    expect(result.data.correctCount).toBe(2)
  })

  it('答错时按题库答案判 0 分（客户端写对也没用）', async () => {
    const result = await submitAnswers({
      studentId: '90003',
      wenId: 'WEN_01',
      submittedAt: new Date().toISOString(),
      answers: { WEN_01_B1: 'A' }, // 真实答案是 'B'
      questions: [{ id: 'WEN_01_B1', correctAnswer: 'A' }], // 客户端谎报为 'A'
    })

    expect(result.success).toBe(true)
    expect(result.data.correctCount).toBe(0)
    expect(result.data.wrongCount).toBe(1)
  })

  it('混合题型答题应正确计算总分', async () => {
    const result = await submitAnswers({
      studentId: '90004',
      wenId: 'WEN_01',
      submittedAt: new Date().toISOString(),
      answers: {
        WEN_01_Q1: 1, // 对（真实答案 1）
        WEN_01_B1: 'B', // 对（真实答案 'B'）
        WEN_01_B2: 'A', // 错（真实答案 'C'）
      },
      questions: [
        { id: 'WEN_01_Q1' },
        { id: 'WEN_01_B1' },
        { id: 'WEN_01_B2' },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.data.correctCount).toBe(2)
    expect(result.data.wrongCount).toBe(1)
    expect(result.data.totalScore).toBe(200)
    expect(result.data.avgScore).toBe(67)
  })

  it('题库中不存在的题目应抛 500 ANSWER_KEY_UNAVAILABLE，绝不回退客户端答案', async () => {
    await expect(
      submitAnswers({
        studentId: '90005',
        wenId: 'WEN_01',
        submittedAt: new Date().toISOString(),
        answers: { NOT_IN_QUESTION_BANK: 1 },
        questions: [{ id: 'NOT_IN_QUESTION_BANK', correctAnswer: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 500, error: 'ANSWER_KEY_UNAVAILABLE' })
  })
})
