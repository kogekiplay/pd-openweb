# filterregex 紧急生产修复验收

上海时间 2026-10-17 06:51:57 完成生产切换。源码 revision `23358d0949e72822060fbee5805dcff5797efc09`，以实际线上 `c1c74ba4d66e51972267c3fdda7c16917c417cdd` 为基底，仅带入正则兼容修复、回归及发布资源检查器修正。生产发布树 `/private/tmp/hap-filterregex-release-20261017`；GitHub main 已以普通推送保留该分支完整历史，代码集成提交 `da157312ba8fe138c46fb3e6bd985dc90fd970d3`。main 上其余子表、移动分享及甘特时间类型批次尚未随本次发布。DSH `f80562ba` 保留待复核，主树对应 cherry-pick 已 revert，未进入本次生产。

## 原因与修复

用户报告 `Invalid widget setting list → filterregex`。hap-cli 只读确认库位编码工作表 `6a8d41b328699bdf701ffab6` 的“区域代码”真实保存为 `filters:null` 无条件正则，值 `^(0[1-9]|[1-9][0-9])$`，提示“请输入01-99”。严格设置解码拒绝了该合法哨兵；真实字段保存格式化函数也会输出 `filters:''`。

设置解码现在保留 null/空串规则及原始元数据、对象身份和保存载荷；表单运行校验把两者规范化成空条件数组，仍执行原有正则。畸形项的容错不影响合法规则。生产源码反例复现与真实 formatter 保存对照通过。最初只过滤畸形项的候选没有发布，未通过忽略合法规则来消除异常。生产规则配置前后只读比较一致，没有更改工作表配置。

发布资源检查器曾把压缩代码的 `9e3` chunk ID 误读成 `3`，实际 `9000.7eb52d42.chunk.js` 存在。修正 JS/CSS 数值键解析；规格对照 JavaScript loader，且验证真正删除 9000 资源仍失败。未忽略检查错误或放宽门禁。

## 验证

- 独立发布树 242/242 规格，工具、后缀、语法、非增量 fast、strict、颜色、圆角、排版及 JSX key 通过；正式 release、runtime 资源验证（1,095 JS / 387 CSS chunks）及 publish 通过。保留一项原有隔离 known-failure。
- 生产基线类型数不变：strict 51,692 / 3,113 文件，strict-clean 1,648/4,761；fast 8,570 / 2,306 keys。主树仍 strict 51,371 / 3,098 文件，strict-clean 1,665/4,763；fast 8,541 / 2,295 keys；主树 pre-push 243/243 规格通过。两个棘轮文件均未被 hotfix 修改。pre-push 与 release 顺序运行。
- 17,098 个候选文件 SHA256 逐一匹配；内部和公网六入口均 200，五个应用入口含完整 revision；34 项关键资源验收通过。主入口 SHA256 `15a0a306365258133e34abcfa3c74b79f8a6b21ed73fccb58644fb7f40291bce`。
- 五个容器身份、镜像、端口、完整 Mounts 前后一致；app 仍为 HAP 7.5.1，doc 2.1.0 四个原 external 卷保留；厂商 PM 资源保留且公网可读。官方 upstream HEAD `5788d7d5d8d696dd0b969ce851570105934118b5` 未变化，没有待合入更新或微服务升级。
- 内置浏览器已登录验收真实库位编码表：刷新后打开创建草稿，区域代码 `00` 显示“请输入01-99”，`01` 不显示错误；console warn/error 为 0。字段恢复原空值后放弃本次草稿，未保存草稿、未提交记录；总记录数始终 2,036。真实设置保存格式化由规格覆盖，生产未保存字段配置。

## 回滚与证据

完整切换前副本 `/usr/local/MDPrivateDeployment/www-prev-20261017-23358d0949`，对应原入口 SHA256 `3b11be4a5305197cd631764cf2f3b621baae567c0ac8ebd98cdfc108b909103a`。回滚脚本 `/data/mingdao/frontend-23358d0949-20261017/rollback.sh` 已通过语法检查。旧回滚链及既有后端回滚材料保留。

服务器阶段目录 `/data/mingdao/frontend-23358d0949-20261017/` 保存候选、逐文件清单、切换前摘要、五服务前后完整状态、内部 HTTP 验收、阶段记录及回滚脚本。上传包 SHA256 `d95da0e3e82e9077dda3329d00c55aeb6a9dd747f837a9e02e91fc9ea447db9c`。本地证据 `/private/tmp/hap-widget-hotfix-20261016/` 含全部日志、清单、公网检查、生产配置前后响应和 `ui-verification.json`、`production-invalid-region.png`、`production-valid-region.png`。

发布后 `/data` 余量 5,908,865,024 bytes，下一次完整复制发布前必须先核算预算，并按已验证归档流程释放旧回滚占用；不得删除当前快速回滚。同步树原三项改动 SHA256 不变。全仓强类型与全局 strict 目标继续，尚未完成。
