# Inbox 列表、分派与回复请求合同

基线 `bf4e8cf4a8f30d76c94c8cf7ea77ea64ceb4123a`。独立提取协作快照 `2e128712caae0dbf660890c18bf53efb06cb3b26` 的 Avatar、ReplyTo、Star、UserLink、InboxList 类型及五份定向规格，结合主树已有 payload 合同审查；这是逐路径接收，不代表整笔历史提交或全量 Chat 补丁已接收。

共享有限 `InboxItem` 从 API 响应经 InboxList state 传到 InboxMessage 及消息组件。列表使用真实筛选器合同，取消条目宽索引和 `ApiResult` 的 any 传播；连接后的导出由真实 connect 推导。刷新信号保留 `inboxType: undefined`，实际 action 和 reducer 均接收原值，继续按会话 value 比较。

Post.GetReplyMessage、Discussion.GetDiscussionMsg、Inbox.SetInboxFavorite、Inbox.GetInboxMessage 的普通 JSON 模式分别返回有限、可取消的请求；同步、流式、自定义解析、agent 等特殊 SDK 模式返回 unknown。请求参数、options 和返回对象继续原样转交，保留缺项、数字 ID、null、显式 undefined 及原生字段读取失败。共享 SDK 的其余端点仍有独立旧债。

12 个完整产品模块的去类型 Babel 产物相同。3 个 API 模块在回嵌四个同名函数后完全相同，并实际验证函数 name/length、默认 options、参数与请求引用及同步失败。InboxList 的明确差异为：分开原类与连接后导出、把响应解构移到回调首句、显式返回原有 undefined、用 Reflect.get 执行相同原生键读取。归一这五处后 AST 相同；完整基线/候选规格验证接收者、继承键、getter、翻译顺序、原生失败和引用。

11 项新增完整模块检查执行真实 API 包装器、ReplyTo、Star、InboxList、分派器、action、Redux reducer；仅传输和 UI 叶子等宿主边界受控。覆盖分页、缺失键、读取短路、取消、缺失正文、畸形响应和既有旧请求覆盖新结果。基线与候选均通过。五份协作规格通过。实际导出的正负/非 any 探针自身零诊断；其依赖程序有 25,415 条既有 strict 诊断、实际退出 1，不宣称完整程序零诊断。工具门禁通过。

全仓原始 strict **49,491 → 49,470**，Chat **536 → 515**，逐文件/错误码新增 0。保留初次未使用导入、工具测试类型、审计脚本语法与探针导入/负例注释位置失败及修正后的独立日志。未修改 baseline、tsconfig、30 秒上限、并发 4、断言或失败隔离。

完整证据目录：`/Users/kogeki/dev/HAP-工作记录/20261022-inbox-routing-requests/`。最终源码绑定、正式 pre-push、release、资产检查、候选冻结与回滚准备以该目录的实际命令、退出码、源码 SHA 和逐文件摘要为准。现网回读仍为 `4dcca88234a8b49a743bdb39b0fd8fd437d7914a`；本批不包含门户刷新修复或生产部署。测试账号登录和应用直接重开已正常；另确认的头像抽屉定位修复独立记录于 portal-avatar-drawer-20261022.md。
