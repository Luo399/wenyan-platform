import { describe, it, expect } from 'vitest'
import { computed } from 'vue'
import { useQuizSession } from '@/composables/useQuizSession'
import { defaultQuizInteraction, type AdvancePolicy } from '@/config/quizInteraction'
import type { QuizModel } from '@/adapters/pageAdapter'

function makeQuiz(id: string, answerKey = 'A', overrides: Partial<QuizModel> = {}): QuizModel {
  const options = ['甲', '乙', '丙', '丁'].map((text, index) => ({
    key: String.fromCharCode(65 + index),
    text,
    index,
  }))

  return {
    id,
    wenId: 'WEN_01',
    module: 'B',
    type: 'radio',
    stem: `题目 ${id}`,
    options,
    answerKeys: [answerKey],
    answerIndexes: [answerKey.charCodeAt(0) - 65],
    answerFormat: 'letter',
    optionOffset: 0,
    explanation: '',
    invalid: false,
    ...overrides,
  }
}

function buildSession(quizzes: QuizModel[], advancePolicy: AdvancePolicy = 'on-submit') {
  const config = { ...defaultQuizInteraction, advancePolicy }
  return useQuizSession({ quizzes: computed(() => quizzes), config })
}

describe('useQuizSession - 解锁与完成', () => {
  it('on-submit：提交后解锁下一题，答错也解锁', () => {
    const session = buildSession([makeQuiz('q1', 'A'), makeQuiz('q2', 'A')])
    session.setReady()

    session.select('q1', 'B')
    const submission = session.beginSubmit('q1')
    expect(submission?.keys).toEqual(['B'])

    session.confirmSuccess('q1')

    expect(session.snapshot.value.unlockedIndex).toBe(1)
    expect(session.snapshot.value.isCompleted).toBe(false)
    expect(session.isRevealed(1)).toBe(true)

    session.select('q2', 'A')
    session.beginSubmit('q2')
    session.confirmSuccess('q2')

    expect(session.snapshot.value.isCompleted).toBe(true)
    expect(session.snapshot.value.answeredCount).toBe(2)
    expect(session.snapshot.value.correctCount).toBe(1)
  })

  it('未选择时 beginSubmit 返回 null', () => {
    const session = buildSession([makeQuiz('q1')])
    session.setReady()
    expect(session.beginSubmit('q1')).toBeNull()
  })

  it('on-correct：答错不解锁且允许重试', () => {
    const session = buildSession([makeQuiz('q1', 'A'), makeQuiz('q2')], 'on-correct')
    session.setReady()

    session.select('q1', 'B')
    session.beginSubmit('q1')
    session.confirmSuccess('q1')

    expect(session.snapshot.value.unlockedIndex).toBe(0)
    expect(session.isSubmitted('q1')).toBe(false)
    expect(session.snapshot.value.selections.q1).toEqual([])

    // 重新作答并答对后才解锁
    session.select('q1', 'A')
    session.beginSubmit('q1')
    session.confirmSuccess('q1')

    expect(session.snapshot.value.unlockedIndex).toBe(1)
    expect(session.isSubmitted('q1')).toBe(true)
  })

  it('manual：提交后不自动解锁', () => {
    const session = buildSession([makeQuiz('q1'), makeQuiz('q2')], 'manual')
    session.setReady()

    session.select('q1', 'A')
    session.beginSubmit('q1')
    session.confirmSuccess('q1')

    expect(session.isSubmitted('q1')).toBe(true)
    expect(session.snapshot.value.unlockedIndex).toBe(0)
  })

  it('空题目列表按 emptyMeansCompleted 决定完成态', () => {
    const config = { ...defaultQuizInteraction }
    const blocks = useQuizSession({
      quizzes: computed(() => [] as QuizModel[]),
      config,
      emptyMeansCompleted: true,
    })
    const quizList = useQuizSession({
      quizzes: computed(() => [] as QuizModel[]),
      config,
      emptyMeansCompleted: false,
    })

    expect(blocks.isCompleted.value).toBe(true)
    expect(quizList.isCompleted.value).toBe(false)
  })

  it('开头的无效题被跳过，且不计入完成度', () => {
    const invalid = makeQuiz('q0', 'A', { invalid: true, answerKeys: [], answerIndexes: [] })
    const session = buildSession([invalid, makeQuiz('q1')])
    session.setReady()

    expect(session.snapshot.value.total).toBe(1)
    expect(session.snapshot.value.unlockedIndex).toBe(1)

    session.select('q1', 'A')
    session.beginSubmit('q1')
    session.confirmSuccess('q1')

    expect(session.snapshot.value.isCompleted).toBe(true)
  })
})

describe('useQuizSession - 失败与重置', () => {
  it('提交失败：不推进、不记提交、保留作答并给出错误', () => {
    const session = buildSession([makeQuiz('q1'), makeQuiz('q2')])
    session.setReady()

    session.select('q1', 'A')
    session.beginSubmit('q1')
    expect(session.snapshot.value.status).toBe('submitting')

    session.confirmFailure('网络异常')

    expect(session.snapshot.value.status).toBe('answering')
    expect(session.snapshot.value.error).toBe('网络异常')
    expect(session.snapshot.value.unlockedIndex).toBe(0)
    expect(session.snapshot.value.submittedIds).toEqual([])
    expect(session.snapshot.value.selections.q1).toEqual(['A'])
  })

  it('reset：清空选择、答案、判定与解锁位', () => {
    const session = buildSession([makeQuiz('q1'), makeQuiz('q2')])
    session.setReady()
    session.select('q1', 'A')
    session.beginSubmit('q1')
    session.confirmSuccess('q1')

    session.reset()

    expect(session.snapshot.value.unlockedIndex).toBe(0)
    expect(session.snapshot.value.selections).toEqual({})
    expect(session.snapshot.value.submittedIds).toEqual([])
    expect(session.snapshot.value.isCompleted).toBe(false)
  })

  it('已提交题目不可再改答案', () => {
    const session = buildSession([makeQuiz('q1')])
    session.setReady()
    session.select('q1', 'A')
    session.beginSubmit('q1')
    session.confirmSuccess('q1')

    session.select('q1', 'B')

    expect(session.snapshot.value.selections.q1).toEqual(['A'])
  })

  it('多选同一个 key 再点一次为取消', () => {
    const session = buildSession([makeQuiz('q1', 'A', { type: 'checkbox', answerKeys: ['A', 'B'] })])
    session.setReady()

    session.select('q1', 'A')
    session.select('q1', 'B')
    expect(session.snapshot.value.selections.q1).toEqual(['A', 'B'])

    session.select('q1', 'A')
    expect(session.snapshot.value.selections.q1).toEqual(['B'])
  })
})
