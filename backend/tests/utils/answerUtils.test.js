/**
 * 答案比较工具单元测试
 * 聚焦 compareAnswers 的所有逻辑分支与边界条件
 */
const { compareAnswers } = require('../../src/utils/answerUtils')

describe('answerUtils.compareAnswers', () => {
  // ========== 空值分支 ==========

  describe('空值判定（B04：空答案 / 正确答案缺失 统一判错）', () => {
    it('用户答案 undefined -> score=0, isCorrect=0', () => {
      const result = compareAnswers(undefined, 'A')
      expect(result).toEqual({ score: 0, isCorrect: 0 })
    })

    it('用户答案 null -> score=0, isCorrect=0', () => {
      const result = compareAnswers(null, 'A')
      expect(result).toEqual({ score: 0, isCorrect: 0 })
    })

    it('用户答案 空字符串 -> score=0, isCorrect=0', () => {
      const result = compareAnswers('', 'A')
      expect(result).toEqual({ score: 0, isCorrect: 0 })
    })

    it('正确答案 undefined -> score=0, isCorrect=0（无法判断，按错误处理）', () => {
      const result = compareAnswers('A', undefined)
      expect(result).toEqual({ score: 0, isCorrect: 0 })
    })

    it('正确答案 null -> score=0, isCorrect=0', () => {
      const result = compareAnswers('A', null)
      expect(result).toEqual({ score: 0, isCorrect: 0 })
    })

    it('正确答案 空字符串 -> score=0, isCorrect=0', () => {
      const result = compareAnswers('A', '')
      expect(result).toEqual({ score: 0, isCorrect: 0 })
    })

    it('两边都空 -> score=0, isCorrect=0（不因为相等而判对）', () => {
      expect(compareAnswers('', '')).toEqual({ score: 0, isCorrect: 0 })
      expect(compareAnswers(undefined, undefined)).toEqual({ score: 0, isCorrect: 0 })
      expect(compareAnswers(null, null)).toEqual({ score: 0, isCorrect: 0 })
    })
  })

  // ========== 多选数组分支 ==========

  describe('多选：数组与数组比较', () => {
    it('相同元素、相同顺序 -> 正确', () => {
      const result = compareAnswers(['A', 'B', 'C'], ['A', 'B', 'C'])
      expect(result).toEqual({ score: 100, isCorrect: 1 })
    })

    it('相同元素、不同顺序 -> 仍然正确（集合语义：every + includes）', () => {
      const result = compareAnswers(['C', 'B', 'A'], ['A', 'B', 'C'])
      expect(result).toEqual({ score: 100, isCorrect: 1 })
    })

    it('元素相同但数组更短（漏选） -> 错误', () => {
      const result = compareAnswers(['A', 'B'], ['A', 'B', 'C'])
      expect(result).toEqual({ score: 0, isCorrect: 0 })
    })

    it('元素相同但数组更长（多选多余） -> 错误', () => {
      const result = compareAnswers(['A', 'B', 'C', 'D'], ['A', 'B', 'C'])
      expect(result).toEqual({ score: 0, isCorrect: 0 })
    })

    it('长度相等但存在多余元素 -> 错误（every 检查：用户答案每个都在正确里？不，D 不在）', () => {
      // 用户答案是 ['A', 'B', 'D']，正确是 ['A', 'B', 'C']
      // 长度都为 3，进入 every 检查：D 不在 correctAnswer 中 -> false
      const result = compareAnswers(['A', 'B', 'D'], ['A', 'B', 'C'])
      expect(result).toEqual({ score: 0, isCorrect: 0 })
    })

    it('空数组 vs 空数组 -> 错误（先过空值判定？空数组不 === \"\"，进入数组分支，长度 0=0，every 返回 true -> 判为 1？）', () => {
      // 这是当前实现的实际行为：两边都是 []，长度相等，every 空集合返回 true，结果是 score=100
      // 测试锁定此行为，若修改需同步变更测试
      const result = compareAnswers([], [])
      expect(result).toEqual({ score: 100, isCorrect: 1 })
    })

    it('单元素数组：匹配 -> 正确', () => {
      expect(compareAnswers(['X'], ['X'])).toEqual({ score: 100, isCorrect: 1 })
    })

    it('单元素数组：不匹配 -> 错误', () => {
      expect(compareAnswers(['X'], ['Y'])).toEqual({ score: 0, isCorrect: 0 })
    })
  })

  // ========== 一个数组一个非数组 ==========

  describe('数组与非数组混合：类型不一致判错', () => {
    it('用户答案是数组、正确答案是字符串 -> 错误', () => {
      expect(compareAnswers(['A'], 'A')).toEqual({ score: 0, isCorrect: 0 })
    })

    it('用户答案是字符串、正确答案是数组 -> 错误', () => {
      expect(compareAnswers('A', ['A'])).toEqual({ score: 0, isCorrect: 0 })
    })

    it('用户答案是数字、正确答案是数组 -> 错误', () => {
      expect(compareAnswers(1, ['1'])).toEqual({ score: 0, isCorrect: 0 })
    })

    it('用户答案是数组、正确答案是数字 -> 错误', () => {
      expect(compareAnswers(['1'], 1)).toEqual({ score: 0, isCorrect: 0 })
    })
  })

  // ========== 单选字符串比较 ==========

  describe('单选：字符串化 + trim 比较', () => {
    it('完全相同的字符串 -> 正确', () => {
      expect(compareAnswers('论语', '论语')).toEqual({ score: 100, isCorrect: 1 })
    })

    it('大小写敏感（当前实现：不做 toLowerCase） -> 错误', () => {
      // 锁定当前行为：A !== a
      expect(compareAnswers('A', 'a')).toEqual({ score: 0, isCorrect: 0 })
    })

    it('用户答案有前后空格 -> trim 后相等 -> 正确', () => {
      expect(compareAnswers('  学而时习之  ', '学而时习之')).toEqual({ score: 100, isCorrect: 1 })
    })

    it('正确答案有前后空格 -> trim 后相等 -> 正确', () => {
      expect(compareAnswers('学而时习之', '  学而时习之  ')).toEqual({ score: 100, isCorrect: 1 })
    })

    it('两边都有前后空格 -> trim 后相等 -> 正确', () => {
      expect(compareAnswers('  A  ', ' A ')).toEqual({ score: 100, isCorrect: 1 })
    })

    it('trim 后仍不相等 -> 错误', () => {
      expect(compareAnswers(' A ', ' B ')).toEqual({ score: 0, isCorrect: 0 })
    })
  })

  // ========== 类型转换：数字 / 布尔 ==========

  describe('类型转换：Number / Boolean 通过 String() 转字符串比较', () => {
    it('数字 1 与字符串 \"1\" -> 相等 -> 正确', () => {
      expect(compareAnswers(1, '1')).toEqual({ score: 100, isCorrect: 1 })
    })

    it('字符串 \"0\" 与数字 0 -> 相等 -> 正确', () => {
      expect(compareAnswers('0', 0)).toEqual({ score: 100, isCorrect: 1 })
    })

    it('布尔 true 与字符串 \"true\" -> 相等 -> 正确', () => {
      expect(compareAnswers(true, 'true')).toEqual({ score: 100, isCorrect: 1 })
    })

    it('布尔 false 与字符串 \"false\" -> 相等 -> 正确', () => {
      expect(compareAnswers('false', false)).toEqual({ score: 100, isCorrect: 1 })
    })

    it('布尔 true 与字符串 \"True\"（注意大小写） -> 不相等 -> 错误', () => {
      // 锁定当前行为：String(true) = 'true' !== 'True'
      expect(compareAnswers(true, 'True')).toEqual({ score: 0, isCorrect: 0 })
    })

    it('数字 100 与数字 100 -> String(100) === String(100) -> 正确', () => {
      expect(compareAnswers(100, 100)).toEqual({ score: 100, isCorrect: 1 })
    })

    it('数字 0 与数字 1 -> 错误', () => {
      expect(compareAnswers(0, 1)).toEqual({ score: 0, isCorrect: 0 })
    })
  })

  // ========== 返回值结构与评分确定性 ==========

  describe('返回值结构确定性', () => {
    it('正确时固定返回 score=100, isCorrect=1（非 truthy 数字 1）', () => {
      const result = compareAnswers('正确答案', '正确答案')
      expect(result.score).toBe(100)
      expect(result.score === 100).toBe(true)
      expect(result.isCorrect).toBe(1)
      expect(typeof result.isCorrect).toBe('number')
    })

    it('错误时固定返回 score=0, isCorrect=0（非 falsy 数字 0）', () => {
      const result = compareAnswers('错误答案', '正确答案')
      expect(result.score).toBe(0)
      expect(result.isCorrect).toBe(0)
      expect(typeof result.isCorrect).toBe('number')
    })

    it('返回值是新对象，不共享引用（每次调用返回不同对象）', () => {
      const a = compareAnswers('A', 'A')
      const b = compareAnswers('A', 'A')
      expect(a).toEqual(b)
      expect(a).not.toBe(b)
    })
  })
})
