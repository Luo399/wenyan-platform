import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useQuizEffects } from '@/composables/useQuizEffects'
import { adaptQuiz } from '@/adapters/pageAdapter'
import { getCompletionRecord } from '@/utils/quizCompletionStorage'

const mocks = vi.hoisted(() => ({ submitSingle: vi.fn() }))

vi.mock('@/composables/useQuizSubmitter', () => ({
  useQuizSubmitter: () => ({ submitSingle: mocks.submitSingle }),
}))

vi.mock('@/composables/useStudentInfo', () => ({
  useStudentInfo: () => ({ studentId: ref('1001') }),
}))

const quiz = adaptQuiz(
  {
    question_id: 'WEN_01_B1',
    module: 'B',
    question_text: '题干',
    option_a: '甲',
    option_b: '乙',
    correct_answer: 'B',
    difficulty: 'L2',
  },
  { wenId: 'WEN_01', fallbackId: 'WEN_01_q1' },
)

function buildEffects(onTrack = vi.fn()) {
  return {
    effects: useQuizEffects({ wenId: ref('WEN_01'), onTrack }),
    onTrack,
  }
}

describe('useQuizEffects', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mocks.submitSingle.mockReset()
    mocks.submitSingle.mockResolvedValue({ success: true })
  })

  it('提交时按原始表示回传答案，且不携带 correctAnswer', async () => {
    const { effects, onTrack } = buildEffects()

    const outcome = await effects.submitAnswer(quiz, ['B'])

    expect(outcome).toEqual({ ok: true })
    expect(mocks.submitSingle).toHaveBeenCalledTimes(1)
    const payload = mocks.submitSingle.mock.calls[0]![0] as Record<string, unknown>
    expect(payload.wenId).toBe('WEN_01')
    expect(payload.questionId).toBe('WEN_01_B1')
    expect(payload.userAnswer).toBe('B')
    expect('correctAnswer' in payload).toBe(false)
    expect(onTrack).toHaveBeenCalledWith({ isCorrect: true, questionId: 'WEN_01_B1' })
  })

  it('提交失败返回可读错误，不吞异常', async () => {
    mocks.submitSingle.mockRejectedValueOnce(new Error('HTTP 503'))
    const { effects, onTrack } = buildEffects()

    const outcome = await effects.submitAnswer(quiz, ['B'])

    expect(outcome).toEqual({ ok: false, error: 'HTTP 503' })
    expect(onTrack).not.toHaveBeenCalled()
  })

  it('无效题目直接拒绝提交', async () => {
    const { effects } = buildEffects()
    const outcome = await effects.submitAnswer({ ...quiz, invalid: true }, ['B'])

    expect(outcome.ok).toBe(false)
    expect(mocks.submitSingle).not.toHaveBeenCalled()
  })

  it('markCompleted 写入完成记录，resetCompletion 清除', () => {
    const { effects } = buildEffects()

    effects.markCompleted(4, 4)

    const record = getCompletionRecord('1001', 'WEN_01')
    expect(record?.totalQuestions).toBe(4)
    expect(record?.answeredCount).toBe(4)

    effects.resetCompletion()
    expect(getCompletionRecord('1001', 'WEN_01')).toBeNull()
  })
})
