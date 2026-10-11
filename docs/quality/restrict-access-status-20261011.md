# RestrictAccessStatus props 严格化

RestrictAccessStatus 已声明 className 和 style props，保留访问受限提示、未授权图片和各调用方默认渲染行为。

验证结果：strict 诊断 56,620 → 56,619，欠债文件 3,307 → 3,306，strict-clean 1,425 / 4,731；fast、工具、语法门禁和 203/203 规格通过。证据见 `/private/tmp/hap-restrict-status-20261011-*`，本批未单独发布生产。
