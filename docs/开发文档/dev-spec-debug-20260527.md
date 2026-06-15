# 3-响应式循环依赖排查规范

## 1. 问题定义

### 1.1 什么是响应式循环依赖

响应式循环依赖指的是在 Vue 3 组件中，多个 `ref`、`computed` 或 `watch` 之间形成相互依赖的闭环，导致数据更新时触发无限递归更新，最终造成页面卡死或性能严重下降。

### 1.2 典型场景

| 场景 | 表现 | 常见原因 |
|-----|------|---------|
| computed 链过长 | 页面加载缓慢，CPU 占用高 | 多个 computed 相互依赖 |
| watch 触发更新 | 数据反复变化，无法稳定 | watch 回调中修改依赖数据 |
| 组件间数据共享 | 兄弟组件互相监听 | 通过 store 间接形成闭环 |
| 异步更新冲突 | 数据状态不一致 | Promise 回调中修改响应式数据 |

## 2. 排查方法

### 2.1 开发工具检测

**使用 Vue DevTools 进行排查：**

1. 打开 Vue DevTools 的 **Performance** 面板
2. 录制页面交互过程
3. 查找异常的更新循环（Update cycle）
4. 分析 Call Stack 定位问题组件

### 2.2 控制台日志追踪

在可疑的 `computed` 或 `watch` 中添加日志：

```typescript
import { computed } from 'vue'

const processedData = computed(() => {
  console.log('[DEBUG] computed processedData triggered')
  // 处理逻辑...
  return result
})
```

### 2.3 使用 `traceUpdate` 工具函数

```typescript
// src/utils/traceUpdate.ts
export function traceUpdate<T>(refValue: T, name: string): T {
  console.log(`[TRACE] ${name} updated:`, refValue)
  return refValue
}

// 使用示例
const count = ref(0)
const doubled = computed(() => traceUpdate(count.value * 2, 'doubled'))
```

### 2.4 性能监控报警

利用 `perfMonitor` 设置响应式更新超时报警：

```typescript
import { createPerfMonitor } from '@/utils/perfMonitor'

const monitor = createPerfMonitor({
  updateThreshold: 100, // 更新超过 100ms 报警
  cycleLimit: 100       // 循环次数上限
})
```

## 3. 预防措施

### 3.1 数据适配层隔离（推荐）

**核心策略**：在数据获取和组件渲染之间增加数据适配层，将复杂的数据加工逻辑移出组件。

参考《数据与编码规范》第 8 章"数据适配层规范"：

- 将所有数据转换逻辑放在 `src/adapters/` 目录下的纯函数中
- 组件只接收最终数据，不进行任何复杂计算
- 通过 `useDataLoader` 的 `transform` 参数集成适配器

**效果**：组件内不再有复杂的 `computed`，从设计上杜绝响应式循环。

### 3.2 避免在 watch 中修改依赖

```typescript
// ❌ 错误：可能导致循环
watch(count, (newVal) => {
  count.value = newVal + 1 // 直接修改被监听的值
})

// ✅ 正确：修改其他数据或使用条件判断
watch(count, (newVal) => {
  if (newVal < 10) {
    otherData.value = newVal * 2
  }
})
```

### 3.3 拆分过长的 computed 链

```typescript
// ❌ 错误：单一 computed 处理过多逻辑
const finalResult = computed(() => {
  const step1 = processA(rawData.value)
  const step2 = processB(step1)
  const step3 = processC(step2)
  return step3
})

// ✅ 正确：拆分并缓存中间结果
const processedA = computed(() => processA(rawData.value))
const processedB = computed(() => processB(processedA.value))
const finalResult = computed(() => processC(processedB.value))
```

### 3.4 使用 `watchEffect` 的清理机制

```typescript
watchEffect((onCleanup) => {
  const timer = setTimeout(() => {
    // 异步操作
  }, 1000)
  
  onCleanup(() => {
    clearTimeout(timer) // 清理副作用
  })
})
```

### 3.5 组件职责分离

| 组件类型 | 职责 | 禁止操作 |
|---------|------|---------|
| 展示型组件 | 只负责渲染 | 修改响应式状态 |
| 容器型组件 | 数据获取与分发 | 复杂数据加工 |
| 业务组件 | 特定业务逻辑 | 全局状态管理 |

## 4. 修复流程

```
1. 定位问题组件
       ↓
2. 分析依赖关系图
       ↓
3. 判断循环类型（computed链/watch触发/store共享）
       ↓
4. 选择修复策略（适配层/拆分/去耦合）
       ↓
5. 重构代码
       ↓
6. 验证修复效果
```

## 5. 代码审查检查项

| 检查点 | 说明 | 通过标准 |
|-------|------|---------|
| computed 复杂度 | 是否包含循环或递归 | 单步计算，无嵌套循环 |
| watch 副作用 | 是否修改监听目标 | 禁止直接修改监听值 |
| 数据流向 | 是否单向流动 | 数据从父到子，事件从子到父 |
| 状态管理 | 是否集中管理 | 复杂状态应放在 store |

---

**文档版本**: 1.0  
**更新日期**: 2026-05-27  
**适用项目**: wenyan-platform