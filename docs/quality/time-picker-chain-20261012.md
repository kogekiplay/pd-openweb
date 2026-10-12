# 经典时间选择与日期页脚链路

TimePicker、Panel、PanelSelect、SelectItem、scrollTo 和日期 CalendarFooter/RangeFooter 移除 Component<any, any> 与隐式参数，使用有限时间单位、Moment/null/undefined 值、数字禁用列表、回调、原生事件、DOM/ref、定位矩形和 locale 合同。公开 JSX 正反例验证清除的 null 值、数字 formatter、真实触发元素和 nullable 父容器。保留原始受控判断（包括显式 value:undefined）、默认值只初始化、选项 formatter 的 Array.map 数字值/索引/数组协议、disabledSeconds 接收 minute 的既有协议，以及任务模式清除后 9 点/18 点默认值。

自定义小时标签不再按标签文本寻找选中项，而按实际小时/分钟/秒索引高亮；选择克隆调用方 Moment。禁用时阻止变更、清除与打开，切换禁用关闭已有面板；卸载删除原监听器。选择项使用 currentTarget 的偏移，取消前一个滚动任务并在卸载时清理，保留原十毫秒步长与 RAF 缺省时的定时器回退。

真实浏览器发现首次打开的点击继续冒泡到新注册的 PositionContainer body 监听器，面板立即关闭。经典 TimePicker、DatePicker Picker/DateDropdDown 和 NewDateTimePicker date-time/date-time-range 均传入触发节点作为点击例外。Picker/DateDropdDown 的 ref 通过共享 DOM 边界验证，缺失 ref 或禁用时不再打开；这些外围日期类仍有存量强类型债务，本批没有将整套日期组件宣告完成。NewTimePicker 等其余链路也仍待处理。

`TIME_PICKER_BEFORE_REV=710178bd9 node src/ming-ui/components/TimePicker/TimePicker.spec.ts` 使用实际源码、Moment、React 和 locale，验证 7 个 picker、4 个 panel、6 个 footer 正常渲染历史对照，受控/非受控/清除、数字 formatter 与高亮、不变性、任务默认值、禁用、当前点击元素偏移、动画取消/回退/卸载以及公开类型正反例。实际 TimePicker/Picker/DateDropdDown 的渲染 props 交给真实 PositionContainer.destroy，验证触发子元素不关闭、外部关闭与空 ref；旧版生产者重现首次打开立即关闭。新增规格自身五开关 0 诊断。历史对照中的 readOnly 字符串告警来自旧源码，当前使用布尔值。

localhost 30114 使用当前真实组件、React 19、jQuery 4 和独立测试状态验收：第一次点击保持面板打开；09:12:34 选择 10 点成为 10:12:34 且回调一次；清除成为 null；外部设为 11 点同步高亮；禁用关闭且阻止重开；按钮子元素首次点击和外部关闭成功。日期 Picker 的真实 DOM 触发与关闭也通过；最终轮次没有新的 console error/warn。日期内容使用独立 React 测试组件，不写生产记录。证据 `/private/tmp/hap-timepicker-browser-20261012/observations.json` 与 `verification.png`。

完整产品终点诊断 56,223 → 56,097，按文件/错误码新增 0；欠债 3,258 → 3,251，strict-clean 1,485 / 4,736（31.4%），七个完成的旧文件移出清单。基础语义 9,041 → 9,016，唯一 key 2,447 → 2,437；基线只收紧。214/214 完整规格、工具与语法门禁通过，保留 PublicWorksheet weixinAuth 既有隔离项。全仓 strict 尚未完成。

证据 `/private/tmp/hap-timepicker-before-strict-20261012.txt`、`hap-timepicker-final-strict-20261012.txt`、`hap-timepicker-diagnostic-comparison-20261012.json`、`hap-timepicker-behavior-20261012.json`、`hap-timepicker-tools-strict-20261012.txt`、`hap-timepicker-specs-final-20261012.log`、`hap-timepicker-tools-20261012.log`、`hap-timepicker-stats-20261012.log` 和 `hap-timepicker-baseline-final-20261012.log`。

本批准备作为下一次日常发布候选；现网仍为已验证的自动编号热修复 `4d6ff521d`，10 月 12 日常发布在 16:41 已完成。本地工作分支保留，GitHub 仅同步 main；不修改生产字段配置、编号序列或业务记录。
