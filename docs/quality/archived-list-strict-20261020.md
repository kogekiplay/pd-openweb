# ArchivedList strict 类型收敛（2026-10-20）

`src/components/ArchivedList/index.tsx` 的 12 条 strict 诊断已清零，保留归档列表的请求分流、日志响应映射、倒序展示、选中/清空回调和自定义触发器行为。

## 合同

- `ArchivedItem` 如实表达 `id/start/end/text` 的可选值，兼容工作流、工作表和日志归档的共同消费字段。
- `ArchivedLogResponseItem` 表达日志接口的 `archivedId/startTime/endTime/text` 响应字段，并在映射处收窄为 `ArchivedItem`。
- 组件 props 明确 `type`、归档参数、选中回调和自定义触发器返回值；状态列表不再从空数组推成 `never[]`。
- 只添加类型信息，未改变请求参数、列表倒序、默认清空项或渲染结构。

## 验证

- `node src/components/ArchivedList/index.spec.ts`：通过。
- `npm run typecheck:strict`：通过；全仓 strict 诊断保持 **50,243**，strict-clean **1,731 / 4,780**，清单外无诊断。
- `npm run typecheck:strict:shrink`：strict-debt **3,050 → 3,049**，只移出本文件。
- `git diff --check`：通过。

本批未部署生产；生产 revision 和协作树交付保持不变。全仓 strict 总目标继续 active。
