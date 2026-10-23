/**
 * 题量清单（questionInventory）单测
 *
 * 完成率的分母来自题库 JSON，这里锁住两件事：
 * 1. 三关题量都能数出来（A 关走扁平数组口径，B/C 关走 blocks 中 type=quiz 的块数）
 * 2. 题号 → 关卡 / 篇目的解析与前端 adapter 生成的 `WEN_xx_A1` 规则一致
 *
 * 断言不写死具体题数，避免美术/内容侧加题就把 CI 打挂。
 */

const path = require('path')

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'

const inventory = require(path.join(__dirname, '../src/utils/questionInventory'))

beforeEach(() => {
  inventory.invalidateInventoryCache()
})

describe('题量清单', () => {
  it('应枚举篇目并给出三关题量', () => {
    const snap = inventory.buildInventory(true)
    expect(snap.texts.length).toBeGreaterThan(0)
    expect(snap.totals.total).toBeGreaterThan(0)
    expect(snap.totals.A).toBeGreaterThan(0)
    expect(snap.totals.total).toBe(snap.totals.A + snap.totals.B + snap.totals.C)

    for (const text of snap.texts) {
      expect(text.levels.A + text.levels.B + text.levels.C).toBe(text.total)
      expect(typeof text.title).toBe('string')
      expect(text.title.length).toBeGreaterThan(0)
    }
  })

  it('单篇查询与全量清单口径一致，未知篇目返回 0', () => {
    const snap = inventory.buildInventory(true)
    const first = snap.texts[0]
    const totals = inventory.getWenTotals(first.wen_id)
    expect(totals.total).toBe(first.total)
    expect(totals.has_data).toBe(first.total > 0)
    expect(inventory.getWenTotals('WEN_NOT_EXIST')).toEqual({
      A: 0,
      B: 0,
      C: 0,
      total: 0,
      has_data: false,
    })
  })

  it('缓存命中时不重复构造，invalidate 后重新读取', () => {
    const a = inventory.getInventory()
    const b = inventory.getInventory()
    expect(b).toBe(a)
    inventory.invalidateInventoryCache()
    expect(inventory.getInventory()).not.toBe(a)
  })

  it('题号解析：WEN_01_B2 → B 关 / WEN_01；无后缀返回 null', () => {
    expect(inventory.classifyQuestionLevel('WEN_01_A1')).toBe('A')
    expect(inventory.classifyQuestionLevel('WEN_02_B10')).toBe('B')
    expect(inventory.classifyQuestionLevel('WEN_03_C3')).toBe('C')
    expect(inventory.classifyQuestionLevel('qX')).toBeNull()
    expect(inventory.classifyQuestionLevel(null)).toBeNull()

    expect(inventory.classifyQuestionWen('WEN_01_A1')).toBe('WEN_01')
    expect(inventory.classifyQuestionWen('WEN_10_C2')).toBe('WEN_10')
    expect(inventory.classifyQuestionWen('qX')).toBeNull()
  })
})
