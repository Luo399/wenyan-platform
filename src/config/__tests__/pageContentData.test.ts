/**
 * WEN_05–19、22–27 第二/三关页面数据契约测试
 *
 * 这批数据是 2026-10-30 内容侧按 Figma 页面 schema 产出的，前端直接消费、
 * 后端按 question_id 从同一份 JSON 取正确答案判分。字段一旦错位（题号重复、
 * 答案字母与解析不一致、第三关把题干塞进 options[0]）不会报错，只会静默判错，
 * 所以在这里锁住结构。
 *
 * 只校验新产出的 21 篇：WEN_01–04 是历史数据，已知存在 B1 缺答案、B2 答案与
 * 解析矛盾等遗留问题，不在本测试的修复范围内（见 changelog 20261029）。
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const NEW_POEM_IDS = [
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
] as const

const LEVEL2_DIR = 'pages_level2_dialog_quiz'
const LEVEL3_DIR = 'pages_level3_adaptive_quiz'

type Level2Page = {
  pageId: string
  blocks: Array<{
    type: string
    data: {
      text_id: string
      question_id: string
      module: string
      question_number: number
      question_text: string
      option_a: string
      option_b: string
      option_c: string
      option_d: string
      correct_answer: string
      difficulty: string
      question_type: string
      pre_dialog: string
    }
  }>
}

type Level3Page = {
  pageId: string
  items: Array<{
    text: string
    quiz: {
      question_id: string
      module: string
      question_type: string
      question_text: string
      options: string[]
      correct_answer: number
      explanation: string
      difficulty: string
    }
  }>
}

function readPage<T>(dir: string, wenId: string): T {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/data', dir, `${wenId}.json`), 'utf8'),
  ) as T
}

describe('WEN_05–19、22–27 页面数据契约', () => {
  it('第二关：每篇 2 道 B 题，题号/答案/解析一一对应，且题后紧跟解析对话', () => {
    for (const wenId of NEW_POEM_IDS) {
      const page = readPage<Level2Page>(LEVEL2_DIR, wenId)
      expect(page.pageId, `${wenId} pageId`).toBe(wenId)
      expect(page.blocks, `${wenId} blocks`).toHaveLength(4)

      const quizIds = new Set<string>()
      page.blocks.forEach((block, index) => {
        if (block.type !== 'quiz') return
        const data = block.data
        expect(data.text_id, `${wenId} text_id`).toBe(wenId)
        expect(data.module, `${wenId} ${data.question_id} module`).toBe('B')
        expect(data.question_number, `${wenId} ${data.question_id} number`).toBe(
          index === 0 ? 1 : 2,
        )
        expect(data.question_id, `${wenId} 题号`).toBe(`${wenId}_B${data.question_number}`)
        expect(quizIds.has(data.question_id), `${wenId} 题号重复`).toBe(false)
        quizIds.add(data.question_id)
        expect(['A', 'B', 'C', 'D']).toContain(data.correct_answer)
        for (const key of ['option_a', 'option_b', 'option_c', 'option_d'] as const) {
          expect(data[key].trim(), `${data.question_id} ${key} 为空`).not.toBe('')
        }
        expect(data.question_text.trim(), `${data.question_id} 题干为空`).not.toBe('')
        expect(data.pre_dialog.trim(), `${data.question_id} 情景为空`).not.toBe('')
        expect(['L1', 'L2', 'L3']).toContain(data.difficulty)

        const explanationBlock = page.blocks[index + 1]
        expect(explanationBlock?.type, `${data.question_id} 后缺解析对话`).toBe('dialogue')
        expect(explanationBlock.data.pre_dialog).toContain(`答案是${data.correct_answer}`)
      })
      expect(quizIds.size, `${wenId} B 题数量`).toBe(2)
    }
  })

  it('第三关：每篇 1 个情景 + 1 道 C 题，题干独立、答案下标合法、解析字母一致', () => {
    for (const wenId of NEW_POEM_IDS) {
      const page = readPage<Level3Page>(LEVEL3_DIR, wenId)
      expect(page.pageId, `${wenId} pageId`).toBe(wenId)
      expect(page.items, `${wenId} items`).toHaveLength(1)

      const item = page.items[0]
      expect(item.text.trim(), `${wenId} 情景为空`).not.toBe('')
      const quiz = item.quiz
      expect(quiz.question_id, `${wenId} 题号`).toBe(`${wenId}_C1`)
      expect(quiz.module, `${wenId} module`).toBe('C')
      expect(quiz.question_type, `${wenId} question_type`).toBe('radio')
      expect(quiz.question_text.trim(), `${wenId} 题干为空`).not.toBe('')
      expect(quiz.options.length, `${wenId} 选项数`).toBeGreaterThanOrEqual(3)
      for (const option of quiz.options) {
        expect(option.trim(), `${wenId} 空选项`).not.toBe('')
      }
      // 新数据按干净 schema 产出：题干在 question_text，不再塞进 options[0]，
      // 否则 adaptiveQuizPageAdapter 的启发式会把首项当题干再前移一次答案。
      expect(quiz.options[0]).not.toMatch(/[（(]\s*[)）]\s*$/)
      expect(Number.isInteger(quiz.correct_answer)).toBe(true)
      expect(quiz.correct_answer).toBeGreaterThanOrEqual(0)
      expect(quiz.correct_answer).toBeLessThan(quiz.options.length)
      const letter = String.fromCharCode(65 + quiz.correct_answer)
      expect(quiz.explanation, `${wenId} 解析字母`).toContain(`正确答案：${letter}`)
      expect(['L1', 'L2', 'L3']).toContain(quiz.difficulty)
    }
  })

  it('public 与 backend 的副本逐字节一致（判分读 backend/data）', () => {
    for (const wenId of NEW_POEM_IDS) {
      for (const dir of [LEVEL2_DIR, LEVEL3_DIR]) {
        const publicText = readFileSync(
          resolve(process.cwd(), 'public/data', dir, `${wenId}.json`),
          'utf8',
        )
        const backendText = readFileSync(
          resolve(process.cwd(), 'backend/data', dir, `${wenId}.json`),
          'utf8',
        )
        expect(backendText, `${dir}/${wenId} 两份不一致`).toBe(publicText)
      }
    }
  })
})
