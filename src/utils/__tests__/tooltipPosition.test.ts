import { describe, it, expect } from 'vitest'
import {
  computeTooltipPosition,
  isInsideViewport,
  TOOLTIP_OFFSET,
  VIEWPORT_EDGE_GAP,
} from '../tooltipPosition'

/** 桌面视口（线上正文容器 752px 宽，视口取常见的 1366×768） */
const DESKTOP = { width: 1366, height: 768 }
/** 手机竖屏视口 */
const PHONE = { width: 375, height: 667 }

/**
 * 长注释浮层的代表尺寸。
 *
 * 宽度取自 CSS `max-width: min(320px, calc(100vw - 16px))`；
 * 高度按 320px 限宽、约 21 字/行、行高 1.7 估算：WEN_01 的 84 字约 4 行（≈117px，
 * 与线上注入原型实测一致），WEN_03 的 174 字约 9 行（≈240px）。
 * 这里把它当边界用例的输入尺寸用，断言的是定位算法的视口性质，不是排版高度。
 */
const SHORT_NOTE = { width: 183, height: 46 }
const LONG_NOTE_84 = { width: 320, height: 117 }
const LONG_NOTE_174 = { width: 320, height: 240 }

describe('computeTooltipPosition', () => {
  it('默认落在光标右下', () => {
    const pos = computeTooltipPosition(400, 300, SHORT_NOTE, DESKTOP)
    expect(pos).toEqual({ x: 410, y: 310 })
  })

  it('右侧放不下 → 翻到光标左侧', () => {
    const pos = computeTooltipPosition(DESKTOP.width - 50, 300, LONG_NOTE_174, DESKTOP)
    expect(pos.x).toBe(DESKTOP.width - 50 - LONG_NOTE_174.width - TOOLTIP_OFFSET)
    expect(isInsideViewport(pos, LONG_NOTE_174, DESKTOP)).toBe(true)
  })

  it('下方放不下 → 翻到光标上方（页面末段的词不压住「返回 / 继续」按钮）', () => {
    const pos = computeTooltipPosition(600, DESKTOP.height - 40, LONG_NOTE_174, DESKTOP)
    expect(pos.y).toBe(DESKTOP.height - 40 - LONG_NOTE_174.height - TOOLTIP_OFFSET)
    expect(isInsideViewport(pos, LONG_NOTE_174, DESKTOP)).toBe(true)
  })

  it('四边 clamp：光标贴着左上角也不会变成负坐标', () => {
    const pos = computeTooltipPosition(0, 0, LONG_NOTE_174, DESKTOP)
    expect(pos.x).toBeGreaterThanOrEqual(VIEWPORT_EDGE_GAP)
    expect(pos.y).toBeGreaterThanOrEqual(VIEWPORT_EDGE_GAP)
  })

  it.each([
    ['桌面 1366×768', DESKTOP],
    ['手机 375×667', PHONE],
  ])('%s：长注释在光标扫过整页的任意位置都完整落在视口内', (_name, viewport) => {
    for (const size of [SHORT_NOTE, LONG_NOTE_84, LONG_NOTE_174]) {
      for (let mx = 0; mx <= viewport.width; mx += 37) {
        for (let my = 0; my <= viewport.height; my += 29) {
          const pos = computeTooltipPosition(mx, my, size, viewport)
          expect(isInsideViewport(pos, size, viewport)).toBe(true)
        }
      }
    }
  })

  it('浮层比视口还高时（极端横屏小窗）夹到上边距，不出现负坐标', () => {
    const tiny = { width: 500, height: 120 }
    const pos = computeTooltipPosition(250, 110, LONG_NOTE_174, tiny)
    expect(pos.y).toBe(VIEWPORT_EDGE_GAP)
    expect(pos.x).toBeGreaterThanOrEqual(VIEWPORT_EDGE_GAP)
  })
})
