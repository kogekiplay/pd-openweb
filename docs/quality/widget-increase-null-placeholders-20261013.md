# 自动编号规则可空占位值修复

HAP 的自动编号规则允许用 `null` 表示未配置的前缀和格式。MOM 运维应用的「UAT 问题清单」实际返回了两条规则，其中 `controlId`、`format` 和 `start` 都包含这种占位值；严格边界此前只接受字符串，导致读取工作表时抛出 `Invalid widget setting list`。

本次将 `SettingIncrease` 的 `controlId` 与 `format` 合同补为 `string | null | undefined`，保留其它字段校验，并用线上读取到的完整规则加入回归测试。测试覆盖 JSON 字符串和已解析数组，确认 `start: null`、可空前缀和可空格式均能保留原值；其它非法类型仍然拒绝。

验证：`advancedSettingBoundary.spec.ts` 通过；全仓 221 个规格通过，唯一保留既有的 `subPathNavigation.spec.ts` 已知失败（PublicWorksheet weixinAuth baseUrl 与 subPath 不兼容）。
