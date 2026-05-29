---
name: "fix-cors"
description: "当出现CORS（跨域资源共享）错误时,帮你修复"
---

分析和修复CORS（跨域资源共享）错误。请执行以下步骤：

1. 检查 `backend/server.js` 文件，确认已正确引入和配置 `cors` 中间件。确保有 `app.use(cors());`。
2. 检查前端发送 `fetch` 请求的URL是否正确指向了后端地址。
3. 如果问题依然存在，提供更详细的修复方案或建议。

