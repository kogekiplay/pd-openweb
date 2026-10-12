# Agent 事件总线与接收边界

AgentBus 的开放 topic 继续支持扩展，payload 从 any 改为 unknown；通用总线不声明动态数据属于某个业务模型。useDecodedAgentEvent/subscribeDecodedAgentEvent 用消费方提供的字段解码器收窄载荷，合法 false、0 和空字符串不会被当成无效数据。聊天的打开方案、填入/提交 prompt、ask_reply、卡片修改、文件同步、元信息及搭建请求接收端均已接入；文件引用和修改意见改用明确合同，去掉对应 any 容器。ChatPanel 其它附件、API、SSE 状态及 UI 仍有类型债务，本批不代表整个聊天模块完成。

总线拆成独立纯模块，React Provider 保持稳定实例。取消订阅现在幂等且只删除自身的监听器集合；旧取消函数重复执行不会删掉后来的同名 topic 监听器。保留同步派发、载荷身份、开放 topic、复制监听器快照和单个订阅抛错后继续派发的行为。

移动 OverviewController/Popup 的文件事件、FileMap ref、就绪/可见/内容 setter、侧栏键/计数及滚动 DOM ref 已严格化；移动主页面和匿名入口传播 FileMap。非法路径/内容不会使就绪标记或文本出错，完整 false/null 等 JSON 值会替换旧 parsed；初始数组由 registry 创建独立值，避免共享 producer 数组。正常流式/历史写入和开闭顺序保留。

完整严格诊断 54,586 → 54,519，按文件/错误码新增 0；AgentBus/纯总线/解码器及移动概览核心五开关零诊断，无显式 any 或跨 unknown 断言。strict 债务 3,210 → 3,208，strict-clean 1,539 / 4,747；语义基线收紧为 8,938 条 / 2,405 key。

agentEventBus.spec.ts 运行真实源码的总线、移动 controller、聊天订阅和打开历史方案分支。正常历史 A/B 覆盖 payload 身份、重复 handler、派发快照、嵌套事件、聊天输入/ask/修改/文件/元信息/生成、防重复预检，以及已提交文件先加载再广播 app:meta/mobile 的顺序；旧版反例证明重复取消订阅丢新监听器和移动 falsy JSON 丢值。新增公开类型正反例验证 raw unknown 与 decoder 输出传播，spec 自身五开关零诊断。220/220 规格及工具/语法门禁通过；仍有既有隔离项 PublicWorksheet 微信认证 baseUrl 不支持 subPath。

localhost:30119 使用真实 React StrictMode、Provider/useDecodedAgentEvent、移动 Controller/Popup 与面板验收；PopupWrapper、图标和 Markdown 用展示替身，不请求生产服务或发起真实搭建。已验证最新闭包、非法载荷忽略、连续文件流、方案完成就绪、生成请求只发一次、关闭及卸载后无残留，error 日志为空。截图与观察在 /private/tmp/hap-agent-bus-browser-20261013/，历史对照、完整诊断、门禁证据为 /private/tmp/hap-agent-bus-*20261013。

发布空间准备已完成：主机重复暂存 4d6ff521dd / 91edc6ad87 的 79,146 / 79,104 文件分别逐路径和 SHA256 与容器现网/回滚目录完全一致，无符号链接，目录集合相同。仅删除两个主机 www 副本，发布元数据和容器现网/全部回滚副本保留。可用空间约 19.4 → 38.1 GiB，现网 index SHA256 保持 ea5c9429d16ffb1528d834f546c7781d51962beb33f0c7cdf538651818ff3d1c，五个容器 ID 不变。对照/清理证据在 /private/tmp/hap-duplicate-stages-20261013/ 和 hap-duplicate-stage-cleanup-20261013.log；17:30 前日常发布继续按既有 16:45 起始窗口执行。
