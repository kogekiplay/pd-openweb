# Agent AppBuilder 面板 props 严格化

AI 助手、自定义页面和工作表三个 AppBuilder 面板已声明其数组 props，保持原有 fallback 类型和列表透传行为。

验证结果：strict 诊断 56,607 → 56,604，欠债文件 3,303 → 3,300，strict-clean 1,432 / 4,732；fast key 2,464，工具、语法门禁和 204/204 规格通过。证据见 `/private/tmp/hap-agent-panels-20261011-*`，本批未单独发布生产。
