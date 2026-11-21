import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

const { mockGetStudentsCompletion } = vi.hoisted(() => ({
  mockGetStudentsCompletion: vi.fn(),
}))

vi.mock('@/services/teacherCompletionService', () => ({
  getStudentsCompletion: mockGetStudentsCompletion,
}))

import TeacherCompletionView from '@/views/TeacherCompletionView.vue'

const EMPTY_RESULT = {
  metrics_ready: false,
  summary: { student_count: 0, avg_accuracy: 0 },
  students: [],
}

const ONE_ROW_RESULT = {
  metrics_ready: true,
  summary: { student_count: 1, avg_accuracy: 80 },
  students: [
    {
      student_id: '20250101',
      student_name: '张三',
      class_code: '202501',
      school_id: 1,
      total_questions: 10,
      answered_questions: 8,
      correct_count: 8,
      accuracy: 80,
      last_submitted_at: '2026-11-20T10:00:00.000Z',
    },
  ],
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/answer-query', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = createTestRouter()
  await router.push('/')
  const wrapper = mount(TeacherCompletionView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('TeacherCompletionView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('首次进入应请求一次完成情况数据', async () => {
    mockGetStudentsCompletion.mockResolvedValue(EMPTY_RESULT)
    await mountView()
    expect(mockGetStudentsCompletion).toHaveBeenCalledTimes(1)
    expect(mockGetStudentsCompletion).toHaveBeenCalledWith(undefined)
  })

  it('请求未完成时展示 BaseLoader', async () => {
    mockGetStudentsCompletion.mockReturnValue(new Promise(() => {}))
    const wrapper = await mountView()
    expect(wrapper.find('.base-loader').exists()).toBe(true)
  })

  it('有数据时渲染表格行', async () => {
    mockGetStudentsCompletion.mockResolvedValue(ONE_ROW_RESULT)
    const wrapper = await mountView()
    expect(wrapper.find('.data-table').exists()).toBe(true)
    const text = wrapper.text()
    expect(text).toContain('20250101')
    expect(text).toContain('张三')
    expect(text).toContain('80%')
  })

  it('无数据时展示 BaseEmpty', async () => {
    mockGetStudentsCompletion.mockResolvedValue(EMPTY_RESULT)
    const wrapper = await mountView()
    expect(wrapper.find('.base-empty').exists()).toBe(true)
  })

  it('统计口径未接入时展示提示', async () => {
    mockGetStudentsCompletion.mockResolvedValue(EMPTY_RESULT)
    const wrapper = await mountView()
    expect(wrapper.find('.pending-tip').exists()).toBe(true)
  })

  it('请求失败时展示 BaseError，点击重试后重新加载', async () => {
    mockGetStudentsCompletion.mockRejectedValueOnce(new Error('网络异常'))
    mockGetStudentsCompletion.mockResolvedValueOnce(ONE_ROW_RESULT)
    const wrapper = await mountView()

    expect(wrapper.find('.base-error').exists()).toBe(true)
    expect(wrapper.find('.base-error').text()).toContain('网络异常')

    await wrapper.find('.retry-btn').trigger('click')
    await flushPromises()

    expect(mockGetStudentsCompletion).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.base-error').exists()).toBe(false)
    expect(wrapper.find('.data-table').text()).toContain('20250101')
  })
})
