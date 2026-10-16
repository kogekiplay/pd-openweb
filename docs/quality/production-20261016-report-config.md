# 统计图表公共配置生产验收

上海时间2026-10-16 10:58:53发布 `c1c74ba4d66e51972267c3fdda7c16917c417cdd`，全仓strict51,798→51,692（文件/错误码无新增），目标reportConfigUtils.ts原104条终点诊断清零；fast8,570/2,306keys，欠债3,113，strict-clean1,648/4,761。1,592组真实模块历史A/B、242/242仓库规格及全部门禁通过，详见report-config-strict-20261016.md。保留既有一项隔离known-failure。

生产已登录付款申请单统计面板：原有2张图表正常渲染；打开未命名图表草稿，选择创建时间和记录数量，切换折线图，再加入汇率并切换双轴图。日期维度保留，记录数量与汇率分别进入主轴/辅助轴，曲线和柱形正常渲染，console warn/error为0。关闭草稿后刷新再打开统计面板仍为原有2张图表，无未命名图表。未点击保存，未更改记录或权限；保存载荷及更多图表组合由历史对照覆盖。

release、webpack runtime资源和publish通过；17,098候选文件逐一SHA256、六入口200与34资源校验通过。主入口SHA256 `3b11be4a5305197cd631764cf2f3b621baae567c0ac8ebd98cdfc108b909103a`。五容器身份/镜像/端口/完整Mounts一致，后端仍7.5.1，doc四个external卷与后端回滚材料保留。官方upstream HEAD仍5788d7d5d，已包含且无新版本待合入。

回滚副本 `/usr/local/MDPrivateDeployment/www-prev-20261016-c1c74ba4d6`；脚本 `/data/mingdao/frontend-c1c74ba4d6-20261016/rollback.sh`，副本入口摘要与切换前 `6aac02af4b1f5034518ab48c03b3ab0902d3df48946cfeb83b78a7a13cdadd42` 匹配。使用版本化动态前置摘要发布脚本，完整原现网副本先保留再覆盖候选。旧e1a5344125副本已逐条比较后归档到/data/mingdao/hap-frontends-20261016，审计JSON/摘要/恢复脚本保留；下批发布前重新核算磁盘预算。

证据 `/private/tmp/hap-report-config-strict-20261016/`，含remote-evidence.json、HTTP和逐文件清单、production-line-draft.jpg、production-dual-draft.jpg、ui-verification.json。同步树原三项改动摘要不变。完整全仓强类型与正式strict仍未完成。
