# 子表待发布批次的运行时契约复核

本轮代码提交 `2351d0842`、`e32dde63e`，构建 revision `5bbb1467c6d794c0cc4d82da569e531bdadd24ba`。复核主树尚未生产的子表类型批次，发现并恢复三类与生产源码 `c1c74ba4d` 不等价的运行时行为。

- 全屏子表的嵌套 control 仍须携带主表 `worksheetId`，同时保留独立的子表 `dataSource`；保存后的 `RELOAD_RECORD_INFO` 也必须发送主表 `worksheetId`。此前误替换为 dataSource 会使主记录刷新条件不匹配。刷新注册回调现按实际函数协议建模，不再把函数写成选项对象；移除相关整对象断言，显式传递调用入口的 control。
- 移动子表的 masterData 是延迟读取主表数据的 provider，必须原样传给列表单元格和折叠表单。提前调用并转成对象会令真实部门/组织角色选择器在调用 `masterData()` 时抛错，也会丢失之后的主表变化。已恢复透传与函数身份。
- 行详情的复合值字段（19/23/24）须保持生产取 text 的语义：对象/数组缺少 text 时结果为 undefined，不能回退成原对象；同时保留有 text 的对象、函数对象及普通标量行为。

子表动作边界移除 lastAction 断言，未知动作按明确字段协议检查；正常增删更新仍保留原对象重置、去重、临时 ID 过滤、缺省 ID 和 undefined 删除项语义。这里的缺省 ID 来自现有 Redux 协议，不通过过滤 falsy 值来改变保存载荷。

## 行为证据

`ChildTable/dialogContract.spec.ts` 动态加载完整真实弹窗，对比 c1c74ba4d：72组可编辑/只读、主子表 ID、7类编辑动作、缺省 ID、保存成功/失败、重复点击、失败重试和保存后再次编辑的请求、载荷、事件及重置结果一致；布尔及既有 truthy 树插入标记都不产生脏状态。历史主树2eaf3559e在主表ID断言处失败。

`ChildTable/mobileMasterData.spec.ts` 对照生产源码的两种布局，确认渲染不调用 provider、原函数身份不变；调用真实 OrgRole.handleSelect 和 Department.selectDepartments，验证读取渲染后更新的主表数据并打开选择器。历史2351d0842版本能复现 `masterData is not a function`。

`ChildTable/rowDetailContract.spec.ts` 用96组真实渲染与保存对照覆盖4类字段、12种值和已有/临时行；唯一校验返回值、回调行ID、计数与保存结果保留。复合空对象/数组的旧候选不等价已由红转绿。

## 门禁和类型

246/246 全仓规格、后缀、工具、语法、非增量 fast、strict、颜色、圆角、排版、JSX key、正式 release、runtime资源（1,095 JS / 387 CSS chunks）及 publish 均通过；保留既有 subPathNavigation 一项隔离 known-failure。ESLint零错误，原有两条 hooks依赖警告保留，没有为通过门禁改动 effect 生命周期。

最初整仓运行中既有移动分享规格超过30秒，release正确中止；孤立运行500组分享对照通过。新增弹窗规格现缓存相同源码的编译结果，各场景仍创建独立模块、hook与store；测试用例、并发数和30秒限制均未放宽。随后原配置全仓规格29.2秒通过，正式release 1分17秒通过。

strict 51,371→51,370，逐文件/错误码无新增；ChildTableDialog.tsx由1→0并移出欠债，3,098→3,097，strict-clean1,666/4,763。fast8,541/2,295keys→8,540/2,294keys。JSON差分核验只删诊断和欠债项，没有提高任何基线计数。

本地证据 `/private/tmp/hap-childtable-contract-20261017/`，含三个历史反例/规格日志、完整strict前后诊断、棘轮旧值、门禁、正式构建与publish、verification.json。产物入口SHA256 `6a72bf7be5198467712ed2079603d881b2a30859bdacababb3666f132dcb90b0`。

本轮未发布生产。现网仍为23358d0949，已重验六入口/34资源和服务器入口摘要，五容器仍运行；原快速回滚和同步树三项改动保留。其余待发布子表批次仍须继续核验移动弹层关闭、唯一校验及其他交互；本记录只证明上述明确覆盖的契约，不把全仓规格通过当作所有子表交互的证明。DSH仍待提交补充报告，不在本批代码中。

2026-10-17 11:13补充：本批已随主树2e255b9686发布生产，完整验收见 `production-20261017-main.md`；以上未生产表述是该记录建立时的阶段状态。
