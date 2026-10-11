# SelectRecords 入口严格化

SelectRecords 的 functionWrap 入口明确接受开放的选择器选项对象 `Record<string, unknown>`，保留所有调用方的弹窗配置和关闭回调透传行为。

验证结果：strict 诊断 56,630 → 56,629，欠债文件 3,316 → 3,315，strict-clean 1,416 / 4,731；fast、工具、语法门禁和 203/203 规格通过。证据见 `/private/tmp/hap-selectrecords-index-20261011-*`，本批未单独发布生产。
