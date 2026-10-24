# 个人状态日期的真实事件合同与修复

基线：`e0fdd59e01339d2c6f03f628d14a4bd333a5caad`。

两个已复现问题：

- 自定义日期组件允许清除，但旧 `onChange` 直接解构日期参数；实际 Ant Design 清除按钮会传入 `null`，导致原生 TypeError。现在清空组件内部的两个端点，不把未确认的空值提交为个人状态。
- 将自定义时段改为固定时长时，父级从不存在的 `obj.startDate` 回填 `beginTime`，丢失原来的开始时间。现在保留实际 API 模型中的 `obj.beginTime`，结束时间和既有深拷贝方式保持。

日期组件的 props 复用生成的 `PStatusOption` 日期和时长字段。`CustomDateChange` 区分“固定时长”与“已确认的完整 Moment 日期对”，清除只改变本地状态。Select 的日期文本只是显示值，不能作为时长交付；数字选项仍按原来的顺序和载荷处理。

`StyledRangePicker` 显式采用真实 Moment picker 的 props，避免旧 styled 声明的 any 吞掉事件类型。仅 `getPopupContainer` 如实补充尚未挂载时的 null 返回：安装的 `@rc-component/portal/lib/Portal.js` 对 null 使用默认容器，真实组件和规格均已验证该路径；没有用非空断言伪装已挂载。公开类型直接引用已命名的 `DatePicker` 导出，避免暴露嵌套 picker 私有类型。

## 证据

- Chromium 149、实际 React/Ant Design/Moment picker/Trigger/styled-components：旧源码同时出现开始时间丢失和真实清除按钮的 null 解构异常；候选两项通过、零 pageerror。父级回调取真实源码，Icon/翻译为 fixture；日期对经实际回调预置后点击真实 SDK 清除按钮，不称完整应用 E2E。
- 新正式 `statusDates.spec.ts` 执行完整日期组件和真实父级回调，12 项通过，涵盖清除/确认/逆序/不完整日期、Moment 引用、取消提交、全部实际数字选项、语言缺省、暂未挂载的容器、日期格式器、原生 undefined 失败、不可变原状态及固定时长回填。旧源码有 3 项失败，其中显示文本直接调用是额外非法输入检查，不声称真实选项会产生该值。
- 完整 Babel 对照：配置和日期格式器发射相同；组件/父级仅有已列明的清除、标签保护、等价数字语言分支和开始时间回填变化。无新增 any、宽索引、非空/类型断言或抑制。实际 checker 检查日期组件和格式器 15 个参数，顶层 any 为 0；公开真实导出的正负约束自身 0 诊断，传递依赖 1,192 条、实际退出 1。
- 全仓 raw strict **48,516 → 48,499**，Chat **265 → 248**，逐 `(文件,错误码)` 新增 0，实际退出 1。CustomDatePicker **10 → 0**、MyStatus 主组件 **43 → 37**、util **1 → 0**；没有把剩余父级 state/ref/Emotion、PersonalStatus 或全仓债务称为完成。
- 原始规格/30 秒/并发 4、baseline/strict-debt/tsconfig 和原 known-failure 均未修改。初次类型探针的 React 解析、显式 undefined、TS2883，以及新测试语言默认参数的 fixture 错误均保留日志并已纠正，最终无新增 tuple。

证据：`/Users/kogeki/dev/HAP-工作记录/20261024-personal-status-dates`，包括 `before-browser-v2.log`、`after-browser.json`、`before-spec-final.log`、`after-spec-final.log`、`public-types-result.json`、`strict-compare.json`、`emission-audit.json`。最终完整 SHA、普通 push、release 和冻结结果见该目录终态收据。

## 协作接收范围

仅对 `53e54d196683644f301d22974a1688f47e95aefb` 的 `MyStatus/util.ts` 日期格式器 `MomentInput` 可选参数合同作部分接收；lead 使用等价的 `moment.MomentInput` 命名，完整运行代码相同，合法零参数、字符串、Date、Moment 均已验证。该提交另外三个路径不因本批成为已接收；后续 `1b039` 的非空断言和整个 MyStatus/日期组件版本也未接收。本批其它修复及公开日期合同为独立实现，正式接收账本在最终门禁和 main 同步后登记。

本批仅准备新候选，未操作生产。现网仍是已由用户确认的 HAP 7.5.2 / `908c1d92bbbe32ad5c14fe965ac839c50543b5e3`，持续全仓目标保持 active。
