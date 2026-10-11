# OnlySync、RecordInfo 和列头类型收紧

本批基于 `19865680f74b229aa69bb4245e727c5a797c1aa0`，完成三个相互独立的前端边界收紧：OnlySyncStep 的连接器配置、字段/映射/工作表响应和提交投影；RecordInfo 的记录详情、规则、门户配置、支付请求、表单 ref 及 DragCore 公共事件；BaseColumnHead、列宽测量和两个列头发布器。ChildTable 只补上传入当前列 `control`，没有把未完成的整类严格化草稿混入本批。

OnlySyncStep 在 API 消费点把 `unknown` 解码为有限模型，保留源表/目标表、主键、别名、字段映射和失败重试行为。RecordInfo 保留 canonical `getRowDetail` 控件来源，边界只验证额外展示字段；加载和支付请求使用 latest-wins 与卸载隔离，缺少表单句柄时释放保存状态并回调错误。DragCore 的 ref、鼠标事件和 200ms 单击/双击流程保持原行为。列头修复了缺失列序号时错误显示冻结菜单的问题，并用当前列真实 `control` 传入 ChildTable。

验证结果：

- 产品严格 CLI：57,028 → 56,666 条诊断，3,375 → 3,340 个欠债文件，strict-clean 1,391 / 4,731；按文件和错误码没有本批新增诊断。
- fast 门禁：9,112 条原始诊断、2,469 个 key，门禁通过；基线写回后移出 6 个欠债文件。
- 工具链两份 tsconfig、语法门禁、格式检查均通过。
- 完整规格 202/202 通过，保留既有 `PublicWorksheet weixinAuth` subPath 已知失败；专项规格包含 OnlySync 67 个组件/SSR 观测、10 个失败重试场景、16 个公共负例，RecordInfo/DragCore 边界正负和 ref/单双击测试，以及 BaseColumnHead 40 个渲染/列宽/生命周期场景、两个发布器 60 个菜单与回调场景。历史生产提交对照通过。
- OnlySync、RecordInfo、DragCore 和列头专项均通过生产 Babel 转换；OnlySync、RecordInfo 自有 strict/tools 诊断为 0。`crtl.ts` 保留 28 条既有严格诊断，较该范围基线 32 条减少 4 条。

证据目录：`/private/tmp/hap-next-family-20261011`、`/private/tmp/hap-onlysync-20261011/freeze-report.json`、`/private/tmp/hap-recordinfo-freeze-report.json`、`/private/tmp/hap-childtable-columnhead-check.txt`。本批尚未发布生产；生产仍为 `5cf1a7bbb`，待整合工作区完成发布构建和资源校验后再按既有生产流程决定是否更新。
