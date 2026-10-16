# 拖拽布局 resetDisplay 回归与严格化

`src/pages/widgetConfig/util/drag.ts` 保持主树现有的无效源/目标路径保护和 `FormControl` 合同，仅修复 `resetDisplay`：源行只含被移动控件时，先移除空行，再按源行与目标行的相对位置修正插入索引，随后重新生成连续的 row/col。原数组和控件额外字段继续保持不可变与保留。

以 `90c28adf2` 为历史基准完成 779 组 A/B，覆盖 1–4 列、不同方向插入、同行移动、列表末尾插入、标签页整组移动、宽度重算、连续保存行号、深冻结输入和无效路径反例。`resetDisplay` 的预期变化单独断言，不把回归修复误判成历史差异。规格读取真实 Drag/widget/index/widgets producer；未复制同步树基线。拖拽规格目标 ESLint 无错误。

全仓 strict 保持 51,854，按文件/错误码无新增；fast 8,571 / 2,307 keys，欠债 3,115，strict-clean 1,646/4,761。baseline 仅更新本次正式门禁生成记录，没有新增或放宽条目。240/240 规格、工具/语法/后缀、颜色/圆角/排版/JSX key/fast/strict 门禁通过。同步树 `/Users/kogeki/dev/pd-openweb-dnd` 的原有未提交改动保持不变。

证据 `/private/tmp/hap-drag-20261016-main.log` 及 `/private/tmp/hap-drag-20261016-*.log`。生产发布另记，完整全仓严格化仍在进行。
