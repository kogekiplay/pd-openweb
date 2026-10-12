# 现代日期时间与时间菜单链路

NewTimePicker、TimeMenu/List、现代 Calendar、DatePickerBase、DateTimePicker、DateTimeRangePicker、外层 DateTime/DateTimeRange 已使用有限的日期/时间/范围合同，移除目录内的 Component<any, any> 和隐式参数。公共出口公开 `DateTimeProps`、`DateTimeRangeProps`、`ClockTime`、`TimeMode` 与范围回调类型；日期值支持 MomentInput 输入并在边界归一化为有效 Date/Moment，空字符串、NaN 和 null 不生成无效日期。保留现有 `hour`/`minute`/`second` 精度、`date`/`month`/`year`/`datetime`/`task`/`half` 模式以及 task 的部分端点协议。

修复小时确认没有清零分钟/秒、时间上限下限未沿日期变化传递、时间菜单缺少 current 项时解构崩溃、工作流时间组件卸载后监听器残留、跨午夜自动补全只更新显示但不更新结束值、Range 清空仍回传旧日期、受控 props 更新覆盖正在编辑的半天/部分端点，以及外层 `format`、`disabledDate`、`locale`、`separator`、`offset` 和 disabled/ref 边界被吞掉。范围自动补全按真实日期推进，`23:45 + 2h` 显示和回传为次日 `01:45`；确认回调先发 `onChange` 再发 `onOk`，清空发空值并调用 `onClear`。

`MODERN_DATE_BEFORE_REV=e7ddcf892 node src/ming-ui/components/NewDateTimePicker/date-time-range-picker/index.spec.ts` 使用实际源码、Moment、React SSR 和受控夹具，覆盖 14 组渲染历史对照、日历边界/闰年、时间上下限和整点舍入、范围清空、跨午夜自动补全、部分端点与 props 编辑、回调顺序、工作流时钟监听器、缺少 current 项、视图/可见状态、公开 JSX 正反例及既有 timePickerGroups 样式检查。新增三个实际任务日期回调的回归，保证空端点保持空字符串、合法端点按原格式保存、不修改 Moment 输入。

localhost 30116 使用真实 Calendar、DateTime、DateTimeRange、RangePicker、TimePicker、PositionContainer 与独立状态验收：小时模式确认后显示 `09:00:00`；开始 `22:45` 改为 `23:45` 时结束自动为次日 `01:45`，显示和范围回调一致；范围清空返回 null；禁用设置 `aria-disabled=true` 并阻止打开；最终 console error/warn 为空。证据 `/private/tmp/hap-modern-date-browser-20261013/observations.json` 与 `verification.png`。

完整终点诊断 55,833 → 55,256，按文件/错误码新增 0；欠债 3,239 → 3,225，strict-clean 1,514 / 4,739（31.9%）。语义基线 9,000 → 8,971，key 2,432 → 2,414，仅收紧已消失诊断。215/215 完整规格、strict 欠债、语法、工具门禁通过；工具 strict 配置仍包含既有工具链诊断，新增规格自身五开关为 0。全仓严格化尚未完成。

本批尚未发布；现网仍为自动编号热修复 `4d6ff521d`，今天日常发布窗口尚未开始。后续候选必须再通过真实 release、publish、runtime 资源校验后才进入生产。
