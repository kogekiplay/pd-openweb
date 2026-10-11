# DatePicker TaskHeader 严格化

TaskHeader 的类组件默认属性已迁移到类内静态 `defaultProps`，兼容 React 19 类型定义并保留开始/结束复选框的默认值与 toggle 回退行为。

验证结果：产品 strict 诊断 56,599 → 56,598，欠债文件 3,295 → 3,294，strict-clean 1,437 → 1,438 / 4,732；DatePicker 专项和完整 204/204 规格、工具类型门禁、格式检查通过。生产仍为已验证的 b4075d92f 版本，本批未单独发布。
