# 子表移动边界严格化验收

上海时间 2026-10-16，本批在主树继续完成子表目录的边界类型收紧，涉及 `src/pages/worksheet/components/ChildTable/utils.ts`、`MobileTable.tsx`、`RowDetail.tsx` 及其调用边界 `ChildTable.tsx`。

`utils.ts` 的动态错误文本、唯一值比较和行字段索引改为显式 unknown/Record 解析；`MobileTable.tsx` 的入口 props、表单 ref、删除确认、计时器、行字段和保存回调建立有限类型，保留原有平铺/列表展示、删除确认、展开行、异步校验和移动端保存行为；`RowDetail` 的表单 ref、提交数据、唯一校验、附件上传等待和弹窗关闭边界也已明确。`ChildTable.tsx` 只补充被新边界暴露的 ref/回调类型并修复同一入口的类型兼容，不改变业务流程。

证据目录 `/private/tmp/hap-childtable-mobile-20261016/`：243/243 仓库规格通过（既有 `src/router/subPathNavigation.spec.ts` 1 项隔离 known-failure）；fast 8,557 条、2,302 keys；strict 51,461 条，3,107 个欠债文件，strict-clean 1,655/4,762；工具、语法（4,753 文件）、颜色、圆角、排版、JSX key 和目标 ESLint 均通过。baseline 与 strict-debt 仅收紧。

拖拽回归另经主树 `DRAG_BEFORE_REV=2f18350a9 node src/pages/widgetConfig/util/drag.spec.ts` 通过 781 组历史对照；同步树旧版 `resetDisplay` 保持未提交，未覆盖。官方 upstream HEAD `5788d7d5d8d696dd0b969ce851570105934118b5` 无新变化。

本批尚未发布生产；现网仍为 `c1c74ba4d66e51972267c3fdda7c16917c417cdd`，今日已有两版生产更新。同步树三项未提交改动、当前生产回滚材料和已归档旧回滚均保留。
