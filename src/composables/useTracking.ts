/**
 * useTracking - 埋点事件 Composable
 *
 * 提供便捷方法，在视图组件中一键埋点。
 * 自动注入 step_enter（onMounted）和 step_exit（onUnmounted）事件。
 * 自动处理页面可见性变化，在校正停留时长时剔除切后台的时间。
 *
 * 使用方式：
 * ```ts
 * const { trackInteraction, trackSearchWord, trackQuizSubmit } = useTracking('stepone', '1')
 * // 自动发送 step_enter
 * // 离开时自动发送 step_exit（含校正后的真实停留时长）
 *
 * trackInteraction('朗读', '播放', 5000)
 * trackSearchWord('之', true)
 * trackQuizSubmit(85, ['question_2', 'question_5'])
 * ```
 */

import { onMounted, onUnmounted, onActivated, onDeactivated, ref, watch } from 'vue'
import { track, consumeBackButtonFlag, consumeExitType, isPageVisible } from '@/utils/tracking'

// ============================================================
// 会话级去重：每个 session 每个 step 只记录一次"首次进入"
// ============================================================

/** 记录当前 session 已首次进入的 step_id 集合 */
const firstEnterSet = new Set<string>()

/**
 * 是否为当前 session 中该 step 的首次进入
 */
function isFirstEnter(stepId: string): boolean {
  if (firstEnterSet.has(stepId)) return false
  firstEnterSet.add(stepId)
  return true
}

/**
 * 重置首次进入记录（在 session 重置时调用）
 */
export function resetFirstEnterSet(): void {
  firstEnterSet.clear()
}

// ============================================================
// useTracking composable
// ============================================================

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
  /** 后台累计时长（ms），用于从总时长中扣除 */
  const hiddenDuration = ref(0)
  /** 最后一次可见的时间戳 */
  let lastVisibleTime = Date.now()
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

  // ---- 页面可见性变化处理 ----
  // 切后台时暂停计时，切回时恢复
  function handleVisibilityChange() {
    if (document.hidden) {
      // 页面隐藏，记录当前时间，恢复时计算差值
      hiddenDuration.value += Date.now() - lastVisibleTime
    } else {
      // 页面可见，重置最后一次可见时间
      lastVisibleTime = Date.now()
    }
  }

  // ---- 自动埋点 ----

  onMounted(() => {
    enterTimestamp.value = Date.now()
    lastVisibleTime = Date.now()
    hiddenDuration.value = 0
    // 检查是否来自后退按钮（跨页面标记）
    const isBack = consumeBackButtonFlag() || fromBackButton.value

    // 检查是否为首次进入（去重口径）
    const firstEnter = isFirstEnter(stepId)

    track('step_enter', stepId, {
      from_back_button: isBack,
      is_first_enter: firstEnter,
    })
    // 重置后退标记
    fromBackButton.value = false

    // 开始监听 visibilitychange
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    // 移除监听
    document.removeEventListener('visibilitychange', handleVisibilityChange)

    // 计算真实停留时长：总时长 - 后台时长
    const totalDuration = Date.now() - enterTimestamp.value
    const realDuration = Math.max(0, totalDuration - hiddenDuration.value)

    // 获取退出类型
    const exitType = consumeExitType()

    track('step_exit', stepId, {
      duration: realDuration,
      total_duration: totalDuration,
      hidden_duration: hiddenDuration.value,
      next_step_id: nextStepId.value || undefined,
      exit_type: exitType,
    })
  })

  // keep-alive 支持
  onActivated(() => {
    lastVisibleTime = Date.now()
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onDeactivated(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    // 组件被缓存时，记录当前时长
    hiddenDuration.value += Date.now() - lastVisibleTime
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
