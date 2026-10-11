# 表单边界小批次严格化

本批收口三个独立边界：移动端 ChildTableContext 使用实际的 `{ rows: RecordRow[] }` 默认上下文；静态地图尺寸解析把输入参数作为 `unknown` 验证后再做数值转换；Subtotal 的高级设置通过索引签名安全读取。

验证结果：

- 三个源码文件终点配置零诊断，未新增调用方诊断。
- strict 诊断：56,650 → 56,647；strict-clean 1,409 / 4,731；欠债清单 3,325 → 3,322。
- fast key：2,467 → 2,466；工具、语法门禁和 203/203 规格通过，保留既有 PublicWorksheet 微信授权 subPath 隔离失败。

证据：`/private/tmp/hap-form-small-20261011-*`。本批未单独发布生产。
