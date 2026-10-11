# strict 门禁脚本自身严格化

`scripts/typecheck/tsc-strict-gate.ts` 的解析、文件集合、诊断统计和错误输出路径已补齐终点配置类型，清除了脚本自身在 `noImplicitAny`、`noUncheckedIndexedAccess` 和 `noPropertyAccessFromIndexSignature` 下的诊断。门禁仍保留原有安全阈值、欠债棘轮和未定义标识符拒绝规则。

验证结果：strict 门禁脚本在终点配置下自身零诊断；全仓 strict 统计为 56,607 条、strict-clean 1,429 / 4,732；工具门禁、语法门禁和 204/204 规格通过。证据见 `/private/tmp/hap-strict-self-final-20261011.txt`。
