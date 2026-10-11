# Mingo 任务标题严格化

`getTitleOfTaskType` 的任务类型参数已明确为数值协议，保留未知类型返回空标题的既有行为。

验证结果：产品 strict 诊断 56,600 → 56,599，欠债文件 3,296 → 3,295，strict-clean 1,436 → 1,437 / 4,732；工具类型门禁、格式检查和完整 204/204 规格通过。首次全量运行遇到既有 `customEvent` 定时竞态，立即重跑通过；`PublicWorksheet weixinAuth` 仍是既有 quarantined known-failure。生产仍为已验证的 b4075d92f 版本，本批未单独发布。
