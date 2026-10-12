# 经典日历与范围选择链路

经典 Calendar/CalendarRange、DatePicker/RangePicker、泛型 Picker/DateDropdDown、日期表格、年月表格和 header 使用共享有限合同。移除 15 个旧文件里的 Component<any, any>、隐式参数及 CalendarPart/DateTable 的开放透传字典；TaskHeader 的空状态 any 也移除。单日值为 Moment/null/undefined，范围限制为最多两项，原始 CalendarRange 输入允许 MomentInput 并在初始化及 props 更新时归一化；公开输出为 Moment 范围，半天为 AM/PM，来源、视图、方向、样式和事件/ref 有限化。默认导出仍连接 NewDateTimePicker，现代日期时间链路与全仓目标待继续完成。

Picker 用泛型元组保存日历回调的完整参数和 this，不吞掉 range 的第三个半天参数；菜单值使用泛型保留对象身份与 customDate 分支，禁用项阻止选择。DOM ref 经过既有节点验证，React clone 的 ref 不返回节点；CalendarRange 的日期锚点固定为两个 Moment，缺省/defaultValue/受控锚点和空选择分开处理，props 更新继续归一化日期字符串与时间戳 0。空白字符串和无效日期归一化为空选择，锚点保持有效，避免空字符串生成 NaN 日历；规格覆盖空字符串与 NaN。未添加整包断言或 any 缺省值。

修复切换年月修改调用方 Moment、初始 selectedValue:null 被当成已选择、YearTable 缺省 page 显示 0..15、范围非受控选择被静态 selectedValue 缺省值阻断、修改传入半天数组及半天 props 不同步。RangeFooter 的下拉改为受控值，实际 Dropdown 实例能同步外部更新；选择/清除、任务模式记忆值和 9/18 点规则保留。Dropdown 只向 Icon 传递 hint，移除向 DOM 泄漏的重复 iconHint。

真实浏览器发现 React 在 body 原生关闭监听器之前替换年月列表，旧目标节点已离开弹层，原父链判断错误关闭面板。PositionContainer 根据事件原始 composedPath 识别点击来自弹层；节点父链作为既有回退，外部点击和例外节点规则继续保留。实际源码回归覆盖点击节点已移除但原路径仍在弹层、以及外部路径的关闭。

`CALENDAR_BEFORE_REV=80fefdba0 node src/ming-ui/components/DatePicker/Calendar.spec.ts` 验证 15 组正常渲染历史对照，空值初始化的旧版反例、冻结传入值、42 格日期/禁用日期、年月缺省页、受控与非受控选择、任务开关记忆、半天归属与外部同步、字符串/epoch 更新、范围先后校验、默认/受控锚点、this/参数回调协议和不转换的泛型菜单值。真实产品 strict 配置编译公开 JSX 正反例，拒绝单日字符串、三项范围、错误半天、非 Moment 表格锚点及不能处理清除/自定义菜单的回调。新增规格与 PositionContainer 规格自身五开关 0 诊断；既有 TimePicker 渲染测试按 Dropdown 已有受控合同同时处理 value/defaultValue。

localhost 30115 使用真实 React 19、jQuery 4、Calendar、RangePicker、Dropdown、PositionContainer 和独立冻结测试数据：单日选择/确认、2027 年选择、2 月选择后面板保持打开、清除关闭；外部半天更新 PM/AM 后已有下拉实例同步，用户选择 AM 后变为 AM/AM 且只有一次回调；初始空日期首次打开的 selected-date 数为 0。最终没有新的 console error/warn，不写生产记录。证据 `/private/tmp/hap-calendar-browser-20261012/observations.json`、`verification.png` 和 `empty-verification.png`。

完整终点诊断 56,097 → 55,833，按文件/错误码新增 0；欠债 3,251 → 3,239，strict-clean 1,498 / 4,737（31.6%）。语义基线 9,016 → 9,000，唯一 key 2,437 → 2,432，仅删除已消失诊断；同时核对宽松与 strict 配置的 null/undefined 收窄差异。215/215 完整规格、工具、语法和 strict 欠债门禁通过，PublicWorksheet weixinAuth 既有隔离项继续保留。全仓严格化和现代日期链路仍未完成。

证据 `/private/tmp/hap-calendar-before-strict-20261012.txt`、`hap-calendar-final-strict-20261012.txt`、`hap-calendar-diagnostic-comparison-20261012.json`、`hap-calendar-behavior-20261012.json`、`hap-calendar-position-behavior-20261012.json`、`hap-calendar-tools-strict-20261012.txt`、`hap-calendar-specs-final-20261012.log`、`hap-calendar-stats-20261012.log`、`hap-calendar-debt-shrink-20261012.log`、`hap-calendar-baseline-20261012.log`。本批 10 月 12 日开始、13 日完成，作为 13 日日常发布候选准备；现网仍为已验证的自动编号热修复 `4d6ff521d`。GitHub 只同步 main，本地工作分支保留。
