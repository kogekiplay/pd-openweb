# 矢量标签 PDF 核心生产验收

上海时间2026-10-16 10:09:48发布 `63d1f52a0ff0fe1130de0d6c88e37bd92cc3c0eb`。vectorLabel.ts终点诊断清零；全仓strict51,854→51,798，文件/错误码无新增，fast8,571/2,307keys，欠债3,114，strict-clean1,647/4,761。88组真实PDFKit/内嵌字体/CODE128/QR指令及PDF对象历史对照、781组完整拖拽对照、241/241规格和全部门禁通过，详见vector-label-strict-20261016.md。保留既有一项隔离known-failure。

已登录付款申请单工作表，选择1条记录，打开二维码标签预览，采用内部成员链接并生成PDF。浏览器内PDF显示1页二维码和记录标题，console warn/error为0。未保存模板、未修改记录或权限、未连接实体打印机。页面Canvas及最终PDF截图、ui-verification.json在证据目录内。拖拽业务实现与上一生产版本a4c95d520完全一致；错误候选051bfd24e此前前置停止，已通过后续提交恢复，未上线。

release/runtime资源/publish通过，17,098候选文件逐一SHA256校验；六入口200、34个资源校验通过，主入口摘要 `6aac02af4b1f5034518ab48c03b3ab0902d3df48946cfeb83b78a7a13cdadd42`。五容器身份/镜像/端口与完整Mounts快照一致，后端仍7.5.1，doc四个external卷和后端回滚材料保持。官方upstream仍5788d7d5d（已包含）。

回滚目录 `/usr/local/MDPrivateDeployment/www-prev-20261016-63d1f52a0f`，服务器脚本 `/data/mingdao/frontend-63d1f52a0f-20261016/rollback.sh`；切换前摘要 `e1bb695c5efb4b9ba76da82f0b3750a3f2952f1e03be956223223c3ca6b65307` 与回滚副本一致。使用版本化脚本动态捕获和再次核对现网摘要；发布前磁盘预算通过。两份较旧副本归档与另外两份压缩包位置迁移见frontend-archive-20261015.md，恢复包和脚本均保留。下一批继续核算可用空间。

证据 `/private/tmp/hap-vector-label-strict-20261016/`，包括remote-evidence.json、http-pages.json、http-assets.json和逐文件manifest。同步树原三项未提交改动摘要保持。完整全仓强类型和strict目标仍未完成。
