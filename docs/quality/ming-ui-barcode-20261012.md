# ming-ui BarCode 严格化

BarCode 的渲染器、条码选项、DOM ref 和 JsBarcode 依赖边界已明确类型；保留 SVG、canvas、img 三种渲染路径、默认选项和 renderWidth 行为。

验证结果：产品 strict 诊断 56,501 → 56,493，欠债文件 3,273 → 3,272，strict-clean 1,459 → 1,460 / 4,732；工具类型门禁、Prettier 和完整 205/205 规格通过。生产仍为 `e091d5f553`，本批尚未发布。
