# 会话列表二次格式化的有限输入合同

切换会话列表显示方式时，SessionList 原本把 store 中的 ChatSession[] 整组断言为 ChatRawSessionWire[]，再调用 setSessionList。两种结构的附件元数据并不相同；断言掩盖了真实生产方。

新增 ChatSessionFormatInput = ChatRawSessionWire | ChatSession，沿 setSessionList、formatSessionList 和 formatSession 传递；组件直接提交现有列表。四个完整产品模块的 Babel 输出与基准 4d55a49021a42a6f6743548dd91f9146988e80a4 逐字节相同。保留第二次格式化的原地变更、排序、对象引用和原生失败。

新增真实生命周期→真实 thunk→真实格式化/排序的规格，覆盖原行及附件引用、原有重复格式化、显示方式不变时不重做、混合原始/已格式化输入及缺消息体的原生 TypeError。实际导出类型的正负探针支持两种输入，拒绝数值会话id/非法type，并证明已格式化对象不能伪称原始wire。

完整 strict 原始诊断仍为49,870，逐(文件,错误码)无新增、无减少；工具链类型门禁0诊断。本片修正合同精度，不用诊断下降替代正确性。

证据目录：/Users/kogeki/dev/HAP-工作记录/20261021-session-input-contract/。其中也保留协作稳定5a5dd3f7的Ajax参数回退反例（TS2344及两条TS2578），该反例已通过共享文件交接；它不属于本片产品改动，也不把协作全量补丁当已接收。
