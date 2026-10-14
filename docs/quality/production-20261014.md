# 生产前端更新记录：2026-10-14

## 11:49 Statistics TopChart 严格化日常发布

上海时间 11:49 左右将已验证 GitHub main `2c37173e1add2015c79e6bb31b1732354325e319` 发布到生产。发布前候选入口 SHA256 为 `bb38e616c1c85fa77b27183cbbaf3798db19824bf5bcfb9d35004c518cec2c4a`；切换前现网入口 SHA256 为 `a41276dcb69314617aa4c6002b1aadda87c3b4863560b4dbe171c9266b4febd6`。旧版本保留在容器 `/usr/local/MDPrivateDeployment/www-prev-20261014-2c37173e1a`，其入口 SHA256 与切换前现网一致；候选目录切换完成后已移除。生产容器 ID `19ac3249c44b…` 未变化，未重启服务。

发布前 `bun run release` 通过 227/227 行为规格（保留既有 `PublicWorksheet weixinAuth` 隔离失败）、后缀/工具链/语法门禁、fast 差分门禁和 strict 棘轮；严格欠债清单 3,133 个文件，strict-clean 1,621/4,754，严格诊断由 53,201 降至 53,162 且按文件/错误码无新增。三套 Webpack 生产编译成功，`verify:webpack-assets` 校验 3 个 runtime 的 1,095 个 JS 和 387 个 CSS chunk，publish success。候选容器内 build/files 与 build/dist 的逐文件 SHA256 全部匹配，保留旧入口资源、`50x.html` 和厂商资源，未发现 `.dev.js`。

存储预算在清理两个已验证重复的宿主旧暂存目录后通过：删除 `/data/mingdao/frontend-ec1b4e67c6-20261013`（上一版候选已由容器回滚目录保留）和 `/data/mingdao/deploy-20260923c`（7.5.0 升级归档 `/data/mingdao/upgrade-7.5.0-20261008/www-previous` 保留同一入口 `67f786…`）；容器现网、全部 `www-prev-*` 回滚目录和 7.5.0 升级归档均保留。发布前可用空间 22,042,972 KiB，候选预算 16,299,639 KiB，满足完整现网副本、传入产物和 4 GiB 余量。

发布后远端回读确认现网入口为 `bb38e616…`、回滚入口为 `a41276dc…`、`www-next` 不存在且无 `.dev.js`。公网 `https://oa.tlytelec.com:8880/`、`/dashboard`、`/portal.html`、`/admin.html` 和 `/50x.html` 均 HTTP 200，入口 HTML 含本次 revision；13 个主站/单页 JS/CSS/静态资源的公网响应 SHA256 与本地产物一致，厂商 `/pm/freestyle.js`、`/pm/freestyle.css` 保持由生产容器提供。内置浏览器真实登录会话打开工作台，审批列表、应用收藏、最近使用和导航正常显示，控制台 error/warn 数量为 0。

证据目录：`/private/tmp/hap-topchart-release-20261014/`，包含 release/publish/typecheck、webpack 资源校验、候选全量 SHA256、原子切换、存储清理、HTTP 入口和公网资源对照记录。该批只包含前端类型收紧，不修改 HAP 后端、数据库、业务记录或授权；全仓 TypeScript 强类型和正式严格化目标继续 active。

## 16:03 HAP 7.5.1 微服务与前端升级

按用户要求先完成 Docker 微服务升级，再替换自定义前端。源码先以 `32b3a9ea7` 精确提交原 68 项暂存内容（408 行新增、99 行删除），后续修订为 `514beff62`，颜色门禁修正为 `26fa21357`。最终源码 `26fa2135786c34333d7fd0b03382353b73014e2f` 已推送 origin/main；正式 release、publish、228/228 行为规格、语法/工具/fast/strict 门禁和样式检查通过，Webpack 校验 1,095 个 JS、387 个 CSS、3 个 runtime。前端入口 SHA256 为 `485bdfda6f634cde75653db0c21c35bdca6843a7a7cb58a40a03afadcc234c1b`，候选 17,098 个文件在服务器及新容器内逐文件比对通过。

新数据备份 MySQL 5、MongoDB 49、文件 4 共 58 项状态全部 ok。备份转存至根分区后逐文件比对一致，并保存 SHA256 清单。所有现网及历史前端回滚目录以内容去重和 tar 硬链接归档，校验 1,057,050 个文件及链接；归档 SHA256 为 `2afcedfdd1f0deab8dc40588fb989f50c260698ad4350de210466a010d1c5b3d`。三个最旧回滚副本在与归档完整 SHA256 对照后清理，供镜像拉取释放空间，历史内容仍可从归档恢复。

HAP 镜像更新为 `registry.cn-hangzhou.aliyuncs.com/mdpublic/mingdaoyun-hap:7.5.1`，摘要 `sha256:bc4a857518ee54fca62b27768518444dbdcc9e59869a9ff006dec9197f82f936`，镜像 ID `sha256:639884017a7709accb84ed4303ffb563db8c9023392ac5fa5a3ad155cd4f4ace`。其余四个配套服务按现有已验证镜像重建：sc 3.2.1、doc 2.1.0、flink 1.20.0、定制 command node26-python314.local，保留其镜像摘要与定制运行时。镜像后台拉取期间继续校验候选、准备回滚及推进下一批类型清理。

官方管理器在 15:52:23 开始 restartall，15:56 左右五个服务就绪，随后复制、校验并原子替换前端。保留 7.5.1 厂商前端于新容器 `www-vendor-751`；公共帮助/分享 nginx 路由按厂商配置加回，`/pm` 资源继续由独立后端代理提供，不作为 www 文件复制。

首次挂载验收发现官方 restartall 重建了 doc 的四个匿名卷，原卷仍存在。已将原文档数据、数据库、字体和日志卷显式声明为 external volume 并单独重建 doc；当前挂载来源、目的目录、读写权限和端口均与升级前一致，doc `/healthcheck` 返回 true。回滚配置也包含这些保留卷，避免下次重建再次生成空卷。未将该问题解决前的状态视为发布完成。

最终六个入口 `/`、`/dashboard`、`/portal.html`、`/admin.html`、`/mobile.html`、`/50x.html` 均 HTTP 200；五个产品入口包含新源码 revision。32 个 JS/CSS/静态资源的公网 SHA256 与本地一致，两个厂商 `/pm/freestyle` 资源成功响应。已登录内置浏览器重新加载工作台，导航、审批列表、应用收藏和最近使用正常显示，error/warn 为 0。所有五个容器 running，nginx 配置检查通过。

回滚材料保留在服务器 `/var/backups/hap-751-20261014/`：`rollback-750.sh`、保留文档卷的 `docker-compose.rollback-preserved.yaml`、原 nginx 路由、数据备份及前端历史归档。回滚脚本恢复 7.5.0 镜像和原前端 `2c37173e1`，脚本语法已验证，未在健康现网执行回滚。证据目录为本机 `/private/tmp/hap751-release/` 及上述服务器目录。上海时间 16:03 完成服务及挂载验收，早于每日 17:30 目标；公网与浏览器验收随后完成。业务写入路径未用真实记录做测试。
