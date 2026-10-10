# 工作表筛选核心和编辑器强类型

本批基于 `fd783ebead69af8960540bfac625bff3674b8bb6`，完成 WorkSheetFilter 的 model、util 全部公开辅助函数、枚举参数、FilterConfig/SingleFilter，以及数值、日期、时间、文本、检查项、选项、人员、级联八个值编辑器的有限类型。条件、保存条件、递归组、编辑 state、Redux action、回调及实际 SDK 合同分别建模；JSON、API 响应和旧组件事件在消费点验证，不使用整 DTO 断言或 any 消除本批源诊断。FormControl 的既有开放 value 在使用点先作为 unknown 检查，全仓 ControlValue 和其他私有组件债务仍待处理。

正常行为保留：不完整编辑条件、数值/字符串/空值范围、日期字符串粒度、动态条件的数字真值判定、原始元数据/数组/对象引用、原地日期更新、reducer 嵌套复制及变更戳、选项序列化、原文本重复 Enter 行为、既有 disabled 转发、动态 getFilter 的 false 中止结果和既有调用方默认分支。FilterConfig 的原始输入成员保持 unknown 并由 origin 模型边界解码，输出保存组的 groupFilters 则准确为必需字段。父级配置、快速筛选、Cascader/Embed 缓存、关联表 state 和表单 flatten helper 只作必要合同传播，不宣称这些大组件剩余私有债务已经清理。

API 失败处理补齐本地化提示、保留已有列表/编辑内容及重试；保存成功响应缺少 ID 时不再假成功。getFilter 的 JSON 语法错误保留原空数组分支，但合法 JSON 的错误结构明确失败，避免当成无筛选请求。保存已经成功后，消费回调或 dispatch 的异常保留原 Promise 错误，并在 finally 中清理编辑状态，不误报服务器保存失败或保留新建草稿造成重复创建。Actions 从实际 state.error 初始化错误投影，React 重新创建 Action 实例后的加载、排序成功重试也能清错；无错误的正常排序保持原来立即排序的一次 dispatch。独立审查发现的两项反例已加入实际 core 规格并通过，原发现与修复前后记录都保留。

按完整五项终点配置的实际 CLI 诊断标题计数，产品严格诊断 57,716→57,306，减少 410 条，按文件/错误码新增 0。13 个本批文件移出 strict 欠债清单，3,388→3,375；strict-clean 为 1,340/4,715。fast 9,250→9,186，只减少 64 条；工具完整严格诊断仍为 2,741，本批新规格和工具合同零新增，常规工具门禁零诊断。没有开启豁免或放宽配置。

最终 193/193 行为规格和全部 10 项门禁通过，保留既有隔离的 PublicWorksheet 微信授权 subPath 已知失败。专项正常对照包括核心 1,816 组生产 Babel 行为、原始引用和 API/reducer 顺序；基础编辑器 430 组实际 ReactDOM/antd/styled-components 对照；选择编辑器 64 组对照及实际 debounce；两个面板 31 组真实组件、reducer、effect 与回调对照；规则可保存判断 78 组、flatten helper 78 组输出与元素身份对照。公共负向类型探针为核心 21、基础编辑器 16、选择编辑器 12、调用方 6、面板/helper 12，全部拒绝，正例均无自身诊断。面板 SSR 对照固定 styled-components 的进程计数 ID，未将这些组件级规格认作真实浏览器或后端端到端验收。

最终统一证据 `/private/tmp/hap-worksheet-filter-chain-20261011/final`；完整冻结和专项证据在 `/private/tmp/hap-filtercore-20261011`、`/private/tmp/hap-primitives-20261011`、`/private/tmp/hap-filter-selection-20261011`。独立审查和反例证据位于 `/private/tmp/hap-filter-core-review-20261011`。较早第一次门禁结果保留在统一证据目录上层，最终修复后门禁与诊断以 final 目录为准。

全仓正式严格开关仍未全部开启；其他筛选 UI、API 生产者、公共开放类型、styled-components 旧 shim 及工具债务继续推进。生产当前仍为 `5cf1a7bbb`，本批未部署；已授权的每日 16:45 开始、17:30 前前端发布任务继续保留。
