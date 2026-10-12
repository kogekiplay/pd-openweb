# AppBuilder 文件 registry/store

AppBuilder 的文件登记表、文件状态、流式 file 事件和侧栏派生入口已收紧。FileMap、有限侧栏键、idle/streaming/ready 状态和焦点 setter 直接传播到调用方，useFileStore 不再通过 any 断言返回文件或侧栏。JSON parsed 保持 unknown；页面验证数组、元信息字符串和对象字段后再使用。面板、AgentBus 和 Builder 页面其余部分仍有债务，本批不代表整个 AppBuilder 完成严格化。

方案 planGenerationId 只在顶层值完整时参与比较，分片中的半截字符串或数字不再误触发重置；嵌套字段及恰好等于字段名的普通字符串值也不会干扰识别。完整代次变化时，状态机保留当前元信息并清空旧 tab、顺序和焦点，每次 file:begin 至多重置一次；历史 file:write 只建立基线。自定义动作按内层 actions 数量计数，普通 tab 按数组长度计数，各初始状态拥有独立数组。

修正首次推送被语义门禁阻止的两处 unknown 收窄：字符串分支与 null/undefined 分支明确分开，兼容正式宽松配置及五开关严格配置。没有通过扩大基线、增加债务文件或返回 any 消除错误。完整严格诊断 54,742 → 54,671，按文件/错误码新增 0；债务 3,220 → 3,218，strict-clean 1,523 / 4,741。语义基线收紧为 8,942 条 / 2,406 key。

fileStore.spec.ts 覆盖七组 registry 历史 A/B 对照、真实 hook 的事件绑定与 files-sync、连续分片、未知路径及非法载荷、状态快照与初始数组隔离、历史和流式代次、0/数值/转义字符串 ID、侧栏计数及公开类型正反例。核心模型、registry、store、hook 五开关零诊断，spec 自身五开关零诊断；217/217 规格和工具、语法、strict 门禁通过。全仓规格仍含一个既有隔离项：PublicWorksheet 微信认证 baseUrl 不支持 subPath。

localhost:30117 使用真实 React StrictMode、AgentBusProvider 和 useFileStore 验收：历史三 tab、同代次保留、半截代次保留、新代次清空旧内容、同步连续分片、非法事件不破坏状态，以及卸载后重新挂载无残留均通过，浏览器错误日志为空。截图与观察记录保存在 /private/tmp/hap-builder-files-browser-20261013/；诊断对照为 /private/tmp/hap-builder-files-diagnostic-comparison-20261013.json，规格、门禁和行为证据均为 hap-builder-files-*20261013 文件。GitHub 只同步 main，生产候选按既有日常窗口发布。

首次正式 release 的主站编译成功后，node-notifier 的 terminal-notifier 子进程停在操作系统不可中断等待状态，构建停住且没有 release success；该次部分产物不可发布。生产构建改为只输出编译结果及错误，不调用可选桌面通知；开发通知保留。webpackLifecycle.spec.ts 验证生产不调用通知、开发通知失败仍完成、编译/缓存关闭错误正确返回，且 compiler.close 和完成回调各执行一次。原版源码对照确认生产原先确实调用 OS 通知。阻塞日志为 /private/tmp/hap-builder-files-release-first-blocked-20261013.log。
