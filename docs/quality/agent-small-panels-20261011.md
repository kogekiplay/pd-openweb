# Agent 小面板严格化

Agent AppBuilder 的 OverviewPanel 计划文本和 PlanDriftCard action/options 已使用有限 props 模型，保持 markdown 预览、漂移确认和按钮禁用行为。

验证结果：strict 诊断 56,604 → 56,603，欠债文件 3,300 → 3,299，strict-clean 1,433 / 4,732；fast、工具、语法门禁和 204/204 规格通过。证据见 `/private/tmp/hap-agent-small-20261011-*`，本批未单独发布生产。
