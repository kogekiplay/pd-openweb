# 扫码附件与签名回填链路

`GenScanUploadQr` 的参数、容器 ref、会话缓存与附件回调已使用有限模型。返回给调用方的附件采用真实 `TemporaryAttachment` 类型，Signature 不再用整包组件断言接入；接口响应和 RecordInfoContext 中的草稿/流程标记先按 unknown 验证后消费。Popup 使用实际 styled-components 类型。

获取二维码失败或轮询失败时显示刷新入口；刷新和卸载使旧请求失效，并停止旧扫描会话。关闭后迟到的二维码会话会被清理，旧附件不会回填。慢轮询不重叠；已有 URL 去除查询参数后的去重规则、sourceType/getType、空 rowId 请求、签名回填后关闭和浮层上下定位均保留。

专项使用真实组件和真实附件转换函数，确定性验证 4 种 source/getType 组合、5 种非法链接响应、7 种非法附件响应、稀疏数组、请求失败/重试、过期刷新、连续刷新乱序、记录切换、卸载后迟到响应、回调失败、签名关闭与最新回调。`SCAN_UPLOAD_BEFORE_REV=b70309400 node src/pages/worksheet/components/GenScanUploadQr.spec.ts` 验证正常行为的历史对照。

与干净的 `36fdbbeea` 同步工作区相比，产品严格诊断 56,493 → 56,447，按文件/错误码新增 0。组件自身清除 38 条，三个既有上传/签名调用方合计减少 8 条；欠债清单 3,272 → 3,271，strict-clean 1,460 / 4,732 → 1,462 / 4,733。新规格在工具终点五开关下自身 0 诊断；常规工具门禁和格式检查通过。完整规格 206/206，仍包含已有隔离项 `PublicWorksheet weixinAuth`。全仓严格化尚未完成。

证据：`/private/tmp/hap-scan-strict-baseline.txt`、`hap-scan-strict-final.txt`、`hap-scan-tools-strict-final2.txt`、`hap-scan-specs-final-20261012.log`。本批尚未发布；今天生产仍为已验证的 `e091d5f553`。

源码已通过 `938a846c8` 和主分支整合 `6f48870b4` 推送，双方完整推送门禁均通过 206/206 规格。该整合源码真实 release 用时 1 分 5 秒，publish 成功；3 个 runtime 的 1095 JS / 387 CSS 映射存在，79 个 HTML 的 537 个非厂商本地资源引用全部存在，未引用 dev 产物。入口包含该源码 revision，SHA256 为 `af39b498776af1260fd6fc5b8b8ee3e2f0eef13adbc26b76b08aa2947e8626be`；widget 已生成，构建后工作树干净。构建证据见 `/private/tmp/hap-scan-release-20261012.log`、`hap-scan-publish-20261012.log`、`hap-scan-artifact-check-20261012.json`。候选产物尚未部署生产。

语义差分基线同步收紧：已消失的 27 条诊断全部删除，keptCount 9,092 → 9,065，唯一 key 2,464 → 2,454；没有增加任何基线项。
