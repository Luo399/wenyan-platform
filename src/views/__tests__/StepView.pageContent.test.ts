/**
 * StepView 真实页面数据集成测试（WEN_05–19、22–27）
 *
 * 与 StepView.test.ts 的分工：
 * - StepView.test.ts 用桩组件锁「关卡放行 / 进度解锁」这类视图逻辑；
 * - 本文件让 useDataLoader 直接读 public/data 下的真实 JSON，并挂载真实的
 *   BlockRenderer → BlockQuiz → AdaptQuiz / QuizCard，验证「数据 → 渲染 → 判分 → 提交」
 *   整条链路。换位后的答案字母（第二关）、下标（第三关）如果对不上，
 *   学生会看到「点对了却显示错误」，这里会直接红。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import StepView from '../StepView.vue'
import DialogueCard from '@/components/DialogueCard.vue'

const h = vi.hoisted(() => ({
  route: { name: 'steptwo', params: { id: '05' } } as { name: string; params: { id: string } },
  loggedIn: true,
  loaderUrls: [] as string[],
}))

vi.mock('vue-router', () => ({
  useRoute: () => h.route,
}))

vi.mock('@/utils/asset', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/asset')>()
  return {
    ...actual,
    getDataUrlWithVersion: (dir: string, file: string) => `/data/${dir}/${file}`,
  }
})

vi.mock('@/utils/tracking', () => ({
  markNextEnterFromBackButton: vi.fn(),
}))

vi.mock('@/composables/useNavigation', () => ({
  useNavigation: () => ({ goNext: vi.fn(), goPrev: vi.fn() }),
}))

vi.mock('@/composables/useTracking', () => ({
  useTracking: () => ({
    trackInteraction: vi.fn(),
    trackQuizSubmit: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get isLoggedIn() {
      return h.loggedIn
    },
    get user() {
      return h.loggedIn ? { studentId: 'S001', username: '测试学生' } : null
    },
    initialize: vi.fn(),
  }),
}))

const apiMock = vi.hoisted(() => ({
  submitSingleAnswer: vi.fn(),
  submitAnswers: vi.fn(),
}))

vi.mock('@/services/apiService', () => apiMock)

/**
 * 真实数据版 loader：只认 /data/pages_level{2,3}_.../WEN_xx.json，
 * 直接读仓库里的 public 副本（与线上同源），其余 URL（如 AdaptQuiz 自己的
 * level2_quiz 兜底请求）返回空数据，避免测试发网络请求。
 */
vi.mock('@/composables/useDataLoader', async () => {
  const { ref } = await import('vue')
  const fs = await import('node:fs')
  const path = await import('node:path')

  return {
    useDataLoader: (urlGetter: () => string | Promise<string>) => {
      const url = urlGetter()
      h.loaderUrls.push(url)
      const data = ref<unknown>(null)
      const error = ref<string | null>(null)

      const match =
        typeof url === 'string'
          ? /^\/data\/(pages_level[23]_[a-z_]+)\/(WEN_\d+)\.json$/.exec(url)
          : null
      if (match) {
        const filePath = path.resolve(process.cwd(), 'public/data', match[1], `${match[2]}.json`)
        try {
          data.value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        } catch (err) {
          error.value = err instanceof Error ? err.message : String(err)
        }
      }

      return {
        data,
        loading: ref(false),
        error,
        isTimeout: ref(false),
        retry: vi.fn(),
        load: vi.fn(),
      }
    },
  }
})

const PageScaffoldStub = defineComponent({
  name: 'PageScaffold',
  props: [
    'title',
    'subtitle',
    'loading',
    'error',
    'isEmpty',
    'emptyText',
    'showNavigation',
    'showContinue',
  ],
  template: '<div class="page-scaffold-stub"><slot /></div>',
})

function mountStep() {
  return mount(StepView, {
    global: {
      stubs: {
        WordList: true,
        MultiRoleReading: true,
        BackContinue: true,
        CultureCards: true,
        PageScaffold: PageScaffoldStub,
      },
    },
  })
}

interface RawLevel2Page {
  blocks: Array<{ type: string; data: { correct_answer: string } }>
}

interface RawLevel3Page {
  items: Array<{ quiz: { correct_answer: number } }>
}

/** 读取页面文件里的标准答案，避免测试里再抄一遍字母/下标 */
async function readAnswer(
  dir: 'pages_level2_dialog_quiz' | 'pages_level3_adaptive_quiz',
  wenId: string,
): Promise<string | number> {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const raw = fs.readFileSync(
    path.resolve(process.cwd(), 'public/data', dir, `${wenId}.json`),
    'utf8',
  )

  if (dir === 'pages_level3_adaptive_quiz') {
    return (JSON.parse(raw) as RawLevel3Page).items[0].quiz.correct_answer
  }
  const page = JSON.parse(raw) as RawLevel2Page
  const quiz = page.blocks.find((block) => block.type === 'quiz')
  if (!quiz) throw new Error(`${wenId} 缺少 quiz 块`)
  return quiz.data.correct_answer
}

function letterToIndex(letter: string): number {
  return letter.charCodeAt(0) - 65
}

describe('StepView + 真实页面数据', () => {
  beforeEach(() => {
    h.route = { name: 'steptwo', params: { id: '05' } }
    h.loggedIn = true
    h.loaderUrls.length = 0
    apiMock.submitSingleAnswer.mockReset()
    apiMock.submitSingleAnswer.mockResolvedValue({})
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('第二关 WEN_05：真实 JSON 渲染题干/选项，点对答案提交 B，解析对话随后解锁', async () => {
    const answer = await readAnswer('pages_level2_dialog_quiz', 'WEN_05')
    expect(answer).toBe('B')

    const wrapper = mountStep()
    await flushPromises()

    expect(wrapper.find('.step-not-ready').exists()).toBe(false)
    const quiz = wrapper.find('.adapt-quiz')
    expect(quiz.exists()).toBe(true)
    expect(quiz.text()).toContain('唐雎的回应是')
    expect(quiz.findAll('.option-btn')).toHaveLength(4)
    // 第一题解析对话紧跟题目，提交前不该出现
    expect(wrapper.findAllComponents(DialogueCard)).toHaveLength(0)

    await quiz.findAll('.option-btn')[letterToIndex(answer)].trigger('click')
    await quiz.find('.submit-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.adapt-quiz .option-btn.correct').exists()).toBe(true)
    expect(apiMock.submitSingleAnswer).toHaveBeenCalledTimes(1)
    expect(apiMock.submitSingleAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        wenId: 'WEN_05',
        questionId: 'WEN_05_B1',
        userAnswer: answer,
        correctAnswer: answer,
      }),
    )
    // 提交后解析对话必须解锁；DialogueCard 有打字机效果，断言传入文案而不是屏幕上逐字结果
    const dialogues = wrapper.findAllComponents(DialogueCard)
    expect(dialogues).toHaveLength(1)
    expect(dialogues[0].props('pre_dialog')).toContain('唐雎：答案是B')
  })

  it('第二关 WEN_27：正确项在 D（换位后），点第四个选项判对', async () => {
    h.route = { name: 'steptwo', params: { id: '27' } }
    const answer = await readAnswer('pages_level2_dialog_quiz', 'WEN_27')
    expect(answer).toBe('D')

    const wrapper = mountStep()
    await flushPromises()

    const quiz = wrapper.find('.adapt-quiz')
    const options = quiz.findAll('.option-btn')
    expect(options).toHaveLength(4)
    expect(options[3].text()).toContain('山川之美，古来共谈')

    await options[letterToIndex(answer)].trigger('click')
    await quiz.find('.submit-btn').trigger('click')
    await flushPromises()

    expect(apiMock.submitSingleAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        wenId: 'WEN_27',
        questionId: 'WEN_27_B1',
        userAnswer: 'D',
        correctAnswer: 'D',
      }),
    )
  })

  it('第三关 WEN_05：题干独立渲染、选项不含题干，点对下标 0 提交并显示解析', async () => {
    h.route = { name: 'stepthree', params: { id: '05' } }
    const answer = await readAnswer('pages_level3_adaptive_quiz', 'WEN_05')
    expect(answer).toBe(0)

    const wrapper = mountStep()
    await flushPromises()

    expect(wrapper.find('.step-not-ready').exists()).toBe(false)
    expect(wrapper.text()).toContain('唐雎出使秦国归来')

    const card = wrapper.find('.quiz-card')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('唐雎能够“不辱使命”，最根本的原因是（）')

    const options = card.findAll('.option-btn')
    expect(options).toHaveLength(3)
    // 题干不能混进可选项（历史错位：options[0] 是题干）
    for (const option of options) {
      expect(option.text()).not.toMatch(/[（(]\s*[)）]\s*$/)
    }

    await options[answer as number].trigger('click')
    await wrapper.find('.quiz-card-footer .submit-btn').trigger('click')
    await flushPromises()

    expect(apiMock.submitSingleAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        wenId: 'WEN_05',
        questionId: 'WEN_05_C1',
        userAnswer: answer,
        correctAnswer: answer,
      }),
    )
    expect(wrapper.find('.explanation-box').text()).toContain('正确答案：A')
    expect(wrapper.text()).toContain('测验完成')
  })

  it('第三关 WEN_20：页面数据未交付，仍显示「制作中」且不发请求', async () => {
    h.route = { name: 'stepthree', params: { id: '20' } }

    const wrapper = mountStep()
    await flushPromises()

    expect(wrapper.find('.step-not-ready').exists()).toBe(true)
    expect(wrapper.find('.quiz-card').exists()).toBe(false)
    expect(h.loaderUrls.filter((url) => url !== '')).toEqual([])
  })
})
