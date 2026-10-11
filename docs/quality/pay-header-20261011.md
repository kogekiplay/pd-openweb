# PayHeader props 严格化

PayHeader 已声明组织项目 ID 和标题 props，保留支付、续订、失败页和版本升级页面的 logo 与标题显示行为。

验证结果：strict 诊断 56,621 → 56,620，欠债文件 3,308 → 3,307，strict-clean 1,424 / 4,731；fast、工具、语法门禁和 203/203 规格通过。证据见 `/private/tmp/hap-payheader-20261011-*`，本批未单独发布生产。
