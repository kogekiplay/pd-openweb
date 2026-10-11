# 评论配置严格化

评论配置保留 `SOURCE_TYPE.POST` 为 `undefined` 的历史协议，并将计算属性键显式字符串化为 `"undefined"`，保持 `AT_ALL_TEXT` 的运行时查找结果不变。

验证结果：strict 诊断 56,626 → 56,625，欠债文件 3,313 → 3,312，strict-clean 1,419 / 4,731；fast、工具、语法门禁和 203/203 规格通过。证据见 `/private/tmp/hap-comment-config-20261011-*`，本批未单独发布生产。
