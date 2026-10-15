# 表单业务规则公共配置生产验收

上海时间 2026-10-15 16:16:40 将 `90c28adf282b1be14008d7b3c5eec062b70e1b3b` 发布生产。业务规则公共配置模块终点诊断清零，全仓 strict 52,119→51,981，按文件/错误码无新增；fast8,589/2,310keys，欠债3,118，strict-clean1,642/4,760。466组历史A/B、7个真实动作回调、实际删除字段 JSX、239项规格及全部门禁通过；一项既有规格包含隔离 known-failure。详见columnrules-strict-20261015.md。

已登录“付款申请单”的业务规则页验收：原交互列表为空；新建未保存草稿，选择“申请付款金额”，从“显示”切换为“隐藏”，字段保留且文案同步。取消后重新加载页面仍为空，console warn/error为0。未提交规则、未更改生产记录或权限。现网没有既有交互规则可供保存后执行验收，保存载荷与条件分组由历史对照覆盖。

release、webpack runtime资源和publish通过，17,098文件逐一SHA校验；六入口200、34资源校验通过。index SHA256 `76941af06c53ed6d1cea5dc23b79e1f81fd1cb5ecc74a4a6cf287115a73c6be1`。五容器身份/镜像/端口/完整Mounts快照一致，后端仍7.5.1；上游HEAD仍5788d7d5d（已包含）。doc external原卷和后端回滚材料保留。

使用版本化 `scripts/deploy/hap-frontend.py` 动态捕获并再次核对现网摘要，发布前磁盘预算检查通过。回滚副本 `/usr/local/MDPrivateDeployment/www-prev-20261015-90c28adf28`；脚本 `/data/mingdao/frontend-90c28adf28-20261015/rollback.sh`。前一版本摘要 `ca48dd765422a0afc4bd227a4be51aa322905c0f83d92f831aca98278d135382` 与回滚副本一致。服务器已累积多份完整旧前端备份，下一批发布前需重新核算空间并优先考虑可验证的备份归档；本批没有删除旧备份。

证据 `/private/tmp/hap-columnrules-strict-20261015/`，包括ui-verification.json、草稿及取消后截图、remote-evidence.json和HTTP校验。同步树三项原改动摘要保持。全仓严格化仍未完成。
