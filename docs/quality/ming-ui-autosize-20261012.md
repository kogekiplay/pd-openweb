# ming-ui AutoSize 严格化

AutoSize 的 DOM 尺寸、被包裹组件、容器 ref 和尺寸提交回调已补齐类型合同；保留受控尺寸、ResizeObserver 合并提交、无观察器轮询和 imperative `updateSize` 行为。

验证结果：产品 strict 诊断 56,514 → 56,507，欠债文件 3,275 → 3,274，strict-clean 1,457 → 1,458 / 4,732；工具类型门禁、Prettier 和完整 205/205 规格通过。生产仍为已验证的 b4075d92f 版本，本批未发布。
