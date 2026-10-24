# Statistics 时间范围选项与更新载荷合同

基线源码为 `908c1d92bbbe32ad5c14fe965ac839c50543b5e3`。本次仅收紧
`TimeModal.tsx` 的范围选项、Select 值和范围更新载荷，不代表整个组件已完成严格化。

`dropdownScopeData` 生产数字选项，`pastAndFutureData` 生产过去/将来的字符串预设。
合并表按这两份真实生产来源的元素联合建模，保留 cloneDeep、过滤和 splice 的原顺序。
Select 使用该值联合；更新对象允许数字/字符串 rangeType，以及构造期间可缺省、随后由原分支写入的
数字、字符串或 null rangeValue。没有新增 any、宽索引或类型断言，完整组件 Babel 输出逐字节相同。

独立行为验证加载实际完整 TimeModal、实际 timeUtils/controlUtils 和父 DataSource 的实际
onChangeFilter 消费表达式。旧源码和候选各通过十组数字范围、过去/将来预设、指定日期、财政年度选择：
27 个选项及插入顺序不变，更新对象键顺序不变，确认后才提交并关闭，父级合并保留其它字段、getter
调用次数和 dynamicFilter 引用，原生产选项表不被修改。UI 叶节点为测试宿主，不把这些检查称为浏览器端到端验收。

直接导入实际导出类型的探针包含七组正例、五组反例及七项非 any/有限键断言，探针自身诊断为零。
其传递依赖仍有 1,207 条存量诊断，编译器实际退出 1，未冒称整个导入图通过。
全仓原始 strict 实际退出 1，48,529→48,524，逐 `(文件,错误码)` 新增零；仅本文件减少
TS2345 一条、TS2339 四条。组件仍有五条原诊断，原 `Component<any, any>` 等欠债保留。
没有改 baseline、strict-debt、tsconfig、30 秒上限、并发数或原规格断言。

协作提交 `e10afbd6423b2974d7d30f2a881c513120e73bc5` 没有被接收：它把本文件的显式 any
从 2 处增至 10 处，并新增 3 处断言，包括整个 RangePicker value 和 date 的擦除。本次 lead 实现
仍为原有 2 处 any、零断言，不计作该协作提交的整笔或部分接收。日期选择器输入、清空事件、组件
props/state 和动态过滤器合同仍需单独处理。

固定证据：`/Users/kogeki/dev/HAP-工作记录/20261024-time-scope-contract/`。
其中 `review.json`、`erasure-audit.json`、`behavior.json`、`public-types-result.json`、
`strict-compare.json` 和各实际命令/退出码保留；独立宿主最初的工作目录、顶层 this 与探针路径解析
错误及修正也保留。最终提交绑定、正式 pre-push/release 和候选冻结以该目录终态记录为准。
