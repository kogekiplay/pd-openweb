# Agent 入口 exactOptional 严格化

Agent → ChatPanel 的 runtime 可选属性已明确允许 `undefined`，与现有匿名/帮助/单页计划调用方保持一致；运行时路由、会话恢复和 builder 配置不变。

验证结果：strict 诊断 56,608 → 56,607，欠债文件 3,304 → 3,303，strict-clean 1,429 / 4,732；fast、工具、语法门禁和 204/204 规格通过。证据见 `/private/tmp/hap-agent-entry-20261011-*`，本批未单独发布生产。
