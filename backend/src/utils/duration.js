/**
 * 时长解析工具（F-003）
 *
 * 支持：
 * - 纯数字：'3600' → 3600（秒）
 * - 带单位：'60s' / '30m' / '12h' / '7d'
 *
 * 返回 null 表示配置非法，由调用方决定失败策略。
 *
 * 背景：原实现直接用 Number(value) 解析 JWT_EXPIRES_IN，
 * 运维写 '7d' 时 Number('7d') → NaN → 静默回退到 3600，
 * 造成「配置改了却不生效、用户仍 1 小时被登出」的假象。
 */

const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 }

function parseDuration(value) {
  if (value === undefined || value === null) return null

  const raw = String(value).trim()
  if (raw === '') return null

  // 纯数字视为秒
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw)
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null
  }

  const matched = raw.match(/^(\d+)\s*([smhd])$/i)
  if (!matched) return null

  const amount = Number(matched[1])
  if (!Number.isFinite(amount) || amount <= 0) return null

  const unit = matched[2].toLowerCase()
  return amount * UNIT_SECONDS[unit]
}

module.exports = { parseDuration }
