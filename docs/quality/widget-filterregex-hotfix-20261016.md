# widget filterregex 生产热修复

上海时间 2026-10-16，修复生产错误 `Invalid widget setting list`。根因是旧版/部分写入的 `advancedSetting.filterregex` 列表包含 null 或不完整条目，而严格边界把整个列表作为全量合同拒绝；实际运行时 `regexValidations` 已按合法规则过滤这些条目。

`regexSettings` 现在保留合法规则并忽略畸形条目，非数组输入按空列表处理；全量规格新增 malformed filterregex 回归，既有自动编号历史对照保留。修复只影响设置解码边界，不改变合法规则匹配、保存载荷或权限逻辑。

验证证据 `/private/tmp/hap-widget-hotfix-20261016/`：直接规格通过；243/243 仓库规格通过（既有一项隔离 known-failure）；fast 8,541/2,295 keys 无新增，strict 51,371、3,098 欠债文件、1,665/4,763 clean；语法、工具、颜色、圆角、排版、JSX key 全通过。生产发布待随后按动态脚本完成。
