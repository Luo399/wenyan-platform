# 开发环境与数据规范文档

## 1. 文件编码规范（最高优先级）

### 1.1 所有文本文件统一编码

| 文件类型               | 编码格式          | BOM    | 说明                               |
| ---------------------- | ----------------- | ------ | ---------------------------------- |
| .json                  | UTF-8 without BOM | 不允许 | JSON 标准要求，BOM 会导致解析失败  |
| .js/.ts/.vue/.jsx/.tsx | UTF-8             | 可选   | 统一用 UTF-8                       |
| .csv                   | UTF-8 with BOM    | 建议带 | 带 BOM 才能在 Excel 里正确打开中文 |
| .md                    | UTF-8             | 可选   | 项目文档                           |

### 1.2 强制检查清单

- 新建文件时，编辑器右下角确认编码为 UTF-8
- 从 Excel 导出 CSV/JSON 时，选择 UTF-8 编码
- Vite/Webpack 配置里确保静态资源响应头包含 charset=utf-8
- Git 仓库根目录必须有 .editorconfig 文件（内容见下方）

**.editorconfig 模板：**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

## 2. 服务器响应头规范（Vite 开发环境）

### 2.1 JSON 静态资源必须返回正确 Content-Type

确保 Vite 开发服务器对所有 .json 文件返回以下响应头：

```text
Content-Type: application/json; charset=utf-8
```

### 2.2 Vite 配置修复（vite.config.ts）

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    fs: {
      strict: false,
    },
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
      }
      next()
    })
  },
})
```

### 2.3 生产环境（Nginx/Apache/CDN）

部署时同样确保静态 JSON 文件响应头包含 charset=utf-8。

## 3. 前端数据请求规范

### 3.1 所有 JSON 请求必须显式声明编码

❌ 错误做法：直接用 fetch 并假设编码正确

```js
const data = await fetch('/data/words.json').then((r) => r.json())
```

✅ 正确做法：显式指定编码或使用安全解析

```js
// 方案 A：设置请求头
const response = await fetch('/data/words.json', {
  headers: { 'Accept-Charset': 'utf-8' },
})
const data = await response.json()

// 方案 B：显式解码（最安全）
const response = await fetch('/data/words.json')
const buffer = await response.arrayBuffer()
const text = new TextDecoder('utf-8').decode(buffer)
const data = JSON.parse(text)
```

### 3.2 所有数据请求必须有超时和错误兜底

```js
async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    return JSON.parse(new TextDecoder('utf-8').decode(buffer))
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`[超时] 请求超过 ${timeout}ms: ${url}`)
      throw new Error('请求超时')
    }
    throw err
  }
}
```

## 4. JSON 文件生成规范

### 4.1 绝对禁止手动拼接 JSON 字符串

❌ 禁止：

```js
const json = '{"name": "' + value + '"}'
```

✅ 必须：

```js
const json = JSON.stringify({ name: value }, null, 2)
fs.writeFileSync('data.json', json, 'utf-8')
```

### 4.2 写入文件时必须指定编码

```js
fs.writeFileSync('data.json', JSON.stringify(data, null, 2), { encoding: 'utf-8' })
```

### 4.3 Excel MCP 导出规范

- 表名作为组件名，使用 PascalCase
- 列名作为属性名，使用 camelCase
- 所有字符串值中的特殊字符（双引号、反斜杠等）由 JSON.stringify 自动转义
- 输出文件统一存放于 src/data/，命名格式为 {组件名}Data.json

## 5. 组件加载状态规范

### 5.1 四态必处理

每个异步加载数据的组件必须处理以下四种状态：

```vue
<template>
  <div>
    <div v-if="loading">加载中...</div>
    <div v-else-if="error">{{ error }} <button @click="retry">重试</button></div>
    <div v-else-if="!data.length">暂无数据</div>
    <div v-else><!-- 正常渲染 --></div>
  </div>
</template>
```

### 5.2 超时与自动重试

- 默认超时 10 秒
- 失败后自动重试 1 次
- 缓存上次成功数据，请求失败时先用缓存展示

## 6. 常见问题速查

| 现象                 | 可能原因       | 检查项                                           |
| -------------------- | -------------- | ------------------------------------------------ |
| 一直加载/转圈        | JSON 解析失败  | 打开控制台查看报错，检查 JSON 文件编码和格式     |
| 中文乱码             | 编码不匹配     | 确认文件是 UTF-8，服务器响应头包含 charset=utf-8 |
| Expected ',' or '}'  | JSON 非法      | 可能是中文乱码或特殊字符未转义，用显式解码方案   |
| 刷新无反应           | 错误被吞掉     | 确保 catch 块里都调用了 setLoading(false)        |
| Excel 导出后无法加载 | 导出时编码错误 | 导出时选择 UTF-8，不要用默认 ANSI                |

## 7. 给 AI 的快速参考指令

请遵循以下规范：

- 所有 JSON 文件生成使用 JSON.stringify 并指定 utf-8 编码写入。
- 所有 fetch 请求使用 arrayBuffer + TextDecoder('utf-8') 显式解码。
- 每个组件必须处理 loading / error / empty / data 四种状态，并加 10 秒超时。
- Vite 配置确保 JSON 响应头包含 charset=utf-8。
- 在 .editorconfig 和 vite.config.ts 中落实编码配置。

---

**文档版本**: 1.0  
**更新日期**: 2026-05-25  
**适用项目**: wenyan-platform
