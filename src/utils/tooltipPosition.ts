/**
 * 生字注释浮层的定位计算（纯函数，无 DOM 依赖，可单测）
 *
 * 规则（与 WordList.vue 的浮层配套）：
 * 1. 默认落在光标右下（偏移 TOOLTIP_OFFSET）。
 * 2. 右侧放不下 → 翻到光标左侧；下方放不下 → 翻到光标上方。
 * 3. 最后四边各留 VIEWPORT_EDGE_GAP 做 clamp，保证小屏/贴边词也不冲出视口。
 *
 * 长注释（WEN_01 84 字、WEN_03 174 字）配合 CSS `max-width: min(320px, 100vw - 16px)`
 * 限宽换行，尺寸由调用方实测后传入；首次显示尚无实测尺寸时传估算值。
 */

/** 浮层与光标的间距（像素） */
export const TOOLTIP_OFFSET = 10
/** 浮层与视口边缘保留的最小间距（像素） */
export const VIEWPORT_EDGE_GAP = 8

export interface TooltipSize {
  width: number
  height: number
}

export interface TooltipPosition {
  x: number
  y: number
}

/**
 * 计算浮层左上角坐标
 *
 * @param mouseX - 光标 x（视口坐标）
 * @param mouseY - 光标 y（视口坐标）
 * @param size - 浮层尺寸（实测优先，未知时传估算值）
 * @param viewport - 视口尺寸，默认取 window
 */
export function computeTooltipPosition(
  mouseX: number,
  mouseY: number,
  size: TooltipSize,
  viewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): TooltipPosition {
  const edge = VIEWPORT_EDGE_GAP
  let x = mouseX + TOOLTIP_OFFSET
  let y = mouseY + TOOLTIP_OFFSET

  if (x + size.width > viewport.width - edge) x = mouseX - size.width - TOOLTIP_OFFSET
  if (y + size.height > viewport.height - edge) y = mouseY - size.height - TOOLTIP_OFFSET

  // 四边兜底：浮层比视口还大时夹到边距，而不是留成负值
  x = Math.min(Math.max(edge, x), Math.max(edge, viewport.width - size.width - edge))
  y = Math.min(Math.max(edge, y), Math.max(edge, viewport.height - size.height - edge))

  return { x, y }
}

/**
 * 断言用（也在运行时兜底）：浮层是否完整落在视口内
 *
 * @param tolerance - 亚像素容差
 */
export function isInsideViewport(
  pos: TooltipPosition,
  size: TooltipSize,
  viewport: { width: number; height: number },
  tolerance = 0.5,
): boolean {
  return (
    pos.x >= VIEWPORT_EDGE_GAP - tolerance &&
    pos.y >= VIEWPORT_EDGE_GAP - tolerance &&
    pos.x + size.width <= viewport.width - VIEWPORT_EDGE_GAP + tolerance &&
    pos.y + size.height <= viewport.height - VIEWPORT_EDGE_GAP + tolerance
  )
}
