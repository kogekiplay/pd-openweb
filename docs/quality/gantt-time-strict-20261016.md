# 甘特图时间工具严格化验收

上海时间 2026-10-16，本批严格化 `src/pages/task/containers/taskGantt/component/ganttDialog/time.ts`。为时间桶、Moment 输入、日期跨度和字符串解析补充有限类型，保留按天/周/月分组、跨天数计算、日期解析和 Moment 转换行为；`durDays` 兼容初始化阶段传入的字符串时间。

证据 `/private/tmp/hap-time-20261016/`：单独移动分享 500 组历史 A/B 通过；全量 243/243 规格通过（既有一项隔离 known-failure）；fast 8,541/2,295 keys；strict 51,382 条，3,099 欠债文件，strict-clean 1,664/4,763；语法、工具、颜色、圆角、排版、JSX key 均通过。baseline 与 strict-debt 仅收紧。

本批未触及生产 API、权限或数据，现网保持已验收版本；官方 upstream 仍为 `5788d7d5d8d696dd0b969ce851570105934118b5`。
