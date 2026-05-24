---
name: fix-api-error
description: 当用户报告 API 错误或请求帮助调试后端接口时
---

---
name: api-error-fixer
description: 诊断并解决与后端 API 交互时出现的错误，如 CORS 问题、数据库连接错误或请求格式不正确。
---

# API 错误修复器
此技能用于分析和解决 `wenyan-platform` 项目中 API 相关的错误。

## 指令

1.  **检查请求**：检查前端 `fetch` 请求的 URL、方法和 Headers 是否正确。
2.  **检查响应**：分析后端返回的错误状态码和消息。
3.  **检查后端代码**：必要时检查 `backend/server.js`，查看相应的 API 路由和数据库查询是否存在问题。
4.  **提出解决方案**：提供清晰的、分步骤的修复方案，并解释错误原因。