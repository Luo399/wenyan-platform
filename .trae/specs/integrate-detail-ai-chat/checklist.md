# Checklist

## 功能正确性
- [ ] DetailView 展示课文内容，AI 面板入口可见
- [ ] 未登录时 AI 面板置灰并提示登录
- [ ] 已登录学生可发送消息并收到 AI 回复
- [ ] system prompt 正确注入课文标题、作者、朝代、原文
- [ ] 配额查询 `/api/ai/quota` 返回三档剩余额度
- [ ] 配额用尽时返回 429，不再调用 DeepSeek

## 安全基线（v1 必实现）
- [ ] S1: DeepSeek API key 仅存后端 `.env`，前端 bundle 中无 key 字符串
- [ ] S2: 三层配额（日/周/月）均生效，配额数据能正确累加
- [ ] S3: `/api/ai/chat` 强制 requireAuthMiddleware + requireRole('student')
- [ ] S4: prompt injection 关键词黑名单生效（"忽略之前的提示" 等返回 400）
- [ ] S5: AI 限流同时绑定 student_id（非仅 IP）
- [ ] S6: 单学生并发 >2 时排队/503；全局并发上限 10
- [ ] S7: DeepSeek 429/5xx 返回 502，不计入配额
- [ ] S8: messages 轮数 ≤20、单条 content ≤2000 字符硬限制
- [ ] S12: logger 脱敏：error 堆栈不打印 `*_KEY` / `*_TOKEN`
- [ ] S13: 代理请求仅允许固定 `config.deepseek.baseUrl`，无用户自定义 endpoint
- [ ] S14: AI 回复中 http(s):// 链接用 `<code>` 包裹

## 代码质量
- [ ] lint 全绿（`npm run lint -- --fix` 无新增 error/warning）
- [ ] type-check 全绿
- [ ] 新增文件均有 module.exports（后端 controller/service 不遗漏导出）
- [ ] 新增组件名 ≥2 个单词（AiChatPanel 已满足）
- [ ] 生产构建无 console.log 调试输出

## 测试覆盖
- [ ] 后端 `backend/tests/ai-chat-security.test.js` 覆盖 checklist 中安全场景
- [ ] 未登录 → 401
- [ ] 非 student 角色 → 403
- [ ] 配额用尽 → 429
- [ ] prompt injection 关键词 → 400
- [ ] DeepSeek 上游异常 → 502 且不扣配额
- [ ] 配额原子性：并发调用不会击穿日/周/月上限

## 部署就绪
- [ ] `backend/env.example` 已新增 DEEPSEEK_API_KEY 等占位
- [ ] 生产环境变量由宝塔面板设置，不写入 git
- [ ] init_db 迁移脚本可幂等执行（CREATE TABLE IF NOT EXISTS）
