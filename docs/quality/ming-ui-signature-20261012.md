# ming-ui Signature 严格化

Signature 的 props/state、签名 pad 生命周期、canvas 样式和扫码附件回调已使用有限模型；旧版 GenScanUploadQr 通过窄适配接收实际附件数组，保留签名清理、上传、历史签名和扫码回填行为。

验证结果：产品 strict 诊断 56,507 → 56,501，欠债文件 3,274 → 3,273，strict-clean 1,458 → 1,459 / 4,732；工具类型门禁、Prettier 和完整 205/205 规格通过。生产仍为已验证的 b4075d92f 版本，本批未发布。
