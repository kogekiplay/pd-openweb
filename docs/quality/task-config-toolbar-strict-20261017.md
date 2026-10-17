# 任务配置推导与甘特工具栏验收

正式构建 revision `0811346a7e2f71eefb553eb081e5f4cadc45fbdb`。接收 DSH Toolbar 五提交（063d70223、6351d353d、bf799ee25、d1ed05449、2ff703f5a），lead继续修复 `RootState.task.taskConfig` 的推导any。该批尚未发布生产。

## 根因与类型

原reducer使用默认ReduxAction载荷，`Object.assign({}, state, action.taskConfig)` 的any参数污染整个返回类型，导致RootState中的任务配置及其字段不受约束。新增 `taskConfigTypes.ts`，按真实默认值、action生产方及读取点声明TaskConfig、TaskFilterSettings和13种判别动作，显式约束reducer入参与返回值，并为对应action creators补有限载荷。专用UPDATE_TASK_ASCRIPTION遵循原creator的数字参数，空串仅经UPDATE_STATE_CONFIG进入状态，防止不同更新协议混淆。

保留现有协议中的 `folderId=1`（全部项目）和 `taskFilter=''`（项目搜索清除归属筛选）；标签、负责人和自定义筛选选项均有明确字符串元素类型。Toolbar从RootState取得两个已具体化slice，不再需要unknown过渡，也不会通过Pick<any>制造类型已完善的假象。其他task reducer、尚未建模的API结果和React<any>消费者仍是独立欠债，本记录没有声称全任务模块已经强类型。

用真实TypeScript终点配置的临时探针验证：RootState中的taskConfig、其所有直接字段、filterSettings所有字段及数组元素均非any；把排序赋给string、folderId=2、非法taskFilter字符串、数值标签、布尔筛选选项、专用归属action空串六个反例全部被TS2322拒绝。探针位于证据目录，未加入产品源码或放宽门禁。

## 行为与规格

- `taskConfig.spec.ts` 动态加载完整真实action/reducer及Redux store，与main祖先62dfebaea对照18组动作，含项目API生产UPDATE_PROJECT_ID、两种筛选占位值、搜索、排序、状态、标签/负责人/自定义筛选与重置。检查所有状态值、浅合并引用、旧state不变、未知action保持引用、状态thunk先排序再状态。两个完整源文件经Babel擦除类型后的运行代码与原实现逐字一致；ESLint整理原有格式未改变运行语义。
- Toolbar直接规格23项通过：11场景历史A/B、12条真实config点击级协议断言，保留状态/视图/周末/层级取值、i18n消息ID、弹窗与派发次序。使用真实react-redux.shallowEqual，历史基线b84c1c28a在main可达，lead把原本仅打印的源码哈希改成字面量冻结并实际断言。
- Toolbar真实connect、Redux与react-dom/server集成10项通过：5场景A/B及5条绝对接线断言。静态渲染不等于真实浏览器订阅/布局验收，该局限保留；直接规格另覆盖生命周期方法。

## 全仓验证与棘轮

253/253规格、工具、语法、后缀、非增量fast、strict、颜色、圆角、排版、JSX key、目标ESLint、正式release、runtime资源检查（1,095 JS / 387 CSS chunks）及publish通过。保留既有subPathNavigation一项隔离known-failure；测试并发/超时未放宽，pre-push和release顺序运行。

strict **51,269→51,230**，按文件/错误码无新增：Toolbar减少23，actions减少3，reducer减少13。Toolbar移出欠债，**3,091→3,090**，新类型文件从一开始strict-clean，合计**1,675/4,765**。fast仍**8,511/2,291keys**，baseline.json保持原字节，strict-debt仅删除Toolbar一项。

证据 `/private/tmp/hap-task-config-20261017/`：定向规格、完整诊断前后和逐文件/错误码比较、类型探针与六个反例、棘轮旧值、全部门禁、release/publish及verification-final.json。正式产物入口SHA256 `d0e7e2ae45f4dc9a6aacad98765f342f281bb41392d00604ff2d548372bc0d78`。

## 生产与下一步

生产仍23358d0949，入口SHA256 `15a0a306365258133e34abcfa3c74b79f8a6b21ed73fccb58644fb7f40291bce`，五容器运行，完整快速回滚/厂商资源/doc外部卷保留。本轮没有部署；下一次完整复制发布前须先按可恢复流程归档旧回滚并重算磁盘预算（最近/data余量约5.39GiB）。上游5788d7d5d无变化。同步树三项原改动继续保留。

DSH只读盘点发现其他RootState逃逸，作为后续线索保留，taskConfig一项已由本批修复，旧盘点不得继续当成当前结论。DSH下一范围为PageHeader/redux的应用详情slice，lead继续未发布子表交互和其余类型目录；全仓强类型与全局strict目标仍未完成。
