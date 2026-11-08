/**
 * 图表组件渲染测试
 *
 * 几何数值已由 chartUtils.test.ts 逐条覆盖，这里只验证「组件把数据正确接进 SVG」：
 * 柱子数量、空态、趋势图图例、热力图格子与色阶上限。
 * 这些是最容易被后续改动打断的部分（改了 props 名忘了模板），单测比肉眼看页面可靠。
 *
 * 运行方式：npm run test（vitest + happy-dom）
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BarChart from '../BarChart.vue'
import HeatmapChart from '../HeatmapChart.vue'
import LineChart from '../LineChart.vue'
import ProgressRing from '../ProgressRing.vue'
import StatCard from '../StatCard.vue'

describe('StatCard', () => {
  it('展示数值、单位与副说明', () => {
    const wrapper = mount(StatCard, {
      props: { label: '平均正确率', value: 66.7, unit: '%', hint: '仅统计已答题学生' },
    })
    expect(wrapper.text()).toContain('66.7')
    expect(wrapper.text()).toContain('%')
    expect(wrapper.text()).toContain('平均正确率')
    expect(wrapper.text()).toContain('仅统计已答题学生')
  })

  it('tone 只影响语义色类名，不改变内容', () => {
    const plain = mount(StatCard, { props: { label: '学生数', value: 12 } })
    expect(plain.classes()).toContain('stat-card')
    expect(plain.find('.stat-card--danger').exists()).toBe(false)

    const danger = mount(StatCard, { props: { label: '未开始', value: 3, tone: 'danger' } })
    expect(danger.find('[data-testid="stat-card"]').classes()).toContain('stat-card--danger')
  })
})

describe('BarChart', () => {
  const items = [
    { label: '202601', value: 50 },
    { label: '202602', value: 25 },
    { label: '202603', value: 0 },
  ]

  it('每个类目画一根柱，轴刻度含 0 与上限', () => {
    const wrapper = mount(BarChart, { props: { items, unit: '%' } })
    expect(wrapper.findAll('rect')).toHaveLength(3)
    expect(wrapper.findAll('.tick-text')).toHaveLength(5)
    expect(wrapper.find('[data-testid="bar-chart-empty"]').exists()).toBe(false)
  })

  it('maxValue 固定上限时柱子按比例缩放（百分比图必须用 100）', () => {
    const wrapper = mount(BarChart, { props: { items, maxValue: 100, height: 240 } })
    const bars = wrapper.findAll('rect')
    const heights = bars.map((bar) => Number(bar.attributes('height') ?? 0))
    expect(heights[0]).toBeGreaterThan(heights[1])
    expect(heights[1]).toBeCloseTo(heights[0] / 2, 1)
    expect(heights[2]).toBe(0)
  })

  it('横向模式给长标签用，标签列在条形左侧', () => {
    const wrapper = mount(BarChart, { props: { items, orientation: 'horizontal' } })
    expect(wrapper.findAll('rect')).toHaveLength(3)
    const firstBarX = Number(wrapper.find('rect').attributes('x') ?? 0)
    expect(firstBarX).toBeGreaterThan(0)
  })

  it('全零数据仍算有数据（0 也要画出来），空数组才走空态', () => {
    const zero = mount(BarChart, { props: { items: [{ label: 'a', value: 0 }] } })
    expect(zero.findAll('rect')).toHaveLength(1)

    const empty = mount(BarChart, { props: { items: [] } })
    expect(empty.find('[data-testid="bar-chart-empty"]').exists()).toBe(true)
  })
})

describe('LineChart', () => {
  // 用当年日期：shortDate 会按「是否今年」决定显示 MM-DD 还是 YYYY-MM-DD
  const year = new Date().getFullYear()
  const labels = [`01`, `02`, `03`].map((d) => `${year}-10-${d}`)

  it('单序列不显示图例，多序列显示', () => {
    const single = mount(LineChart, { props: { labels, series: [{ name: '提交量', values: [1, 2, 3] }] } })
    expect(single.findAll('.chart-legend li')).toHaveLength(0)

    const multi = mount(LineChart, {
      props: {
        labels,
        series: [
          { name: '提交量', values: [1, 2, 3] },
          { name: '活跃学生', values: [0, 1, 1] },
        ],
      },
    })
    expect(multi.findAll('.chart-legend li')).toHaveLength(2)
    // 每条序列一根 fill="none" 的折线（面积路径带 fill-opacity，不会匹配到）
    expect(multi.findAll('path[fill="none"]')).toHaveLength(2)
  })

  it('全零序列走空态，不给一张空白坐标轴', () => {
    const wrapper = mount(LineChart, { props: { labels, series: [{ name: '提交量', values: [0, 0, 0] }] } })
    expect(wrapper.find('[data-testid="line-chart-empty"]').exists()).toBe(true)
  })

  it('x 轴文字抽稀，首尾日期必显示', () => {
    const many = Array.from({ length: 30 }, (_, i) => `${year}-10-${String(i + 1).padStart(2, '0')}`)
    const wrapper = mount(LineChart, { props: { labels: many, series: [{ name: '提交量', values: many.map(() => 1) }] } })
    const texts = wrapper.findAll('.x-labels text').map((t) => t.text())
    expect(texts).toHaveLength(6)
    expect(texts[0]).toBe('10-01')
    expect(texts[texts.length - 1]).toBe('10-30')
  })
})

describe('HeatmapChart', () => {
  const columnLabels = ['202601', '202602']
  const rows = [
    { key: 'WEN_01', label: '岳阳楼记', cells: [{ value: 100 }, { value: 0 }] },
    { key: 'WEN_02', label: '醉翁亭记', cells: [{ value: 40 }, { value: 12.5 }] },
  ]

  it('格子数 = 行 × 列，并保留悬浮说明', () => {
    const wrapper = mount(HeatmapChart, {
      props: {
        columnLabels,
        rows: rows.map((row) => ({ ...row, cells: row.cells.map((c) => ({ ...c, title: `${row.label} ${c.value}%` })) })),
      },
    })
    expect(wrapper.findAll('rect')).toHaveLength(4)
    expect(wrapper.text()).toContain('岳阳楼记')
    expect(wrapper.findAll('title').length).toBeGreaterThanOrEqual(4)
  })

  it('0 值格子用占位灰，与答了但 0 分区分', () => {
    const wrapper = mount(HeatmapChart, { props: { columnLabels, rows } })
    const fills = wrapper.findAll('rect').map((rect) => rect.attributes('fill') ?? '')
    expect(fills.filter((f) => f === '#f2f0ea')).toHaveLength(1)
  })

  it('空行数组走空态', () => {
    const wrapper = mount(HeatmapChart, { props: { columnLabels, rows: [] } })
    expect(wrapper.find('[data-testid="heatmap-chart-empty"]').exists()).toBe(true)
  })
})

describe('ProgressRing', () => {
  it('按 percent 给出 dash 长度，越界被夹紧', () => {
    const half = mount(ProgressRing, { props: { percent: 50, size: 60, strokeWidth: 6 } })
    const circle = half.find('.ring-value')
    const [dash] = (circle.attributes('stroke-dasharray') ?? '').split(' ')
    const radius = (60 - 6) / 2
    expect(Number(dash)).toBeCloseTo(Math.PI * radius, 2)
    expect(half.text()).toContain('50%')

    const over = mount(ProgressRing, { props: { percent: 240, size: 60, strokeWidth: 6 } })
    expect(over.text()).toContain('100%')
  })

  it('label 进入无障碍名字', () => {
    const wrapper = mount(ProgressRing, { props: { percent: 30, label: 'A 关完成度' } })
    expect(wrapper.find('svg').attributes('aria-label')).toContain('A 关完成度')
  })
})
