# 动态统计时间范围的字段修复与局部合同

基线：`be7270565670179760dca4fed8cc82ca0aac5640`。本批为 lead 独立实现，未接收 DSH 的擦除类型切片。

TimeModal 的结束数量失焦原来写入 `startCount`：结束输入 12 会把开始数量 2 改成 12，结束数量仍旧；清空结束输入也会把开始数量改成 0。现在仅将 `endCount` 转为数字或 0，保持原有保存时机。

FilterScope 的两个数量输入原来没有接收事件参数，读取全局 `event`；没有该全局时直接抛错。现在读取该次输入的事件。结束类型原来更新 `startUnit`，现在更新 `endUnit`；自然时间类型使用相应单位，相对时间类型保留原结束单位，开始侧不被修改。

共享 `DynamicFilter` 从实际输入和显示消费建模：数量在输入中为字符串，失焦后可为数字；六个已知字段允许原本支持的缺项和自有 undefined。两个组件的更新参数使用这个有限键模型，八个 Select 回调使用数字选项类型。`formatrChartTimeText` 复用同一模型，未引入第二份 DTO、宽索引、any 或断言。

## 验证

- 新正式规格执行完整 TimeModal/FilterScope 模块，使用实际数字格式器和时间文本格式器。旧源码产生 6 项失败；候选 12 项检查通过。UI 叶节点、React 的同步测试状态提交及请求传输为明确 fixture，不称浏览器或全应用 E2E。
- 规格运行实际 `changeCurrentReport`、完整 statistics reducers 和 `getReportSingleCacheId` 映射，核对最终请求动态对象与状态同引用，以及开始/结束单位没有串写；没有调用真实服务或业务记录。
- 对照覆盖空输入、字符串小数、事件 getter 次数、动态对象复制、扩展值引用、键顺序、自有 undefined、原对象不变和原始 getter 异常身份。FilterScope 继续即时保存，TimeModal 继续等待确认。
- 完整 Babel 比较证明：除了上述结束数量、事件参数、结束单位的明确修复，其它发射代码相同；timeUtils 完整发射相同。两个组件各自原有的两处 props/state any 保留为欠债，新增 any/断言/抑制均为 0。
- 实际公开模型和 formatter 的类型探针：5 个合法值、实际消费者调用、5 个拒绝例和 4 个非 any/有限键约束，自身诊断 0；传递依赖 1,202 条，实际命令退出 1，不能称整个依赖图通过。
- 全仓 raw strict **48,524 → 48,516**，Chat 265 不变；逐 `(文件,错误码)` 新增 0。TimeModal **5 → 4**，FilterScope **36 → 29**。raw 实际退出 1；没有改 baseline、strict-debt、tsconfig、原规格断言、30 秒或并发 4。

证据目录：`/Users/kogeki/dev/HAP-工作记录/20261024-dynamic-time-filter`。`before-dynamic.log` 保留旧失败；`after-dynamic.log`、`public-types-result.json`、`strict-compare.json`、`emission-audit.json` 记录候选结果。最终完整源码身份、普通 push、正式 release、候选冻结以该目录后续终态收据为准。

本批没有宣称两个组件的 props/state、RangePicker 或全仓合同完成。有限模型只约束本批真实动态更新和文本消费；旧继承 any 的其它路径继续欠债。生产仍是已由用户确认的 7.5.2 / `908c1d92bbbe32ad5c14fe965ac839c50543b5e3`，本批无生产操作。
