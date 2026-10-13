# 公式编辑器与函数交付边界严格化

CodeMirror 6 公式编辑器的构造参数、动态模块、DOM/React 标签、补全候选、错误回调、对外 ref、只读/不可聚焦模式和销毁队列已改为有限类型。初始化完成只做语法校验，不再把初始化当成用户修改；实际编辑、补全采纳、字段/函数插入和模式切换才触发修改状态。编辑器 ref 不再复用标题 DOM ref，测试弹窗关闭只回传一次当前内容，销毁时清空待执行动作和定时器并卸载 React 标签根节点。

函数交付入口新增参数边界：Node 对象、JSON 字符串和移动端 Base64 入口共用控制字段/高级设置/选项解码；畸形 payload 返回原有空结果协议，合法字段对象保留引用；语言表、函数描述和动态存储行只在使用处读取已验证属性。子表函数值通过 `getState`/`rows` 方法接收者调用，保留原有行过滤行为，不再把整个 Redux store 假定成某个具体 ABI。

验证：真实 jsdom/React/CodeMirror 页面通过 30 项挂载、标签装饰、错误回调、插入函数、插入字段、补全配置、只读和模式检查；公式标记保留 58 项 CM5 对照；函数交付边界 39 组有效/畸形/语言/对象身份/存储接收者用例通过；224/224 全仓规格通过，唯一保留 PublicWorksheet weixinAuth 的既有隔离失败。严格诊断 53,957 → 53,733，按文件/错误码无新增；目标欠债 3,180 → 3,167，strict-clean 1,586 / 4,753；工具门禁通过。

证据：`/private/tmp/hap-editor-cm6-integration-20261013.log`、`hap-editor-marks-parity-20261013.log`、`hap-editor-full-specs-20261013.log`、`hap-editor-current-diagnostics-20261013.json`、`hap-editor-tools-current-20261013.log`、`hap-editor-fast-final-20261013.log`、`releaseBoundary.spec.ts`。本批整合 main `ec1b4e67c` 已完成真实 release/publish、独立 mdfunction 编译及资源校验，于 16:46 发布并复核人员搜索、UAT 清单及字段配置页。详见 `production-20261013.md`；没有修改生产字段、业务记录或授权。
