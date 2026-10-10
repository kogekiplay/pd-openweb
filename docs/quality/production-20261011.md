# 2026-10-11 生产前端更新

本次按每日 17:30 前发布要求，将已完成全仓门禁、规格、release 和 publish 校验的前端批次 `5cf1a7bbb3abb853c8e22087ea6825769385d73b` 更新到 `oa.tlytelec.com:8880`。源码来自 GitHub 已同步的 `675a2b40fbc97d59102f17ed3876b3114f6e4f6e`，包含强类型边界、打印关联失败重试、工作表 API 异步请求保护和 manifest 聚合资源校验修复。

发布前确认：184/184 规格通过（保留既有隔离的 PublicWorksheet 微信授权 subPath case）、10 项门禁通过；release 用时 1 分 46 秒；publish success；Webpack runtime 资源为 1095 JS、387 CSS、3 runtime。发布输出 HTML 的 `index.html` SHA256 为 `01859cc55dbc2b07eabf96dd9d0c6dce360dd9491f20162fe9e99a1befe1886e`，没有 `.dev.js`。

部署前从 `script-app-1` 现网目录做种，现网旧入口 SHA256 为 `54aaab6eec4a7cd2573efadbea52f34dfaeb08269e25694c55458c30a8ace3ac`。资源通过 rsync 增量复制，没有删除旧 chunk、50x.html 或厂商资源。容器内候选目录完成 revision、入口资源、旧资源、dev 产物和所有新入口文件检查后切换；切换时再次确认 live 仍为旧 SHA，再以可回滚目录交换。当前回滚目录为 `/usr/local/MDPrivateDeployment/www-prev-20261011-5cf1a7bbb`，其入口保留旧 SHA；候选目录已移除。五个 HAP 容器 ID 未变化，均未重启；宿主 `/data` 仍约 66G 可用。

发布后 HTTP 检查：新入口及保留的旧 common 资源均返回 200，公网 `/app/my` HTML 含本次 revision。内置浏览器重新加载后显示 revision `5cf1a7bbb3abb853c8e22087ea6825769385d73b`、`isWaiting=false`、jQuery 4.0.0；工作台加载 16 个应用，MOM 运维的 UAT 问题清单加载 20 条记录。打开 UAT-0013 后表单详情正常显示，讨论输入框保持可聚焦可输入状态；本次未发送讨论、保存记录或修改业务数据。该验收仍是已登录内部会话，不等同于外部身份端到端验收。

证据目录：`/private/tmp/hap-families-20261011`（门禁、构建、publish、资源、推送、部署及 HTTP 验收），专项类型报告位于 `/private/tmp/hap-print-20261011`、`/private/tmp/hap-pivot-repair-20261011`、`/private/tmp/hap-worksheetapi-20261011`。生产更新没有重启后端、数据库或其它 HAP 7.5.0 服务。
