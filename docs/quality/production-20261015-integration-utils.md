# 2026-10-15 数据集成公共字段映射生产更新

上海时间12:47:25将 `84e7265963751d0009b06f058039b885377ddc49` 发布生产。数据集成公共 `utils.ts` 与数据源常量已按 SyncField、SyncMapping、SyncWorksheetControl 和 MatchedTypes 建立有限合同，保留旧的主键、标题、工作表字段拆分、重名后缀和连接参数首项语义。终点诊断 52,206→52,157；utils.ts及constant.ts零诊断，按文件/错误码无新增；欠债3,120，strict-clean1,640/4,760；fast8,604/2,318keys。

449组历史A/B覆盖映射命名、主键、重名、成员/部门/关联记录展开、默认标题、JDBC匹配、Oracle/Mongo/Kafka参数、原型同名和非法载荷；任务画布214组与OnlySyncStep观察规格继续通过。237/237行为规格、工具/语法/后缀、颜色/圆角/排版/JSX key、fast/strict门禁通过（保留PublicWorksheet weixinAuth既有隔离失败）。正式release、publish和1,095 JS / 387 CSS / 3 runtime资源校验通过。

候选17,098文件逐文件校验通过，入口摘要 `e6bec63e51a955478226e7b678f6dfff058e37b4265bc79989f6088b487f52a6`。旧前端保留于 `/usr/local/MDPrivateDeployment/www-prev-20261015-84e7265963`，服务器回滚脚本 `/data/mingdao/frontend-84e7265963-20261015/rollback.sh`；容器ID、镜像、端口和规范化后全量挂载一致，nginx通过。

公网六入口均200，34资源通过；已登录 `/integration/task` 重载后版本匹配、同步任务标题和空列表正常，console error/warn为0。未创建或运行真实同步任务，字段映射与画布行为由历史规格覆盖。上游仍为5788d7d5d（7.5.1），无需微服务升级。证据 `/private/tmp/hap-integration-utils-strict-20261015/`，服务器 `/data/mingdao/frontend-84e7265963-20261015/`。
