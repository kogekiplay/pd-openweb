# SelectRecords 头部类型严格化

SelectRecords 的 Header 与 RowHead 已补齐真实控件、搜索配置、筛选状态、选择行和回调 props，保留搜索、快速筛选、新建记录和全选行为。

验证结果：strict 诊断 56,642 → 56,630，欠债文件 3,317 → 3,316，strict-clean 1,415 / 4,731；fast key 2,466 → 2,465；工具、语法门禁和 203/203 规格通过。证据见 `/private/tmp/hap-selectheader-20261011-*`，本批未单独发布生产。
