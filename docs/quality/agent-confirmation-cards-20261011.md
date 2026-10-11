# Agent 确认卡片严格化

RebuildConfirmCard 和 PlanDriftCard 的 `part`、action 回调及可选状态已使用有限 props 合同。保留后端动态 action 字符串和缺省 action 的现有回退渲染，同时消除开放 `any` props 与可选键直接索引。

验证结果：产品 strict 诊断 56,603 → 56,600，欠债文件 3,299 → 3,296，strict-clean 1,433 → 1,436 / 4,732；工具类型门禁、Prettier、语法门禁和完整 204/204 规格通过。生产仍为已验证的 b4075d92f 版本，本批是类型边界改动，未单独发布。
