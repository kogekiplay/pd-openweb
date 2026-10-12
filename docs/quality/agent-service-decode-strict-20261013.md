# Agent service 响应解码入口

Agent service 的基础响应边界已收紧：记录判别、大小写不敏感字段读取、字符串/未知值摘要、列表外壳解析、JSON 字段解析和 artifact 历史引用读取都明确接收 `unknown`，内部只在解码点转换。后端 Pascal/camel 字段兼容与历史 artifact 选择顺序保持，网络请求函数和 ChatPanel 业务分支留待后续单独批次。

本批移除 `agentService.ts` 12 条 TS7006/TS7023 诊断，按文件/错误码没有新增；无独立行为规格的纯解码函数使用现有 Agent 历史行为门禁验证。全仓 strict 目标继续。
