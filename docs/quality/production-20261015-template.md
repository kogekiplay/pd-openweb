# 生产前端更新记录：2026-10-15 模板与弹窗批次

上海时间 10:09:08 将 `ef0858d1b15be332a76e3a61ae5cde2d06033d46` 发布生产，基于已验证的拖拽布局批次，加入字段模板引用/权限边界严格化及“管理用户”无标题弹窗关闭按钮间距修正。弹窗通过 `dialogClasses="manageUserDialog"` 给工具栏右侧预留 48px，关闭逻辑、添加用户逻辑和业务状态不变。

发布前 233/233 行为规格通过（保留 1 项既有 PublicWorksheet weixinAuth 隔离失败），模板引用 34 组历史对照、拖拽 779 组历史对照、模板权限规格通过；工具/语法/后缀、颜色、圆角、排版、JSX key、fast、strict 门禁通过。strict 诊断 52,612→52,556，按文件/错误码无新增；欠债 3,126→3,125，strict-clean 1,632/4,757；fast raw 8,646 / 2,324 keys。

候选 17,098 个文件逐文件 SHA256 校验通过；入口 SHA256 `5ac5ae24ed7408e960b1d60d7be29b5af286b9c53c0f547862f205d828f33355`。生产五容器 ID、镜像、端口及全部挂载字段保持一致，nginx 检查通过；旧前端保留在 `/usr/local/MDPrivateDeployment/www-prev-20261015-ef0858d1b1`，服务器回滚脚本在 `/data/mingdao/frontend-ef0858d1b1-20261015/rollback.sh`。

公网六入口均 200，34 个 JS/CSS/静态与厂商资源摘要通过。已登录“我的应用”页面重载后 revision 匹配，控制台 error/warn 为 0。前置部署脚本曾因沿用旧入口摘要在切换前停止，现网未变；修正为当前入口摘要后按同一候选成功完成，失败未进入切换阶段。

上游仍为 `5788d7d5d`（7.5.1），无需微服务升级。证据目录 `/private/tmp/hap-template-strict-20261015/`，服务器 `/data/mingdao/frontend-ef0858d1b1-20261015/`。
