# 移动子表类型边界及管理用户关闭按钮生产验收

上海时间 2026-10-15 15:34:05 发布源码 `4f501776605ddfaef41f21424ec3411decb4add9`。管理用户无标题弹窗的专属样式将关闭按钮向下对齐工具栏，并把右侧预留区域改为 96px。已登录“报表系统”的三人用户列表实测：关闭热区与添加按钮原有 4px 重叠，现有 44px 间隔，垂直中心差 1px；点击叉叉正常关闭，console warn/error 均 0。截图：`/private/tmp/hap-close-childtable-20261015/manage-users-after.jpg`。未执行人员增删或权限变更。

同时部署最终移动子表工具补丁，strict 52,157→52,119（按文件/错误码无新增），目标 utils 原 36 条诊断清零。fast 8,601 / 2,315keys，欠债 3,119，strict-clean 1,641/4,760。109 组历史 A/B、238 项规格和语法/工具/后缀/颜色/圆角/排版/JSX key/fast/strict 门禁通过；既有一项规格包含已隔离 known-failure。测试覆盖和受控依赖见 mobile-childtable-strict-20261015.md，未以生产记录执行移动表单写入验收。

release、webpack runtime 资源校验、publish 通过，17,098 个候选文件逐一 SHA256 校验；六入口 200，34 资源摘要/类型校验通过。主入口 SHA256 `ca48dd765422a0afc4bd227a4be51aa322905c0f83d92f831aca98278d135382`。上游 HEAD 仍 `5788d7d5d8d696dd0b969ce851570105934118b5`（已包含），五容器身份、镜像、端口与完整 Mounts 快照一致，后端仍7.5.1；doc external 原卷保留。

发布脚本已版本化为 `scripts/deploy/hap-frontend.py`，每次从容器动态捕获现网入口摘要，在切换前再次核对，并保留独占原始快照与进程锁。三项 Python 测试覆盖两种前置版本、准备期间现网变化拒绝切换、上线验证失败回滚及重复运行不覆盖快照。首版 b9ede2d47c 被旧摘要前置断言阻止，未上线；本次重新构建并采用动态前置摘要发布。

本批回滚副本 `/usr/local/MDPrivateDeployment/www-prev-20261015-4f50177660`；服务器脚本 `/data/mingdao/frontend-4f50177660-20261015/rollback.sh`。前一版本主入口摘要 `e6bec63e51a955478226e7b678f6dfff058e37b4265bc79989f6088b487f52a6`，切换后回滚副本与之匹配。后端回滚材料 `/var/backups/hap-751-20261014/` 保留。旧回滚目录未删除；下一批发布前按脚本检查空间预算。

构建/生产/页面证据 `/private/tmp/hap-close-childtable-20261015/`；类型及规格证据 `/private/tmp/hap-childtable-strict/`。同步工作树三项原改动摘要保持。全仓严格化目标仍未完成。
