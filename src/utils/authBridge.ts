/**
 * 鉴权桥（AuthBridge）
 *
 * 为什么需要这一层：
 * `utils/api.ts` 要在请求头里带 token、收到 401 时要触发登出；
 * `utils/tracking.ts` 要在埋点事件里带 user_id。两边原本都直接
 * `import { useAuthStore } from '@/stores/auth'`，而 `stores/auth.ts` 又必须
 * 用 `api.post()` 发登录请求、用 `utils/tracking.resetSessionId()` 切割会话
 * ——于是 utils ↔ stores 之间形成两条静态循环：
 *
 *   utils/api.ts       ⇄  stores/auth.ts
 *   utils/tracking.ts  ⇄  stores/auth.ts
 *
 * 这里把方向掰正：**store 依赖 util，util 不依赖 store**。
 * store 在实例化时把自己注册进来，utils 只认这个接口。
 *
 * 按 Pinia 实例分桶（WeakMap）而不是用单个全局变量，是为了保持与原来
 * 完全一致的语义：读到的一定是「当前 active pinia 上的那份登录态」。
 * 单元测试里每个用例 `setActivePinia(createPinia())` 都换了实例，
 * 旧实例注册的桥不会串到新实例上；当前实例还没创建过 auth store 时
 * `activeAuthBridge()` 返回 null，调用方的回退行为与原来
 * 「Pinia 尚未安装」分支逐字相同。
 */

import { getActivePinia } from 'pinia'
import type { Pinia } from 'pinia'

/** store 注入给 utils 的最小鉴权视图 */
export interface AuthBridge {
  /** 当前登录 token；未登录为 null（不含 localStorage 回退，回退由调用方决定） */
  getToken(): string | null
  /** 是否已登录（token 与 user 都齐备） */
  isLoggedIn(): boolean
  /** 埋点用的 user_id；未登录返回空串 */
  getUserId(): string
  /** 触发登出（清 store + 清持久化 + 切割会话） */
  logout(): void
}

/** pinia 实例 → 该实例上 auth store 注册的桥；WeakMap 保证测试间不串用 */
const bridges = new WeakMap<Pinia, AuthBridge>()

/**
 * 由 auth store 在实例化时调用。
 * 没有 active pinia（极少数早期引导阶段）时什么都不做，调用方走 null 分支。
 */
export function registerAuthBridge(pinia: Pinia | undefined, bridge: AuthBridge): void {
  if (!pinia) return
  bridges.set(pinia, bridge)
}

/**
 * 取当前 active pinia 上注册的桥。
 * @returns 未安装 Pinia、或该实例还没创建过 auth store 时返回 null
 */
export function activeAuthBridge(): AuthBridge | null {
  const pinia = getActivePinia()
  if (!pinia) return null
  return bridges.get(pinia) ?? null
}
