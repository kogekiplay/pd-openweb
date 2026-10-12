# Chat Redux 会话 action 边界

聊天 Redux action 的首组动态入口已收紧：会话列表设置/追加/更新、删除与添加会话、群组/个人/系统会话、窗口同步、置顶、清除未读和当前会话 id 的外部 payload 与集合回调都明确了边界。保留服务端消息 payload 的动态字段协议，避免把业务事件误转成过窄的领域模型；store 中的会话项在变更前继续使用已有 clone/拷贝语义。

本批移除 `src/pages/chat/redux/actions.ts` 33 条严格诊断，按文件/错误码没有新增。后续继续处理消息生命周期与 socket 事件 action。
