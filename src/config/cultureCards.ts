/**
 * 文化卡片尺寸配置 —— Figma 标注接入点
 *
 * 卡片与视频播放区的像素尺寸以 Figma 标注为准，设计侧给出数值后只需修改本文件，
 * 组件（CultureCards.vue）不写死任何尺寸。
 *
 * 约定：
 * - 单位为 px（数字），组件渲染时拼 `px` 后缀
 * - null 表示沿用现有响应式布局（不注入内联尺寸）
 * - videoWidth 与 videoHeight 同时非 null 时，视频走固定尺寸盒模式
 *   （播放器控件固定在底部，视频区域等比填充）
 */
export interface CultureCardSizeConfig {
  /** 卡片宽度 */
  cardWidth: number | null
  /** 卡片高度 */
  cardHeight: number | null
  /** 视频播放区宽度 */
  videoWidth: number | null
  /** 视频播放区高度 */
  videoHeight: number | null
}

export const cultureCardSize: CultureCardSizeConfig = {
  cardWidth: null,
  cardHeight: null,
  videoWidth: null,
  videoHeight: null,
}
