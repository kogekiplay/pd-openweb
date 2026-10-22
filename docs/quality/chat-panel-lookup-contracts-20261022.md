# ChatPanel 与会话查询合同

基线 `adcbc5776a59302a01f42220a9874d0956d26cfe`。继承键误入 Inbox 的行为修复已独立提交；本批类型传播按源快照 `2f381e371378f9a048835957c6b8042b9c1d3895` 提取 ChatPanel 的有限 props/state，并由 lead 接通真实 API 和所有直接消费点，不整支合并或接收完整源提交。

`getIsInbox(unknown)` 保留原 fresh Lodash 值成员检查并提供有限身份判别。SessionList 的既有 true 分支据此得到实际 InboxType；ChatPanel 的 Redux 输入仍为一般会话，只有在视图边界验证后才交给有限 Inbox props。入口挂载、八种身份/下拉代码和页头的输入不再依赖 any、Record 查表或单键不实断言，缺失下拉值仍原样进入状态/请求。

Chat.GetGroupInfo 使用实际群组 DTO 的有限可选视图，并保留原始 sender ID。普通 JSON 请求返回同一有限、可取消请求；同步/agent/自定义解析等模式为 unknown。`ajax.chatSessionItem` 把实际群组与账号查询收敛成共同的有限读取视图，同时保留未知 type 返回 undefined。首次公开探针发现 Partial 对原必填布尔字段不容纳自有 undefined，已改为显式 mapped fields，原失败保留。

ChatPanel 的 ajax/props/state 不再使用 ApiResult<any> 或组件 any；四个直接消费处对可空结果的读取保留原生失败位置，不加静默默认值或保护分支。ChatWindow 只是完成本端点必要传播，其其他旧债未宣称完成。普通用户/群组分支、同引用、原对象克隆、账号 file-transfer 的原地标记、取消接收者、成功/失败状态、旧响应覆盖、接口参数及 3 秒请求超时保持；测试未发送真实消息或操作真实会话。

7 个完整产品模块去类型 Babel 字节相同；ChatPanel/Inbox/页头的完整产物只在明确列出的身份/自有键检查上变化，移除这些已单列的检查后全文相同。GetGroupInfo 同名函数回嵌后完全相同，真实执行确认 name/length、options/参数/返回对象引用及特殊 SDK 模式。

12 项完整模块规格执行实际 ChatPanel、Inbox、页头、API 包装器、action 和 Redux reducer，已有真实 utils 声明参与消费；网络、宿主、UI 叶子和未被本批断言的入口为受控边界。基线显式历史检查与新实现均通过，默认新回归在旧源码上实际失败；历史模式在新实现上也失败，不能放行当前缺陷。原 JSX key 求值次序夹具失败和缺失宿主字段失败均原位保存。

候选全仓原始 strict **49,459 → 49,439**，Chat **505 → 485**，逐文件/错误码无新增。公开探针实际导入导出类型，非 any/有限键、八种身份、原始 sender ID、可空结果和 SDK 模式正负约束分别检查。最终完整 SHA、正式门禁、候选与逐文件摘要以 `/Users/kogeki/dev/HAP-工作记录/20261022-inbox-identity-contracts/` 证据为准。现网未部署，全仓及其余 Chat 合同目标保持 active。
