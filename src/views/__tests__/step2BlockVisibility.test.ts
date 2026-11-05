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
})
