# 生产前端更新记录：2026-10-14

## 11:49 Statistics TopChart 严格化日常发布

上海时间 11:49 左右将已验证 GitHub main `2c37173e1add2015c79e6bb31b1732354325e319` 发布到生产。发布前候选入口 SHA256 为 `bb38e616c1c85fa77b27183cbbaf3798db19824bf5bcfb9d35004c518cec2c4a`；切换前现网入口 SHA256 为 `a41276dcb69314617aa4c6002b1aadda87c3b4863560b4dbe171c9266b4febd6`。旧版本保留在容器 `/usr/local/MDPrivateDeployment/www-prev-20261014-2c37173e1a`，其入口 SHA256 与切换前现网一致；候选目录切换完成后已移除。生产容器 ID `19ac3249c44b…` 未变化，未重启服务。

发布前 `bun run release` 通过 227/227 行为规格（保留既有 `PublicWorksheet weixinAuth` 隔离失败）、后缀/工具链/语法门禁、fast 差分门禁和 strict 棘轮；严格欠债清单 3,133 个文件，strict-clean 1,621/4,754，严格诊断由 53,201 降至 53,162 且按文件/错误码无新增。三套 Webpack 生产编译成功，`verify:webpack-assets` 校验 3 个 runtime 的 1,095 个 JS 和 387 个 CSS chunk，publish success。候选容器内 build/files 与 build/dist 的逐文件 SHA256 全部匹配，保留旧入口资源、`50x.html` 和厂商资源，未发现 `.dev.js`。

存储预算在清理两个已验证重复的宿主旧暂存目录后通过：删除 `/data/mingdao/frontend-ec1b4e67c6-20261013`（上一版候选已由容器回滚目录保留）和 `/data/mingdao/deploy-20260923c`（7.5.0 升级归档 `/data/mingdao/upgrade-7.5.0-20261008/www-previous` 保留同一入口 `67f786…`）；容器现网、全部 `www-prev-*` 回滚目录和 7.5.0 升级归档均保留。发布前可用空间 22,042,972 KiB，候选预算 16,299,639 KiB，满足完整现网副本、传入产物和 4 GiB 余量。

发布后远端回读确认现网入口为 `bb38e616…`、回滚入口为 `a41276dc…`、`www-next` 不存在且无 `.dev.js`。公网 `https://oa.tlytelec.com:8880/`、`/dashboard`、`/portal.html`、`/admin.html` 和 `/50x.html` 均 HTTP 200，入口 HTML 含本次 revision；13 个主站/单页 JS/CSS/静态资源的公网响应 SHA256 与本地产物一致，厂商 `/pm/freestyle.js`、`/pm/freestyle.css` 保持由生产容器提供。内置浏览器真实登录会话打开工作台，审批列表、应用收藏、最近使用和导航正常显示，控制台 error/warn 数量为 0。

证据目录：`/private/tmp/hap-topchart-release-20261014/`，包含 release/publish/typecheck、webpack 资源校验、候选全量 SHA256、原子切换、存储清理、HTTP 入口和公网资源对照记录。该批只包含前端类型收紧，不修改 HAP 后端、数据库、业务记录或授权；全仓 TypeScript 强类型和正式严格化目标继续 active。
