# 2026-10-15 日历工具栏生产更新

上海时间 11:42:18 将日历工具栏与公共日历严格化源码 `12c5a29e16f6943a0f70f724e793abef4a18ab9f` 发布生产，保留 HAP 后端 7.5.1。工具栏及 Comm 的有限合同、API 载荷解码和 doT 编译器声明已验证；任务树两处动态导入改为使用 HTML 默认导出。终点诊断 52,556→52,347，按文件/错误码无新增；欠债3,123，strict-clean1,636/4,759，fast8,637/2,322 keys。全仓严格化尚未完成。

78 组历史 A/B 覆盖时间、颜色、分类原地增删、邀请模板、初始化、订阅、确认/拒绝、失败返回及零日程缺少 calendars 的兼容分支。两个任务树实际动态导入回调通过真实 doT 模板编译/转义验证。235/235 行为规格、工具/语法/后缀、颜色/圆角/排版/JSX key、fast/strict 门禁全部通过（保留 PublicWorksheet weixinAuth 既有隔离失败）；普通 pre-push 同步 main 后，正式 release、publish 与 1,095 JS / 387 CSS / 3 runtime 资源验证通过。

候选17,098文件在服务器和容器内逐文件SHA256验证通过，入口摘要 `d4d910ff7783ecbd22fafdef1dc85c24cfc2042d5e0dc6a62c56e6e15b3467ac`。完整旧前端保留在容器 `/usr/local/MDPrivateDeployment/www-prev-20261015-12c5a29e16`，服务器回滚脚本 `/data/mingdao/frontend-12c5a29e16-20261015/rollback.sh` 已做语法检查。保留旧资源及厂商50x.html，无.dev.js；五个服务ID、镜像、端口与所有挂载字段前后一致，挂载列表按Destination/Source规范化后比较，nginx检查通过。

公网六入口均200，五个产品入口含本次revision；34个JS/CSS/静态及厂商资源核验通过。已登录浏览器打开日历页面、待确认日程空列表并返回日历成功，DOM revision匹配，控制台error/warn为0。未对真实日程执行确认、拒绝或修改。

过程记录：初候选1ccfdd3cd2切换后，复核发现旧版允许零日程响应省略calendars，主动回滚并确认原ef0858d1b1入口摘要恢复。补齐该兼容分支和两个历史对照、重新通过全部门禁及正式构建后，发布最终12c5a29e1。原尝试的脚本、清单与阶段记录保留；最终成功证据与原尝试分开存放。

上游再次fetch核验仍为5788d7d5d（7.5.1），无需追加微服务升级。同步树三项原改动的SHA256仍匹配，未修改。证据：`/private/tmp/hap-calendar-toolbar-20261015/`；服务器 `/data/mingdao/frontend-12c5a29e16-20261015/`。
