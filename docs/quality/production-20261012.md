# 生产前端更新记录：2026-10-12

本次在上海时间 09:15 左右将已通过完整行为、类型、语法、工具和 release 门禁的前端批次 `e091d5f55315746c605ad9e61b94b201db1d4dd7` 更新到 `oa.tlytelec.com:8880`。

发布前真实 `release` 用时 1 分 7 秒，`publish` 成功；runtime 资源校验通过，3 个 runtime 文件共解析 1095 个 JS chunk、387 个 CSS chunk。构建产物包含 79 个 HTML、1176 个 JS 文件和 383 个 CSS 文件；未发现 dev/localhost 资源。HTML 本地资源引用校验保留了现有 `/pm/freestyle.js|css` 厂商路径和 DingTalk 外链。

发布流程从 `script-app-1` 现网目录播种，保留旧 chunk、`50x.html`、厂商资源和全部既有回滚副本；原子切换后现网入口 SHA256 为 `c24ce35d359f14cd4e1ae0eb25142bc3618d1a3813ef2dc488379224daf4e602`。本次回滚副本为 `/usr/local/MDPrivateDeployment/www-prev-20261012-e091d5f553`，入口 SHA256 为 `ec7cdea3d53ea28d7a56fd3b8182bb0bc9c8b6150b19bbac192eb094cfb15058`。

发布后 `/`、外部门户应用 `/portal/app/2d4a8749-6a83-4497-b3d5-93a96c4073dc` 和管理员应用 `/admin/app/60a5f4ba-4105-4f79-98cc-5da277d4600e` 均返回 HTTP 200；`script-app-1`、`script-command-1`、`script-doc-1`、`script-flink-1`、`script-sc-1` 容器 ID 与发布前一致，未重启后端服务。

部署证据保存在 `/private/tmp/hap-deploy-e091d5f55-20261012/`，包括 artifact、播种、传输、候选校验和原子切换日志。
