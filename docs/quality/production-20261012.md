# 生产前端更新记录：2026-10-12

## 16:41 更新

当前生产前端为 `91edc6ad87830ea4a42cbffba50eff4b291e5043`，于上海时间 16:41:24 完成目录切换，包含后续扫码上传、Button、Checkbox、Radio、Dropdown/开票及 ClickAway/Menu/List 严格化批次。真实 release 用时 1 分 14 秒，212/212 完整规格与全部类型门禁通过；publish、79 个 HTML 的 537 个本地资源引用和 3 个 runtime 资源映射校验通过。新源码仍有 56,282 条严格欠债，正式全仓 strict 目标继续。

发布前候选目录 17,098 个文件 SHA256 全部匹配。现网入口文件 SHA256 为 `cbc099082968651e541f3d1f9fbeffa5e74947a19a0ded98c6206cdfb0975d57`，旧 `e091d5f553` 回滚目录 `/usr/local/MDPrivateDeployment/www-prev-20261012-91edc6ad87` 的入口为 `c24ce35d359f14cd4e1ae0eb25142bc3618d1a3813ef2dc488379224daf4e602`。旧 chunk、50x.html、厂商资源与此前回滚副本继续保留；未修改后端、数据库、业务记录或授权。5 个容器 ID 与发布前一致。

`/`、原门户 URL、管理员应用、50x.html 与厂商占位资源 HTTP 200；入口 HTML 含新 revision，实际加载的 JS/CSS 网络内容与本地产物 SHA256 一致。已登录内部浏览器会话验证工作台、MOM 运维、UAT 清单 20 条记录及记录详情，人员搜索能真实键盘输入“测试”并在请求返回后保持焦点，控制台无错误。该记录恢复了已有草稿，验收未点击保存/取消或选择人员；搜索关键字已清理，草稿保留。没有新的外部身份邮箱验证端到端验收。

证据在 `/private/tmp/hap-deploy-menu-20261012/`、`hap-menu-production-http-20261012.json`、`hap-menu-production-before-20261012.log`、`hap-menu-production-after-20261012.log`、`hap-menu-production-ui-20261012/`。发布后 /data 可用约 20.2 GiB，当前候选暂存目录与全部回滚副本保留；后续发布需先核对暂存目录重复副本和空间门槛。

## 09:15 更新

本次在上海时间 09:15 左右将已通过完整行为、类型、语法、工具和 release 门禁的前端批次 `e091d5f55315746c605ad9e61b94b201db1d4dd7` 更新到 `oa.tlytelec.com:8880`。

发布前真实 `release` 用时 1 分 7 秒，`publish` 成功；runtime 资源校验通过，3 个 runtime 文件共解析 1095 个 JS chunk、387 个 CSS chunk。构建产物包含 79 个 HTML、1176 个 JS 文件和 383 个 CSS 文件；未发现 dev/localhost 资源。HTML 本地资源引用校验保留了现有 `/pm/freestyle.js|css` 厂商路径和 DingTalk 外链。

发布流程从 `script-app-1` 现网目录播种，保留旧 chunk、`50x.html`、厂商资源和全部既有回滚副本；原子切换后现网入口 SHA256 为 `c24ce35d359f14cd4e1ae0eb25142bc3618d1a3813ef2dc488379224daf4e602`。本次回滚副本为 `/usr/local/MDPrivateDeployment/www-prev-20261012-e091d5f553`，入口 SHA256 为 `ec7cdea3d53ea28d7a56fd3b8182bb0bc9c8b6150b19bbac192eb094cfb15058`。

发布后 `/`、外部门户应用 `/portal/app/2d4a8749-6a83-4497-b3d5-93a96c4073dc` 和管理员应用 `/admin/app/60a5f4ba-4105-4f79-98cc-5da277d4600e` 均返回 HTTP 200；`script-app-1`、`script-command-1`、`script-doc-1`、`script-flink-1`、`script-sc-1` 容器 ID 与发布前一致，未重启后端服务。

部署证据保存在 `/private/tmp/hap-deploy-e091d5f55-20261012/`，包括 artifact、播种、传输、候选校验和原子切换日志。
