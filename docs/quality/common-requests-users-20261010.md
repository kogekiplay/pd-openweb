# 通用请求、上传与人员选择强类型

本批从 `e6c9663dc` 出发，继续全仓 TS 严格化目标。上游最新 `ff5c412a3` 已在当前历史中。没有修改生产环境或发布产品。

## 实际行为和边界

- Token HTTP 原始结果返回 unknown，调用方传入真实解码函数后才返回确定模型。上传凭证只验证实际使用的字段：base64 上传要求 key/uptoken，PDF 查询要求 serverName，表单上传要求四个实际消费字段。未使用元信息保持 unknown；原认证分支、请求载荷、abort receiver 和可枚举请求元信息保留。
- 请求参数保留无查询时原对象身份、重复查询取末项、默认值与查询优先级。推送标识缓存的实际字段从 JSON 解码，扩展元信息保持，reset 可清除坏缓存。Blob 导出、导入预览行/单元格/成员与临时附件使用有限模型。
- 上传请求或凭证校验失败进入真实队列 FAILED/Error 流程，失败文件可移除并重新添加。签名失败恢复保存状态，编辑器上传 Promise 正常拒绝，导入失败通过 finally 结束加载并保留已有数据；没有伪造成功结果。相关实际调用方覆盖正常、坏响应、网络失败和重试。
- 人员选择器的成员、状态、选项、回调、DOM refs 和四类 API 响应使用有限类型。旧查询会取消并拒绝过期结果，卸载取消请求和 debounce，失败结束加载并提供重试；原人员分组、门户当前用户、回调顺序和 searchInput 焦点类保留。已有 module-global wrapAjax 取消所有权保持。
- Mingo 真实共享对象与 emitter 使用有限签名，所有 store 字段可在 clear 后缺失。已知 key/value 由关联 tuple union 约束；未知元信息保持 unknown，坏补丁在 clear 前拒绝。clear 不替换对象或销毁外部 emitter，控件引用和上下文读写保留。相关 AI 私有界面没有被宣称完成严格化。
- 光标工具保留现代 selectionStart 的 null/undefined、旧 IE method receiver、零位置和调用顺序。必要调用方按原 JavaScript 数值/substring 语义处理缺值。后缀与不重名工具、移动记录及统计请求参数补齐准确类型；旧混合值小于比较保留原 ToPrimitive/字符串/数字/BigInt 行为。

## 验证

完整严格 CLI 60339 → 60173，减少 166 条，按文件/错误码新增 0；fast 9514 → 9485，减少 29 条，新增 0。欠债清单 3438 → 3434，只移出 common 与 quickSelectUser 的 index/util/Comps 四个零诊断文件。终点口径达标 1243/4677，新增产品文件默认受管；没有增加豁免或放宽目标配置。common 24 → 0，人员选择核心 23/10/7 → 0。

160/160 行为规格通过；工具类型、语法、后缀、颜色、圆角、排版及 JSX key 门禁通过。既有 PublicWorksheet 微信鉴权子路径 known failure 保持隔离。工具门禁的语义零诊断不等于工具已经启用完整 strict。

实际源码执行及生产 Babel 前后对比覆盖 HTTP wire、查询和缓存、token abort、附件输出、7 个正常上传调用方、人员 normal/portal/range、Mingo store 与上下文读写。光标和后缀 32 个观察相同，混合比较 529 组与原生操作一致。公共类型合法探针主体零诊断；请求 18、人员 10、Mingo 11 和光标 6 类错误载荷拒绝，依赖旧债单独计入。独立只读审查复验上传/签名/编辑器/导入失败链及人员生命周期，没有发现剩余确定的新增回归。

KC PDF 查询原有外层提前 resolve、随后写 URL 的时序保持；本批处理新增拒绝链，不宣称修完该旧时序。有限响应模型来自实际消费者与源码测试，没有宣称完整后端 DTO 或真实浏览器端到端验收。

证据：`/private/tmp/hap-common-completion-release-20261010`、`/private/tmp/hap-quick-user-20261010`、`/private/tmp/hap-common-final-20261010`、`/private/tmp/hap-caret-types-20261010`、`/private/tmp/hap-strong-20261010/common-requests`、`/private/tmp/hap-strong-20261010/mingo-review` 和 `/private/tmp/hap-strong-20261010/cross-review`。

全仓直接严格编译仍有 60,173 条存量诊断；全部 strict 开关、基线/欠债删除及全局开放声明清理尚未完成。
