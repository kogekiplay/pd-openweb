# createCalendar 动态入口严格化

createCalendar 的动态加载入口已声明可选日程配置，并保留现有调用方传入的日期字符串与全天字符串协议；动态 import 和实例创建行为不变。

验证结果：strict 诊断 56,629 → 56,628，欠债文件 3,315 → 3,314，strict-clean 1,417 / 4,731；fast、工具、语法门禁和 203/203 规格通过。证据见 `/private/tmp/hap-calendar-load-20261011-*`，本批未单独发布生产。
