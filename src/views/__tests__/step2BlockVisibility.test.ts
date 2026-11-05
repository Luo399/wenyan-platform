/**
 * Step 2 block 解锁可见性 —— 纯算法测试
 *
 * 覆盖所有已知的 Step 2 blocks 结构变体：
 *   - WEN_01: [dialogue, quiz, dialogue, dialogue, quiz, dialogue, dialogue]（前置 + 多 dialogue 后置）
 *   - WEN_05: [quiz, dialogue, quiz, dialogue]（严格 1:1）
 *   - WEN_13: [quiz, dialogue, quiz, ...]（quiz 开头，1:1）
 *   - 防御：0 quiz、全部完成 override
 */
import { describe, it, expect } from 'vitest'
import { computeStep2BlockVisibility, type VisibilityBlock } from '../step2BlockVisibility'

function mk(types: string[]): VisibilityBlock[] {
  return types.map((t) => ({ type: t }))
}

describe('computeStep2BlockVisibility', () => {
  describe('WEN_01 结构（前置 dialogue + 多 dialogue 后置）', () => {
    // [dialogue(前置), quiz1, dialogue, dialogue, quiz2, dialogue, dialogue]
    const blocks = mk(['dialogue', 'quiz', 'dialogue', 'dialogue', 'quiz', 'dialogue', 'dialogue'])

    it('completedCount=0 → 前置 dialogue + quiz1 可见；quiz1 的 2 个解析 dialogue + quiz2 + 其 dialogue 全 hidden', () => {
      const { visible } = computeStep2BlockVisibility(blocks, 0)
      // [T, T, F, F, F, F, F]
      expect(visible).toEqual([true, true, false, false, false, false, false])
    })

    it('completedCount=1 → 前置 dialogue + quiz1 + quiz1 的 2 个解析 dialogue + quiz2 可见；quiz2 的 dialogue hidden', () => {
      const { visible } = computeStep2BlockVisibility(blocks, 1)
      // [T, T, T, T, T, F, F]
      expect(visible).toEqual([true, true, true, true, true, false, false])
    })

    it('completedCount=2 → 全部可见', () => {
      const { visible } = computeStep2BlockVisibility(blocks, 2)
      expect(visible).toEqual([true, true, true, true, true, true, true])
    })
  })

  describe('WEN_05 结构（严格 1:1，quiz 开头）', () => {
    // [quiz1, dialogue, quiz2, dialogue]
    const blocks = mk(['quiz', 'dialogue', 'quiz', 'dialogue'])

    it('completedCount=0 → 只有 quiz1 可见', () => {
      const { visible } = computeStep2BlockVisibility(blocks, 0)
      expect(visible).toEqual([true, false, false, false])
    })

    it('completedCount=1 → quiz1 + 其 dialogue + quiz2 可见；quiz2 的 dialogue hidden', () => {
      const { visible } = computeStep2BlockVisibility(blocks, 1)
      expect(visible).toEqual([true, true, true, false])
    })

    it('completedCount=2 → 全部可见', () => {
      const { visible } = computeStep2BlockVisibility(blocks, 2)
      expect(visible).toEqual([true, true, true, true])
    })
  })

  describe('边界防御', () => {
    it('空 blocks → 空 visible 数组', () => {
      const { visible } = computeStep2BlockVisibility([], 0)
      expect(visible).toEqual([])
    })

    it('0 个 quiz（纯 dialogue 页）→ 全部可见', () => {
      const blocks = mk(['dialogue', 'dialogue', 'dialogue'])
      const { visible, quizStarts } = computeStep2BlockVisibility(blocks, 0)
      expect(visible).toEqual([true, true, true])
      expect(quizStarts).toEqual([])
    })

    it('全部完成 override → 强制全显', () => {
      const blocks = mk(['quiz', 'dialogue', 'quiz', 'dialogue'])
      const { visible } = computeStep2BlockVisibility(blocks, 0, true)
      expect(visible).toEqual([true, true, true, true])
    })

    it('completedCount 超过 quiz 总数 → 全部可见（防御）', () => {
      const blocks = mk(['quiz', 'dialogue', 'quiz', 'dialogue'])
      const { visible } = computeStep2BlockVisibility(blocks, 99)
      expect(visible).toEqual([true, true, true, true])
    })
  })

  describe('调试信息 sectionOf', () => {
    it('WEN_01 section 分配正确', () => {
      const blocks = mk(['dialogue', 'quiz', 'dialogue', 'dialogue', 'quiz', 'dialogue', 'dialogue'])
      const { sectionOf, quizStarts } = computeStep2BlockVisibility(blocks, 0)
      expect(quizStarts).toEqual([1, 4])
      expect(sectionOf).toEqual([-1, 0, 0, 0, 1, 1, 1])
    })

    it('WEN_05 section 分配正确', () => {
      const blocks = mk(['quiz', 'dialogue', 'quiz', 'dialogue'])
      const { sectionOf, quizStarts } = computeStep2BlockVisibility(blocks, 0)
      expect(quizStarts).toEqual([0, 2])
      expect(sectionOf).toEqual([0, 0, 1, 1])
    })
  })

  describe('连续 quiz（quiz 之间无 dialogue）', () => {
    // [dialogue, quiz, quiz, dialogue] —— quiz2 紧跟 quiz1
    const blocks = mk(['dialogue', 'quiz', 'quiz', 'dialogue'])

    it('completedCount=0 → 前置 + quiz1 可见；quiz2 和它的 dialogue hidden', () => {
      const { visible } = computeStep2BlockVisibility(blocks, 0)
      expect(visible).toEqual([true, true, false, false])
    })

    it('completedCount=1 → 前置 + quiz1 + quiz2 可见；quiz2 的 dialogue hidden', () => {
      // quiz1 答完 → quiz1 后面没有 dialogue → quiz2 可见（quizStarts[1]=2===2）
      const { visible } = computeStep2BlockVisibility(blocks, 1)
      expect(visible).toEqual([true, true, true, false])
    })

    it('completedCount=2 → 全部可见', () => {
      const { visible } = computeStep2BlockVisibility(blocks, 2)
      expect(visible).toEqual([true, true, true, true])
    })

    it('section 分配：quiz2 虽紧邻 quiz1 但独立成 section 1', () => {
      const { sectionOf, quizStarts } = computeStep2BlockVisibility(blocks, 0)
      expect(quizStarts).toEqual([1, 2])
      // i=0→-1, i=1→0, i=2→1（因为 >= 2=quizStarts[1]）, i=3→1
      expect(sectionOf).toEqual([-1, 0, 1, 1])
    })
  })

  describe('真实 level2_dialog_quiz.json 复杂结构（7 quiz）', () => {
    // 17 blocks, 7 quiz: [dialogue, quiz, dialogue, dialogue, quiz, dialogue, dialogue, quiz, quiz, dialogue, dialogue, quiz, dialogue, quiz, dialogue, quiz, dialogue]
    const blocks = mk([
      'dialogue', 'quiz', 'dialogue', 'dialogue',
      'quiz', 'dialogue', 'dialogue',
      'quiz', 'quiz', 'dialogue', 'dialogue',
      'quiz', 'dialogue',
      'quiz', 'dialogue',
      'quiz', 'dialogue',
    ])

    it('completedCount=0 → 前置 dialogue + quiz1 可见（1/17）', () => {
      const { visible, quizStarts } = computeStep2BlockVisibility(blocks, 0)
      expect(quizStarts).toEqual([1, 4, 7, 8, 11, 13, 15])
      // 只有 i=0 (前置 dialogue) 和 i=1 (quiz1) 可见
      const trueCount = visible.filter((v) => v).length
      expect(trueCount).toBe(2)
      expect(visible[0]).toBe(true)
      expect(visible[1]).toBe(true)
      expect(visible[2]).toBe(false)
    })

    it('completedCount=3 → quiz1-3 已答，quiz4 可见（共9个显）', () => {
      const { visible } = computeStep2BlockVisibility(blocks, 3)
      // sec -1, 0, 1, 2 全显；sec 3 的 quiz (i=8) 显，dialogue (i=9,10) hidden
      const trueCount = visible.filter((v) => v).length
      // i=0 (前置) + i=1,2,3 (sec0) + i=4,5,6 (sec1) + i=7 (sec2 quiz) + i=8 (sec3 quiz) = 9
      expect(trueCount).toBe(9)
      // sec 3 的 dialogue (i=9,10) 还 hidden
      expect(visible[9]).toBe(false)
      expect(visible[10]).toBe(false)
      // sec 4 (i=11+) 全 hidden
      expect(visible[11]).toBe(false)
    })

    it('completedCount=7 → 全部可见', () => {
      const { visible } = computeStep2BlockVisibility(blocks, 7)
      expect(visible.every((v) => v)).toBe(true)
    })
  })
})
