# 人员弹窗、甘特图与公共客户端类型

本批从 `db2df3dd7` 出发，继续全仓 TS 强类型与严格化目标。上游最新 `ff5c412a3` 已包含。应用更新暂停后，53 个源码和规格文件的哈希与最终验证快照一致。没有修改生产环境。

## 最终实现

- GeneralSelect 的成员、部门、群组成员、页签动作、选择结果、公共设置与状态使用有限类型和判别联合。联系人及分页响应的合法对象、成员列表、元信息引用和 own keys 保留；缺省列表仅在原有空列表分支处理。坏响应和稀疏数组进入失败流程，过期请求和卸载后的结果无法发布，搜索取消、真实失败端点重试及 React 19 同实例重挂载均有实际规格。wrapper 的有效路径始终要求至少一个用户，回调保留原非空数组引用。常协作管理的错误提示在两种页签都可见。
- ScrollView 导出实际产生的三个 handle 方法，两个 ref 消费方按真实 handle 使用。其私有 props/options 的宽松类型仍待处理，不将零诊断称为整个组件完全强类型。
- Gantt 工具的任务、日期轴、工作时段、坐标、位移和树节点使用有限模型。未知输入只验证所消费的字段，扩展元信息保留 unknown。Moment valueOf、InvalidDate/NaN、parseInt 的科学计数法转换、原地修改、普通行克隆、拖拽项与循环元信息的引用保留。必要的 scrollLeft 缺值只在原数值运算处处理。
- QuickSelectUser 的完整样式模块改用安装包 styled-components 6.5.3 的真实声明，六个样式的 DOM props 和插值受检。阶段入口 `typedStyled.ts` 只导出同一运行包的原始值，浏览器构建、5 个导出身份及真实 SSR HTML/CSS 验证通过。旧全局 shim 尚未删除，仍有 1584 个生产模块需迁移。
- 时间显示、服务地址和提示消息使用实际有限签名；翻译字典的值为 unknown，主入口使用前验证文本，嵌入入口保留原 String 转换。提示消息保留顶层 React 元素、配置对象的文本转换、显式 undefined own fields、PC 与移动返回行为；全局 alert 保留原生/嵌入入口共用的 void 协议，直接 antAlert 仍返回实际移动 Toast controller。
- ApiResult/ApiResultOf 和 ApiOptions 的额外元信息改为 unknown，abort 明确声明；旧 request.state 调用先检查真实函数并保留 receiver。泛化 API resolve payload 的 any 仍是存量欠债。本批同步模板权限响应单独解码，创建、effect 和保存都处理失败：保留原数据，阻止错误保存并提供真实重试，不伪造成功空结果。

## 验证与边界

完整终点严格 CLI 60173 → 59443，减少 730 条，按文件/错误码新增 0；fast 9485 → 9442，减少 43 条。欠债清单 3434 → 3418，只移出 16 个达标文件；终点口径零诊断文件 1267/4685。GeneralSelect 与 wrapper 的 457 条旧诊断、Gantt 工具的 168 条旧诊断清零。类型配置未放宽，基线没有新增项。

165/165 行为规格通过；工具类型、语法、严格欠债、fast、后缀、颜色、圆角、排版与 JSX key 全部门禁通过。既有 PublicWorksheet 微信鉴权子路径 known failure 保持隔离。新增规格另按工具终点严格 flags 检查，无该批新增规格诊断；已有工具程序仍有严格欠债，未宣称工具全 strict。

源码提交 `c3ed8504f` 的本地生产构建通过，用时 57 秒。构建结束没有额外源码改动；3 个 runtime 的资源校验通过（1095 JS、387 CSS），未部署或对外发布。

生产 Babel 对比通过：Gantt 1008 组；GeneralSelect 请求、分页、群组成员、部门、回调和引用，以及 8 个真实消费方法；全部 6 个样式的 SSR HTML/CSS。公共翻译/时间/提示消息 24/88/354 个观察及嵌入翻译、同步权限、Promise receiver 和 PreferenceTime 对比一致。公共错误类型探针包括 Gantt 15、人员 10、样式 10、客户端 12 个拒绝案例，合法探针主体零诊断，导入依赖的旧债单独保留。

独立只读审查发现的搜索竞态、同部门旧失败覆盖成功、权限解码失败缺本地处理已闭合，真实失败按钮与重试规格通过。较早部门树“永久重试失败”判断已撤回，因为父层加载会卸载并重建子树；最终验证覆盖实际失败端点。

GeneralSelect 历史 group-only 不完整入口、离职分页、同上下文设置快照及并发成功树快照语义保留，没有新增未定义的群组选择功能。相邻 dialogSelectDept、私有界面、完整 API payload 与全局开放声明仍待收紧。没有真实后端或完整浏览器端到端验收声明。

证据位于 `/private/tmp/hap-general-gantt-client-release-20261010`、`/private/tmp/hap-general-select-20261010`、`/private/tmp/hap-gantt-20261010`、`/private/tmp/hap-global-client-20261010`、`/private/tmp/hap-strong-20261010/styled-real` 和 `/private/tmp/hap-readonly-review-20261010`。全仓直接严格编译仍有 59,443 条存量诊断，完整 strict 配置、基线/欠债归零及替代声明删除尚未完成。
