/**
 * 轻量防抖工具（避免为一个小函数引入 lodash-es）
 *
 * 背景：登录页与 LoginModal 曾各自手写一份实现（签名相同、逻辑逐行一致），
 * 属于重复代码；统一到这里，改一处即可。
 *
 * 返回的函数带 `cancel()`：
 * - 关弹窗 / 提交表单 / 卸载组件时必须 cancel，否则定时器还会在组件销毁后
 *   的回调里 mutate 状态（这是原实现里真实存在的泄漏点）。
 */
export type Debounced<T extends (...args: never[]) => void> = T & {
  /** 取消尚未触发的调用 */
  cancel: () => void
  /** 立即执行尚未触发的调用（没有待执行调用时什么都不做） */
  flush: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingArgs: Parameters<T> | null = null

  const fire = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const args = pendingArgs
    pendingArgs = null
    if (args) fn(...args)
  }

  // 不保留 this 绑定：当前调用方（登录页 / LoginModal）都是闭包，
  // 若将来需要在方法上使用，再按需引入 apply 语义。
  const debounced = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    pendingArgs = args
    timer = setTimeout(fire, waitMs)
  }) as Debounced<T>

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    pendingArgs = null
  }

  debounced.flush = fire

  return debounced
}
