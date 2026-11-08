/**
 * 答题交互配置（口径集中处）
 *
 * 背景：答题页面的文案、显示策略与闯关规则由需求方反复调整，
 * 此前散落在两个 Step 视图里，改一次文案要动多个 .vue。
 *
 * 约定：渲染器与状态机只读本配置，不出现散落字符串与页面分支。
 * - 改文案 → 只改 texts
 * - 改显示 → 只改 display
 * - 改闯关规则 → 只改 advancePolicy
 */

/** 解析展示时机 */
export type ExplanationMode = 'never' | 'after-submit' | 'always'
/** 情景文本展示范围（quiz-list 模式） */
export type ScenarioMode = 'first-item' | 'every-item' | 'none'
/** 解锁下一题的时机 */
export type AdvancePolicy = 'on-submit' | 'on-correct' | 'manual'

export interface QuizInteractionConfig {
  texts: {
    /** 提交按钮 */
    submit: string
    /** 继续按钮（与 BackContinue 保持一致） */
    next: string
    /** 重试提示 */
    retry: string
    /** 完成态标题 */
    completed: string
    /** 题目配置异常提示 */
    invalidQuestion: string
    /** 提交失败提示 */
    submitFailed: string
    /** 完成态统计文案 */
    completedStats: (correct: number, total: number) => string
  }
  display: {
    /** 是否展示难度标签 */
    showDifficulty: boolean
    /** 答案解析展示时机 */
    showExplanation: ExplanationMode
    /** 情景文本展示范围 */
    showScenario: ScenarioMode
    /** true：已解锁旧题保持展开；false：只展开当前题（旧题收起但不卸载） */
    allowReview: boolean
    /** 预渲染 + 视觉隐藏（当前唯一取值，保留字段便于后续扩展） */
    revealMode: 'visual'
    /** 是否展示「第 n 题」 */
    showQuizNumber: boolean
  }
  advancePolicy: AdvancePolicy
}

/** 默认交互配置（与线上现行为保持一致） */
export const defaultQuizInteraction: QuizInteractionConfig = {
  texts: {
    submit: '提交答案',
    next: '继续',
    retry: '重新加载',
    completed: '测验完成！',
    invalidQuestion: '题目配置异常，请联系老师',
    submitFailed: '提交失败，请重试',
    completedStats: (correct, total) => `答对 ${correct} / ${total} 题`,
  },
  display: {
    showDifficulty: true,
    showExplanation: 'after-submit',
    showScenario: 'first-item',
    allowReview: true,
    revealMode: 'visual',
    showQuizNumber: true,
  },
  advancePolicy: 'on-submit',
}
