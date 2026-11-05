/**
 * Step 2 block 可见性计算 —— 解锁交互核心
 *
 * Step 2 的 blocks 是 quiz / dialogue 交织的，没有固定模式：
 *   WEN_01: [dialogue, quiz, dialogue, dialogue, quiz, dialogue, dialogue]
 *   WEN_05: [quiz, dialogue, quiz, dialogue]
 *   WEN_13: [quiz, dialogue, quiz, ...]
 *
 * 解锁语义：
 *   每个 section 以一个 quiz 开头 + 后面连续的非 quiz block 组成。
 *   - section -1 = 第一个 quiz 之前的前置 dialogue → 一直可见
 *   - section N（N >= 0）= 第 N+1 个 quiz + 它后面的所有非 quiz block
 *     初始只可见 quiz 本身；答完 quiz 后，它的解析 dialogue 们 + section N+1 的 quiz 才可见
 *
 * 解锁规则（按 completedQuizCount，即已提交的 quiz 数）：
 *   completedCount = 0: section -1 可见；section 0 的 quiz 可见，其解析 dialogue + section 1+ 全 hidden
 *   completedCount = K: section < K 全可见（quiz + 解析 dialogue）；section K 的 quiz 可见，其解析 dialogue hidden；section > K 全 hidden
 *   全部完成后：所有 section 全可见
 */

export type BlockType = 'quiz' | 'dialogue' | string

export interface VisibilityBlock {
  type: BlockType
}

export interface VisibilityResult {
  /** 每个 blockIndex 是否可见，长度 = blocks.length */
  visible: boolean[]
  /** section 分配（调试用），长度 = blocks.length */
  sectionOf: number[]
  /** 各 section 起始 quiz 的 blockIndex，长度 = quiz 总数 */
  quizStarts: number[]
}

/**
 * 纯函数：输入 blocks + 已答完 quiz 数 → 每个 block 是否可见
 *
 * @param blocks Step 2 的 blocks 数组（只需要 .type 字段）
 * @param completedQuizCount 已提交的 quiz 数量（来自 useQuizFlow.completedCount）
 * @param isAllCompleted 是否全部完成（学生重新进入已完成页面时，强制全显）
 */
export function computeStep2BlockVisibility(
  blocks: readonly VisibilityBlock[],
  completedQuizCount: number,
  isAllCompleted: boolean = false,
): VisibilityResult {
  const totalBlocks = blocks.length
  if (totalBlocks === 0) {
    return { visible: [], sectionOf: [], quizStarts: [] }
  }

  // 1. 找所有 quiz 的 blockIndex
  const quizStarts: number[] = blocks
    .map((b, i) => (b.type === 'quiz' ? i : -1))
    .filter((i) => i !== -1)

  // 没有 quiz → 全部可见（纯 dialogue 页）
  if (quizStarts.length === 0) {
    return {
      visible: blocks.map(() => true),
      sectionOf: blocks.map(() => -1),
      quizStarts: [],
    }
  }

  // 2. 每个 block 归属哪个 section
  //    -1 = 前置（第一个 quiz 之前）
  //     0+ = 对应 quiz section
  const sectionOf: number[] = blocks.map((_, i) => {
    let section = -1
    for (let q = 0; q < quizStarts.length; q++) {
      const qStart = quizStarts[q]!
      if (i >= qStart) section = q
    }
    return section
  })

  // 3. isAllCompleted override → 全可见
  if (isAllCompleted) {
    return {
      visible: blocks.map(() => true),
      sectionOf,
      quizStarts,
    }
  }

  // 4. 解锁规则
  const visible = blocks.map((_, i) => {
    // 数组索引在 strictNullChecks 下可能 undefined（提前 return 已排除空数组）
    const sec = sectionOf[i] ?? -1
    const quizStart = quizStarts[sec]  // sec >= 0 时必有对应值

    // 前置 dialogue（第一个 quiz 之前）→ 一直可见
    if (sec === -1) return true

    // 已答完的 section → 全部可见（quiz 已答 + 所有解析 dialogue）
    if (sec < completedQuizCount) return true

    // 当前正在答的 section：只有 quiz 本身可见，它后面的解析 dialogue hidden
    if (sec === completedQuizCount) {
      return quizStart === i
    }

    // 后面的 section → 全部 hidden
    return false
  })

  return { visible, sectionOf, quizStarts }
}
