# Chat 第106笔主审接收与主树整合

接收固定协作源码 `09451802e163b43fe78577e3f9298fa474b7d411` 的准确106笔清单，范围为9个已授权文件。此前独立主审的发送者正负合同、47处真实对象派发、推导State、运行引用/缺项反例、64项真实redux规格及完整Babel/AST证据仍对应这份源码；本次逐个核对9个文件与原隔离源码字节相同，没有无变化重跑旧终点。

在当前主树基准 `232899cb32358eebd798e0819943ccbe532e1754` 的干净独立副本重放106笔成功，再在主树准确重放，得到 `7ffe77d30371f5f373e9fdfacd29e213e80faef3`。主树与新隔离106终点的整棵Git tree均为 `ccd9fb515ec1c09bd9224985f8bdfc0ac793c88a`；它也与上一轮已测“106笔+规则批次”隔离终点 `b2fc5b0f2bf83111bc2cb146ef04abb67ee3d24f` 整棵tree相同。该固定源码已有完整strict原始记录 **50,243**（相对规则基准50,362下降119），私有探针无诊断；原始tsc退出1代表存量问题，不能称全仓strict通过。

本轮实际运行strict收紧与fast基线写入均退出0。strict-debt **3051→3050**，仅移出 `chat/redux/reducers.ts`，strict-clean **1730/4780**；fast **8382→8378 / 2260 keys不变**，逐key没有任何计数上升。两份基线只收紧。完整正式release、资源检查与publish结果见下文；普通push/pre-push的最终结果以共享状态和本轮push证据为准，本记录不预先宣称上线。

本轮另固定审查协作 `c818aebb9456795c033813deac8fa7c0c079ffd4`（第115笔），在自己的干净副本准确追加107至115。完整strict **50,362→49,847**，逐(文件,错误码)上升0，Chat剩849；实际socket19和redux64规格通过。17个受影响产品模块中15个完整Babel相同，另2个精确差异为MessageToolbar局部映射变量与ProjectContacts构造器/重复JSX属性，差异文件已保存；这些数据不是接收结论。

发现阻止接收107至115的合同反例：`Message.send` 直接 `resolve(data)`，成功ack `{id:'m'}`原样返回且无自有`to`；类型却用必须含`to:string`的 `ChatMessageReceiptWire`。独立实际socket宿主证明同引用、`to===undefined`及后续字符串操作抛TypeError；真实导入 `Awaited<ReturnType<typeof Message.send>>` 的探针对该返回形态产生精确TS2741。消费方的Partial断言不能代替原始ack与补入会话id后的Redux receipt边界。另需核实失败回调已知`error`字段仍经标准Promise默认any消费，以及新宽索引的真实opaque依据。具体可行动反馈已写共享DSH目标，未修改其实现/报告，**107及以后尚未接收或整合**。

证据根：`/Users/kogeki/Documents/Codex/2026-10-20/users-kogeki-downloads-hap-10-20/work/chat-lead-115/`，含准确清单、逐源→目标映射、主树tree核对、原始strict日志/逐tuple差分、主审合同与运行反例、Babel全差异、基线前后及实际命令/退出码。第106笔原主审持久证据在 `/Users/kogeki/dev/HAP-交接历史/20261020-Chat-09451802e-主审证据/`。

本次只接收并整合106笔；整个Chat及HAP全仓强类型目标仍active。远端main本轮联网观察为2f199e68f，上游main仍8360adec0a；现网仍4dcca88234，尚未发布本批。每日上海16:45仅发布通过完整验证的新候选，旧索引候选不含规则/Chat，不得冒充当前源码包。

## 正式release与新候选

实际源码/基线revision **a5e93156dd061209b72dffc11c722867a7d1cb20**。第一次正式release行为门禁282/283，BtnTd.spec.ts超过既有30秒后被runner终止；完整原失败日志保留。随后该规格原命令单独 **6.02秒/16项通过**，未改产品、规格、断言或超时。按原命令重跑正式release **283/283**（保留1项原有隔离known-failure）及全部类型门禁、4项编译通过，用时161.37秒。资源验证 **1095 JS / 387 CSS / 3 runtime**，publish退出0。颜色、圆角、排版及jsx-key全部通过，jsx-key扫描5040个文件0缺失/重复。

新完整候选冻结在 `/Users/kogeki/Documents/Codex/2026-10-20/users-kogeki-downloads-hap-10-20/work/chat-lead-115/artifact-a5e93156dd`，包含 **17,098个payload文件和3份元数据**；从压缩包逐一回读核对所有SHA及路径，无symlink/dev资源/重复或越界成员。包 **232,212,642 bytes**，SHA256 `034144185e5aa16dc065a4b5c0385fa348a3dd8e25b2935d32a39af01ebca600`；入口SHA256 `1b201010d1bfc0a6a03ed8b2a6f0f0a3f6327965fd5be44557ff915c9649ad2a`。候选绑定上述源码revision，后续文档HEAD不冒充产物源码；没有上传或部署，11:42只读现网仍4dcca88234。

本轮质量证据和准确映射保存于上述工作目录，持久证据归档目录 `/Users/kogeki/dev/HAP-交接历史/20261020-Chat106整合及115反例主审证据/`。正式pre-push/普通push后核远端完整SHA，写入共享当前状态及该轮证据；若后续接收新源码，必须重新构建验证新候选，不把本包冒充新版本。
