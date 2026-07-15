/**
 * 答案比较逻辑单元测试
 * 测试 answerService 中答案比较的类型转换和比较逻辑
 */

// 设置测试环境
process.env.TEST_MODE = 'true'

// 导入服务模块
const { submitAnswers } = require('../src/services/answerService')

// 动态获取数据库连接
const { initAllTables, closeAllDatabases } = require('../src/config/database')

describe('答案比较逻辑测试', () => {
  beforeAll(async () => {
    // 初始化测试数据库
    await initAllTables()
  })

  afterAll(() => {
    // 关闭数据库连接
    closeAllDatabases()
  })

  describe('单选答案比较（类型不匹配场景）', () => {
    it('数字答案与字符串答案应判定为相同', async () => {
      const result = await submitAnswers({
        studentId: '90001',
        wenId: 'WEN_COMPARE_TYPE_NUM_STR',
        submittedAt: new Date().toISOString(),
        answers: { Q_num_str_1: 0, Q_num_str_2: 1, Q_num_str_3: 2 },
        questions: [
          { id: 'Q_num_str_1', correctAnswer: '0' },
          { id: 'Q_num_str_2', correctAnswer: '1' },
          { id: 'Q_num_str_3', correctAnswer: '2' },
        ],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(3)
      expect(result.data.avgScore).toBe(100)
    })

    it('字符串答案与数字答案应判定为相同', async () => {
      const result = await submitAnswers({
        studentId: '90002',
        wenId: 'WEN_COMPARE_TYPE_STR_NUM',
        submittedAt: new Date().toISOString(),
        answers: { Q_str_num_1: '0', Q_str_num_2: '1' },
        questions: [
          { id: 'Q_str_num_1', correctAnswer: 0 },
          { id: 'Q_str_num_2', correctAnswer: 1 },
        ],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(2)
    })

    it('数字0与字符串"0"应判定为相同', async () => {
      const result = await submitAnswers({
        studentId: '90003',
        wenId: 'WEN_COMPARE_ZERO',
        submittedAt: new Date().toISOString(),
        answers: { Q_zero: 0 },
        questions: [{ id: 'Q_zero', correctAnswer: '0' }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(1)
    })

    it('数字1与字符串"1"应判定为相同', async () => {
      const result = await submitAnswers({
        studentId: '90004',
        wenId: 'WEN_COMPARE_ONE',
        submittedAt: new Date().toISOString(),
        answers: { Q_one: '1' },
        questions: [{ id: 'Q_one', correctAnswer: 1 }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(1)
    })

    it('不同类型但相同值的多选题答案应判定为相同', async () => {
      const result = await submitAnswers({
        studentId: '90005',
        wenId: 'WEN_COMPARE_MULTI_TYPE',
        submittedAt: new Date().toISOString(),
        answers: { Q_multi_type: [0, '1', 2] },
        questions: [{ id: 'Q_multi_type', correctAnswer: ['0', 1, '2'] }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(1)
    })
  })

  describe('多选答案比较', () => {
    it('答案顺序不同但内容相同应判定为正确', async () => {
      const result = await submitAnswers({
        studentId: '90006',
        wenId: 'WEN_COMPARE_MULTI_ORDER',
        submittedAt: new Date().toISOString(),
        answers: { Q_multi_order: ['B', 'A', 'C'] },
        questions: [{ id: 'Q_multi_order', correctAnswer: ['A', 'B', 'C'] }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(1)
    })

    it('答案内容不同应判定为错误', async () => {
      const result = await submitAnswers({
        studentId: '90007',
        wenId: 'WEN_COMPARE_MULTI_DIFF',
        submittedAt: new Date().toISOString(),
        answers: { Q_multi_diff: ['A', 'C'] },
        questions: [{ id: 'Q_multi_diff', correctAnswer: ['A', 'B'] }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(0)
    })

    it('答案数量不同应判定为错误', async () => {
      const result = await submitAnswers({
        studentId: '90008',
        wenId: 'WEN_COMPARE_MULTI_COUNT',
        submittedAt: new Date().toISOString(),
        answers: { Q_multi_count: ['A'] },
        questions: [{ id: 'Q_multi_count', correctAnswer: ['A', 'B'] }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(0)
    })

    it('空数组与空数组应判定为正确', async () => {
      const result = await submitAnswers({
        studentId: '90009',
        wenId: 'WEN_COMPARE_MULTI_EMPTY',
        submittedAt: new Date().toISOString(),
        answers: { Q_multi_empty: [] },
        questions: [{ id: 'Q_multi_empty', correctAnswer: [] }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(1)
    })

    it('混合类型数组比较应正确处理', async () => {
      const result = await submitAnswers({
        studentId: '90010',
        wenId: 'WEN_COMPARE_MULTI_MIXED',
        submittedAt: new Date().toISOString(),
        answers: { Q_multi_mixed: [1, 'B', 3] },
        questions: [{ id: 'Q_multi_mixed', correctAnswer: ['1', 'B', '3'] }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(1)
    })
  })

  describe('边界条件测试', () => {
    it('null答案应与null正确答案判定为相同', async () => {
      const result = await submitAnswers({
        studentId: '90011',
        wenId: 'WEN_COMPARE_NULL',
        submittedAt: new Date().toISOString(),
        answers: { Q_null: null },
        questions: [{ id: 'Q_null', correctAnswer: null }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(1)
    })

    it('undefined答案应与undefined正确答案判定为相同', async () => {
      const result = await submitAnswers({
        studentId: '90012',
        wenId: 'WEN_COMPARE_UNDEFINED',
        submittedAt: new Date().toISOString(),
        answers: { Q_undefined: undefined },
        questions: [{ id: 'Q_undefined', correctAnswer: undefined }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(1)
    })

    it('空字符串应与空字符串判定为相同', async () => {
      const result = await submitAnswers({
        studentId: '90013',
        wenId: 'WEN_COMPARE_EMPTY_STR',
        submittedAt: new Date().toISOString(),
        answers: { Q_empty_str: '' },
        questions: [{ id: 'Q_empty_str', correctAnswer: '' }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(1)
    })

    it('数字0应与空字符串判定为不同', async () => {
      const result = await submitAnswers({
        studentId: '90014',
        wenId: 'WEN_COMPARE_ZERO_EMPTY',
        submittedAt: new Date().toISOString(),
        answers: { Q_zero_empty: 0 },
        questions: [{ id: 'Q_zero_empty', correctAnswer: '' }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(0)
    })

    it('NaN应与NaN判定为相同', async () => {
      const result = await submitAnswers({
        studentId: '90015',
        wenId: 'WEN_COMPARE_NAN',
        submittedAt: new Date().toISOString(),
        answers: { Q_nan: NaN },
        questions: [{ id: 'Q_nan', correctAnswer: NaN }],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(1)
    })
  })

  describe('实际业务场景测试', () => {
    it('Level1选择题（数字索引）应正确判定', async () => {
      const result = await submitAnswers({
        studentId: '90016',
        wenId: 'WEN_COMPARE_LEVEL1',
        submittedAt: new Date().toISOString(),
        answers: { level1_q1: 0, level1_q2: 2, level1_q3: 1 },
        questions: [
          { id: 'level1_q1', correctAnswer: '0' },
          { id: 'level1_q2', correctAnswer: '2' },
          { id: 'level1_q3', correctAnswer: '1' },
        ],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(3)
      expect(result.data.avgScore).toBe(100)
    })

    it('Level2对话选择题应正确判定', async () => {
      const result = await submitAnswers({
        studentId: '90017',
        wenId: 'WEN_COMPARE_LEVEL2',
        submittedAt: new Date().toISOString(),
        answers: { dialog_q1: 'A', dialog_q2: 'B', dialog_q3: 'C' },
        questions: [
          { id: 'dialog_q1', correctAnswer: 'A' },
          { id: 'dialog_q2', correctAnswer: 'B' },
          { id: 'dialog_q3', correctAnswer: 'C' },
        ],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(3)
    })

    it('混合题型答题应正确计算总分', async () => {
      const result = await submitAnswers({
        studentId: '90018',
        wenId: 'WEN_COMPARE_MIXED_TYPES',
        submittedAt: new Date().toISOString(),
        answers: {
          q_num: 1,
          q_str: '正确答案',
          q_multi: ['A', 'B'],
        },
        questions: [
          { id: 'q_num', correctAnswer: '1' },
          { id: 'q_str', correctAnswer: '正确答案' },
          { id: 'q_multi', correctAnswer: ['B', 'A'] },
        ],
      })

      expect(result.success).toBe(true)
      expect(result.data.correctCount).toBe(3)
      expect(result.data.totalScore).toBe(300)
      expect(result.data.avgScore).toBe(100)
    })
  })
})
