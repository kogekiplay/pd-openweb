# 表单展示控件 props 严格化

本批收紧桌面和移动表单的展示控件边界：RefreshBtn、Check、DateCalc、FormulaFunc、Number、Readonly、Section、EmbedPreview，以及移动端 Subtotal。组件 props 只声明实际读取的控件字段、回调和展示状态；DateCalc 对单位索引使用有限数字范围，保持非法单位显示为空的旧行为。

验证结果：

- 17 个源码文件在终点严格配置下零诊断，未引入新的调用方诊断。
- 全仓 strict：56,652 → 56,650 条诊断，strict-clean 1,406 / 4,731；欠债清单 3,339 → 3,325，移出 14 个达标文件。
- fast 基线保持 2,467 个 key；工具、语法门禁通过；203/203 完整规格通过，保留既有 PublicWorksheet 微信授权 subPath 隔离失败。
- 生产代码使用当前 Babel 配置完成构建前门禁；专项 UI 行为由完整规格覆盖。本批尚未单独切换生产环境。

证据：`/private/tmp/hap-form-widgets-20261011-*`。生产前端仍为 `5cf1a7bbb`，候选更新需按既有发布流程处理。
