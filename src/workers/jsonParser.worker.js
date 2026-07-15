/**
 * jsonParser.worker.js - JSON 解析 Worker
 *
 * 功能：在 Worker 线程中进行 JSON 解析，避免阻塞主线程
 * 使用方式：
 *   const worker = new Worker(new URL('./jsonParser.worker.js', import.meta.url))
 *   worker.postMessage({ text: jsonString })
 *   worker.onmessage = (e) => { ... }
 */

self.onmessage = function (e) {
  const { text, id } = e.data

  if (!text || typeof text !== 'string') {
    self.postMessage({
      id,
      success: false,
      error: '无效的文本数据',
    })
    return
  }

  try {
    // 在 Worker 线程中进行 JSON 解析，不阻塞主线程
    const parsed = JSON.parse(text)

    self.postMessage({
      id,
      success: true,
      data: parsed,
    })
  } catch (err) {
    self.postMessage({
      id,
      success: false,
      error: err instanceof Error ? err.message : 'JSON 解析失败',
    })
  }
}
