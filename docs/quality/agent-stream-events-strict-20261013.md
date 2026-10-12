# Agent SSE 状态翻译层

`src/components/Agent/streamEvents.ts` 的 SSE 事件、消息片段、工作流步骤、工具调用、计划卡、重建确认和文件总线边界已从隐式 any 收敛为开放但有字段合同的 `StreamEvent`、`StreamMessage`、`StreamPart`、步骤/迭代和总线类型。保留后端继续增加事件名和 Pascal/camel 字段的兼容读取；具体字段通过 `readField`/`stringValue` 在边界解码，内部更新使用有限状态和泛型消息返回值，兼容 ChatPanel 的既有 ChatMessage 类型。

行为保持：工具调用按 id upsert，路由/计划/重建卡片幂等，workflow loop/parallel branch 的 running/completed/failed 语义不变，artifact 文件事件继续转发 `file:write`/`file:delta`/`file:end`，历史 pending confirmation 仍挂到最后一条 assistant 消息。`streamEvents.spec.ts` 通过原有历史行为验证；新增类型自身五开关 0 诊断。

strict 终点从 55,256 降到 55,182，单文件移除 74 条 TS7006，按文件/错误码没有新增。全仓 strict 欠债目标仍未完成。
