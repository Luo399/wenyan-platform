/**
 * chartUtils 单元测试
 *
 * 这些纯函数决定了所有手写 SVG 图表的形状：刻度上限算错会让柱子顶出画布，
 * bandCenter 偏移会让柱子和轴文字错位，ringGeometry 错了圆环就不闭合。
 * 因此几何部分逐条断言，而不是只测「能渲染」。
 *
 * 运行方式：npm run test（vitest 的 include 只吃 src 目录下的 .test.ts）
 */

import { describe, expect, it } from 'vitest'
import {
  areaPath,
  axisLabelIndices,
  bandCenter,
  bandWidth,
  buildTicks,
  formatPercent,
  formatValue,
  heatFill,
  heatTextColor,
  linePath,
  niceCeil,
  ringGeometry,
  shortDate,
  valueToY,
} from '../chartUtils'

describe('niceCeil', () => {
  it('把上限收敛到 1/2/2.5/5/10 的十倍阶梯', () => {
    expect(niceCeil(37)).toBe(50)
    expect(niceCeil(143)).toBe(200)
    expect(niceCeil(9)).toBe(10)
    expect(niceCeil(2.4)).toBe(2.5)
    expect(niceCeil(0.37)).toBe(0.5)
  })

  it('0、负数、NaN 都回落到 1，避免除零', () => {
    expect(niceCeil(0)).toBe(1)
    expect(niceCeil(-5)).toBe(1)
    expect(niceCeil(Number.NaN)).toBe(1)
  })
})

describe('buildTicks', () => {
  it('含 0 与 max 的等分刻度', () => {
    expect(buildTicks(100, 4)).toEqual([0, 25, 50, 75, 100])
    expect(buildTicks(10, 5)).toEqual([0, 2, 4, 6, 8, 10])
  })

  it('小步长保留两位小数', () => {
    expect(buildTicks(1, 4)).toEqual([0, 0.25, 0.5, 0.75, 1])
  })
})

describe('bandCenter / bandWidth', () => {
  it('类目圆心等分且居中', () => {
    expect(bandCenter(0, 4, 100)).toBeCloseTo(12.5, 6)
    expect(bandCenter(3, 4, 100)).toBeCloseTo(87.5, 6)
    expect(bandCenter(0, 0, 100)).toBe(0)
  })

  it('柱宽随类目数变化并封顶', () => {
    expect(bandWidth(4, 100)).toBeCloseTo(15.5, 6)
    expect(bandWidth(2, 1000)).toBe(48)
    expect(bandWidth(0, 100)).toBe(0)
    // 类目极多时也不给 0 宽，否则柱子直接消失
    expect(bandWidth(500, 100)).toBe(2)
  })
})

describe('valueToY', () => {
  it('0 落在底边、max 落在顶边，并夹紧越界值', () => {
    expect(valueToY(0, 100, 200)).toBe(200)
    expect(valueToY(100, 100, 200)).toBe(0)
    expect(valueToY(50, 100, 200)).toBe(100)
    expect(valueToY(180, 100, 200)).toBe(0)
    expect(valueToY(-10, 100, 200)).toBe(200)
  })

  it('max 为 0 时不产生 NaN', () => {
    expect(valueToY(5, 0, 200)).toBe(200)
  })
})

describe('linePath / areaPath', () => {
  it('折线从 M 起、其余用 L 连接', () => {
    expect(linePath([{ x: 0, y: 10 }, { x: 5, y: 2 }])).toBe('M0,10 L5,2')
    expect(linePath([])).toBe('')
  })

  it('面积路径闭合到底边', () => {
    const path = areaPath([{ x: 1, y: 2 }, { x: 3, y: 4 }], 50)
    expect(path).toBe('M1,2 L3,4 L3,50 L1,50 Z')
    // 少于 2 点画不出面积
    expect(areaPath([{ x: 1, y: 2 }], 50)).toBe('')
  })

  it('坐标保留两位小数，避免 path 文本过长', () => {
    expect(linePath([{ x: 1.23456, y: 2 }])).toBe('M1.23,2')
  })
})

describe('ringGeometry', () => {
  it('满环的 dash 等于周长，percent 越界被夹紧', () => {
    const full = ringGeometry(30, 100)
    expect(full.dash).toBeCloseTo(full.circumference, 6)
    expect(ringGeometry(30, 180).dash).toBeCloseTo(full.circumference, 6)
    expect(ringGeometry(30, -20).dash).toBe(0)
  })

  it('半环的 dash 是周长的一半', () => {
    const half = ringGeometry(20, 50)
    expect(half.dash).toBeCloseTo(half.circumference / 2, 6)
  })
})

describe('heatFill / heatTextColor', () => {
  it('0 值给占位灰，和「答了但 0 分」区分开', () => {
    expect(heatFill(0)).toBe('#f2f0ea')
    expect(heatFill(0.001)).not.toBe('#f2f0ea')
    expect(heatFill(Number.NaN)).toBe('#f2f0ea')
  })

  it('色阶随比例单调加深', () => {
    const alpha = (fill: string) => Number(fill.match(/,\s*([\d.]+)\)/)?.[1] ?? 0)
    expect(alpha(heatFill(0.2))).toBeLessThan(alpha(heatFill(0.6)))
    expect(alpha(heatFill(0.6))).toBeLessThanOrEqual(alpha(heatFill(1)))
  })

  it('深色格换白字保证对比度', () => {
    expect(heatTextColor(0.9)).toBe('#ffffff')
    expect(heatTextColor(0.2)).toBe('var(--color-text)')
  })
})

describe('axisLabelIndices', () => {
  it('类目不多时全显示', () => {
    expect(axisLabelIndices(3)).toEqual([0, 1, 2])
  })

  it('超限时抽稀且首尾必显示', () => {
    const indices = axisLabelIndices(30, 6)
    expect(indices).toHaveLength(6)
    expect(indices[0]).toBe(0)
    expect(indices[indices.length - 1]).toBe(29)
    // 索引必须严格递增，否则轴文字会重叠
    indices.forEach((value, i) => {
      if (i > 0) expect(value).toBeGreaterThan(indices[i - 1])
    })
  })

  it('空类目返回空数组', () => {
    expect(axisLabelIndices(0)).toEqual([])
  })
})

describe('shortDate', () => {
  it('当年只显示月日，跨年保留年份', () => {
    const year = new Date().getFullYear()
    expect(shortDate(`${year}-03-07`)).toBe('03-07')
    expect(shortDate('2019-03-07')).toBe('2019-03-07')
    expect(shortDate('')).toBe('')
    expect(shortDate('bad')).toBe('bad')
  })
})

describe('formatValue / formatPercent', () => {
  it('整数不带小数点', () => {
    expect(formatValue(12)).toBe('12')
    expect(formatValue(12.34)).toBe('12.3')
    expect(formatValue(Number.NaN)).toBe('0')
  })

  it('百分比去掉多余的 .0', () => {
    expect(formatPercent(66.7)).toBe('66.7%')
    expect(formatPercent(50)).toBe('50%')
    expect(formatPercent(0)).toBe('0%')
  })
})
