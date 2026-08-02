/**
 * useTracking - 埋点事件 Composable
 *
 * 提供便捷方法，在视图组件中一键埋点。
 * 自动注入 step_enter（onMounted）和 step_exit（onUnmounted）事件。
 *
 * 使用方式：
 * ```ts
 * const { trackInteraction, trackSearchWord, trackQuizSubmit } = useTracking('stepone', '1')
 * // 自动发送 step_enter
 * // 离开时自动发送 step_exit
 *
 * trackInteraction('朗读', '播放', 5000)
 * trackSearchWord('之', true)
 * trackQuizSubmit(85, ['question_2', 'question_5'])
 * ```
 */

import { onMounted, onUnmounted, ref } from 'vue'
import { track, consumeBackButtonFlag } from '@/utils/tracking'

/**
 * 从路由参数中提取 step_id
 * 优先使用页面名称（如 'stepone'），拼接 poemId
 */
function buildStepId(routeName: string, poemId: string): string {
  return poemId ? `${routeName}_${poemId}` : routeName
}

export function useTracking(routeName: string, poemId: string) {
  const stepId = buildStepId(routeName, poemId)
  const enterTimestamp = ref(Date.now())
  const fromBackButton = ref(false)
  /** 记录下一步的 step_id，用于 step_exit 事件 */
  const nextStepId = ref('')

  /**
   * 设置"从后退按钮进入"标记
   * 在视图组件的 goPrev 调用前由导航守卫或组件调用方设置
   */
  function setFromBackButton(val: boolean) {
    fromBackButton.value = val
  }

  /**
   * 记录下一步的 step_id
   * 在导航前调用（如 goNext/goPrev 包装函数中）
   */
  function setNextStepId(id: string) {
    nextStepId.value = id
  }

  // ---- 自动埋点 ----

  onMounted(() => {
    enterTimestamp.value = Date.now()
    // 检查是否来自后退按钮（跨页面标记）
    const isBack = consumeBackButtonFlag() || fromBackButton.value
    track('step_enter', stepId, {
      from_back_button: isBack,
    })
    // 重置后退标记
    fromBackButton.value = false
  })

  onUnmounted(() => {
    const duration = Date.now() - enterTimestamp.value
    track('step_exit', stepId, {
      duration,
      next_step_id: nextStepId.value || undefined,
    })
  })

  // ---- 主动埋点方法 ----

  /**
   * 模块交互埋点
   * @param moduleType - 模块类型（朗读/AI/卡片）
   * @param action - 动作（播放/提交/翻转）
   * @param costTime - 耗时（ms）
   */
  function trackInteraction(moduleType: string, action: string, costTime?: number) {
    track('interaction', stepId, {
      module_type: moduleType,
      action,
      cost_time: costTime ?? 0,
    })
  }

  /**
   * 字词查询埋点
   * @param word - 查询的字词
   * @param isAudio - 是否点击了听发音
   */
  function trackSearchWord(word: string, isAudio = false) {
    track('search_word', stepId, {
      word,
      is_audio: isAudio,
    })
  }

  /**
   * 闯关提交埋点
   * @param score - 得分
   * @param wrongAnswers - 答错的题目 ID 列表
   */
  function trackQuizSubmit(score: number, wrongAnswers: string[] = []) {
    track('quiz_submit', stepId, {
      score,
      wrong_answers: wrongAnswers,
    })
  }

  return {
    stepId,
    setFromBackButton,
    setNextStepId,
    trackInteraction,
    trackSearchWord,
    trackQuizSubmit,
  }
}