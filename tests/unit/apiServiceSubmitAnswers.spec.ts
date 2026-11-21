import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SubmitAnswersParams } from '@/services/apiService'

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }))

vi.mock('@/utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/api')>()
  return { ...actual, post: mocks.post, get: mocks.get }
})

import { submitAnswers } from '@/services/apiService'

const params: SubmitAnswersParams = {
  studentId: '2024001',
  wenId: 'WEN_01',
  submittedAt: '2026-11-08T00:00:00.000Z',
  answers: { Q1: 0 },
  questions: [{ id: 'Q1', correctAnswer: 0 }],
}

describe('apiService.submitAnswers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('返回完整响应信封（success/message/data），供 useAnswerSubmitter 判定', async () => {
    mocks.post.mockResolvedValue({
      success: true,
      message: '提交成功',
      data: { studentId: '2024001', wenId: 'WEN_01' },
      code: 200,
    })

    const result = await submitAnswers(params)

    expect(result).toEqual({
      success: true,
      message: '提交成功',
      data: { studentId: '2024001', wenId: 'WEN_01' },
    })
  })

  it('业务失败时抛出 SUBMIT_FAILED ApiError', async () => {
    mocks.post.mockResolvedValue({ success: false, message: '非法参数', code: 400 })

    await expect(submitAnswers(params)).rejects.toMatchObject({
      status: 500,
      errorCode: 'SUBMIT_FAILED',
      message: '非法参数',
    })
  })
})
