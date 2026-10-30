import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { adaptAdaptiveQuizPage, type RawAdaptiveQuizPage } from '../adaptiveQuizPageAdapter'

/**
 * 第三关页面适配器：把「题干塞在 options[0]」的原始 JSON 归一成 QuizCard 可用的结构。
 *
 * 除了合成用例外，下面直接读 public/data/pages_level3_adaptive_quiz/WEN_01–04.json
 * 做真实数据契约测试——这四份就是线上会喂给 QuizCard 的数据，
 * 题干、选项、答案下标任何一项回退，学生看到的都会是「题目变成选项」或「标题干为正确答案」。
 */

function loadRawPage(wenId: string): RawAdaptiveQuizPage {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'public/data/pages_level3_adaptive_quiz', `${wenId}.json`),
      'utf8',
    ),
  ) as RawAdaptiveQuizPage
}

describe('adaptAdaptiveQuizPage：线上 WEN_01–04 数据契约', () => {
  it('四篇都能解析出一条题目，选项里不再混入题干', () => {
    for (const wenId of ['WEN_01', 'WEN_02', 'WEN_03', 'WEN_04']) {
      const page = adaptAdaptiveQuizPage(loadRawPage(wenId))
      expect(page.pageId, wenId).toBe(wenId)
      expect(page.items, wenId).toHaveLength(1)

      const quiz = page.items[0].quiz
      expect(quiz.options.length, wenId).toBeGreaterThanOrEqual(2)
      for (const option of quiz.options) {
        // 空括号结尾是题干的特征，不该再出现在可选选项里
        expect(option, `${wenId}: ${option}`).not.toMatch(/[（(]\s*[)）]\s*$/)
      }
      expect(quiz.question_text, wenId).not.toBe('')
      expect(quiz.question_text, wenId).not.toBe('请根据以上情景选择正确答案。')
    }
  })

  it('WEN_01：问号后的空括号被清理，答案下标 1 → 0', () => {
    const quiz = adaptAdaptiveQuizPage(loadRawPage('WEN_01')).items[0].quiz
    expect(quiz.question_text).toBe('你认为陈胜吴广最重要的特质是下列哪一项？')
    expect(quiz.options).toHaveLength(3)
    expect(quiz.options[0]).toContain('有胆有识')
    expect(quiz.correct_answer).toBe(0)
  })

  it('WEN_02：保留作为答题空位的括号，答案下标 2 → 1，解析字母 C → B', () => {
    const quiz = adaptAdaptiveQuizPage(loadRawPage('WEN_02')).items[0].quiz
    expect(quiz.question_text).toBe('本文以马喻人、托物寓意，全文寄托的核心情感是（）')
    expect(quiz.options).toHaveLength(3)
    expect(quiz.options[1]).toContain('抒发怀才不遇')
    expect(quiz.correct_answer).toBe(1)
    expect(quiz.explanation).toMatch(/^正确选项：B/)
  })

  it('WEN_03：答案下标 1 → 0，解析字母 B → A', () => {
    const quiz = adaptAdaptiveQuizPage(loadRawPage('WEN_03')).items[0].quiz
    expect(quiz.question_text).toContain('最准确的一项是（）')
    expect(quiz.options[0]).toContain('超越个人得失')
    expect(quiz.correct_answer).toBe(0)
    expect(quiz.explanation).toMatch(/^答案是A/)
  })

  it('WEN_04：作者按真实选项写的 0 保持 0，标题干为正确答案的错位被消除', () => {
    const quiz = adaptAdaptiveQuizPage(loadRawPage('WEN_04')).items[0].quiz
    expect(quiz.question_text).toContain('的冲突？')
    expect(quiz.options[0]).toBe('理性思维 感性思维')
    expect(quiz.correct_answer).toBe(0)
    expect(quiz.explanation).not.toMatch(/^正确选项：/)
  })
})

describe('adaptAdaptiveQuizPage：启发式边界', () => {
  it('题干提升后按含题干下标前移，解析里的字母同步前移', () => {
    const page = adaptAdaptiveQuizPage({
      pageId: 'T',
      items: [
        {
          text: '场景',
          quiz: {
            question_text: '请根据以上情景选择正确答案。',
            options: ['请从下面四个选项里选出真正的题干内容（ ）', '甲', '乙', '丙'],
            correct_answer: 3,
            explanation: '正确选项：D。丙才是对的',
          },
        },
      ],
    })
    const quiz = page.items[0].quiz
    expect(quiz.options).toEqual(['甲', '乙', '丙'])
    expect(quiz.correct_answer).toBe(2)
    expect(quiz.explanation).toBe('正确选项：C。丙才是对的')
  })

  it('question_text 本身有实义时不覆盖它，也不误删正常选项', () => {
    const page = adaptAdaptiveQuizPage({
      pageId: 'T',
      items: [
        {
          text: '场景',
          quiz: {
            question_text: '作者想表达什么？',
            options: ['甲', '乙', '丙'],
            correct_answer: 1,
          },
        },
      ],
    })
    const quiz = page.items[0].quiz
    expect(quiz.question_text).toBe('作者想表达什么？')
    expect(quiz.options).toEqual(['甲', '乙', '丙'])
    expect(quiz.correct_answer).toBe(1)
  })

  it('没有题干可提升时，question_text 与场景重复则留空，避免同一段话贴两遍', () => {
    const page = adaptAdaptiveQuizPage({
      pageId: 'T',
      items: [
        {
          text: '这是场景文案。',
          quiz: { question_text: '这是场景文案。', options: ['甲', '乙'], correct_answer: 0 },
        },
      ],
    })
    expect(page.items[0].quiz.question_text).toBe('')
  })

  it('字母答案 C、数组答案 [1,3] 都按前移规则处理', () => {
    const letterPage = adaptAdaptiveQuizPage({
      pageId: 'T',
      items: [
        {
          text: '',
          quiz: {
            question_text: '',
            options: ['这是一道很长的题干问句吗？（）', '甲', '乙'],
            correct_answer: 'C',
          },
        },
      ],
    })
    expect(letterPage.items[0].quiz.correct_answer).toBe(1)

    const arrayPage = adaptAdaptiveQuizPage({
      pageId: 'T',
      items: [
        {
          text: '',
          quiz: {
            question_text: '',
            options: ['这是一道很长的题干问句吗？（）', '甲', '乙', '丙'],
            correct_answer: [1, 3],
            question_type: 'checkbox',
          },
        },
      ],
    })
    expect(arrayPage.items[0].quiz.correct_answer).toEqual([0, 2])
    expect(arrayPage.items[0].quiz.question_type).toBe('checkbox')
  })

  it('答案下标越界时丢弃，避免标错选项', () => {
    const page = adaptAdaptiveQuizPage({
      pageId: 'T',
      items: [
        {
          text: '',
          quiz: { question_text: '题目', options: ['甲', '乙'], correct_answer: 9 },
        },
      ],
    })
    expect(page.items[0].quiz.correct_answer).toBeUndefined()
  })

  it('结构不完整的条目（缺 quiz / 少于两个选项）整条丢弃', () => {
    const page = adaptAdaptiveQuizPage({
      pageId: 'T',
      items: [
        null,
        { text: '没有 quiz' },
        { text: '', quiz: { question_text: '只有一个选项', options: ['甲'] } },
        { text: '', quiz: { question_text: '正常题', options: ['甲', '乙'] } },
      ],
    })
    expect(page.items).toHaveLength(1)
    expect(page.items[0].quiz.question_text).toBe('正常题')
  })

  it('空数据返回空页而不是抛错', () => {
    expect(adaptAdaptiveQuizPage(null)).toEqual({ pageId: '', items: [] })
    expect(adaptAdaptiveQuizPage({ pageId: 'T', items: null })).toEqual({
      pageId: 'T',
      items: [],
    })
  })
})

/**
 * 新交付的 21 份第三关页面（2026-10-30）是按干净 schema 写的：
 * 题干在 question_text，options 全是真实选项。适配器的启发式不应该被触发，
 * 否则答案下标会被再前移一位，学生点对也判错。
 */
describe('adaptAdaptiveQuizPage：新交付 WEN_05–19、22–27 真实数据', () => {
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

  it('21 篇原样适配：题干/选项/答案下标不变，解析字母与下标一致', () => {
    for (const wenId of NEW_POEM_IDS) {
      const raw = loadRawPage(wenId)
      const rawQuiz = raw.items?.[0]?.quiz
      if (!rawQuiz) throw new Error(`${wenId} 缺少 quiz`)

      const page = adaptAdaptiveQuizPage(raw)
      expect(page.pageId, wenId).toBe(wenId)
      expect(page.items, wenId).toHaveLength(1)

      const quiz = page.items[0].quiz
      expect(quiz.question_text, wenId).toBe(rawQuiz.question_text)
      expect(quiz.options, wenId).toEqual(rawQuiz.options)
      expect(quiz.correct_answer, wenId).toBe(rawQuiz.correct_answer)

      expect(typeof rawQuiz.correct_answer, wenId).toBe('number')
      const index = rawQuiz.correct_answer as number
      expect(quiz.options[index], `${wenId} 答案指向的选项`).toBe(rawQuiz.options?.[index])

      const letter = String.fromCharCode(65 + index)
      expect(quiz.explanation, `${wenId} 解析字母`).toContain(`正确答案：${letter}`)
    }
  })
})
