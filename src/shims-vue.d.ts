declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // 不写泛型参数：具体 Props/Emits 由各组件自身的 defineComponent 推断，
  // 这里只提供"任意 .vue 文件都能被 import"的兜底声明。
  const component: DefineComponent
  export default component
}
