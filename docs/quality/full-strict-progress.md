# 全仓 TypeScript 严格化目标

## 2026-10-12 扫码上传链路

GenScanUploadQr 的完整参数、附件/API 边界、轮询及会话生命周期已严格化，Signature 的整包类型断言已移除。修复扫码失败无恢复入口、卸载后迟到响应和慢轮询重叠；正常行为历史对照通过。严格诊断 56,493 → 56,447（按文件/错误码新增 0），欠债 3,271 文件，strict-clean 1,462 / 4,733；完整规格 206/206，工具门禁通过。详见 `scan-upload-chain-20261012.md`。本批尚未发布，今天生产仍为 `e091d5f553`。

整合源码 `6f48870b4` 已通过真实 release（1 分 5 秒）、publish、runtime 映射及 HTML 本地资源检查；入口 revision 匹配源码，构建后工作树干净。语义基线删除已消失的 27 条诊断，唯一 key 收紧至 2,454。本批候选已验证，尚未部署。

## 2026-10-12 ming-ui BarCode 批次

BarCode 的 props、DOM ref 和 JsBarcode 选项边界已严格化，strict 诊断为 56,493 条、3,272 个欠债文件，strict-clean 1,460 / 4,732；205/205 规格和工具类型门禁通过。证据见 `ming-ui-barcode-20261012.md`，生产当前为已验证的 `e091d5f553`，本批尚未发布。

## 2026-10-12 生产发布

已将通过完整 release、publish 和 runtime 资源校验的 `e091d5f553` 发布到生产；入口 SHA256 为 `c24ce35d...`，回滚副本保留旧入口。根路径、外部门户应用和管理员应用均 HTTP 200，容器未重启。详见 `production-20261012.md`。

## 2026-10-12 ming-ui Signature 批次

Signature 的 pad 生命周期、状态、canvas 与扫码附件回调边界已严格化，strict 诊断为 56,501 条、3,273 个欠债文件，strict-clean 1,459 / 4,732；205/205 规格和工具类型门禁通过。证据见 `ming-ui-signature-20261012.md`，生产仍为已验证的 `b4075d92f`，本批尚未发布。

## 2026-10-12 ming-ui AutoSize 批次

AutoSize 的尺寸、ref、被包裹组件和观察器边界已严格化，strict 诊断为 56,507 条、3,274 个欠债文件，strict-clean 1,458 / 4,732；205/205 规格和工具类型门禁通过。证据见 `ming-ui-autosize-20261012.md`，生产仍为已验证的 `b4075d92f`，本批尚未发布。

## 2026-10-12 AMap OperatorIcon 批次

OperatorIcon 的位置与回调 props 已严格化，strict 诊断为 56,514 条、3,275 个欠债文件，strict-clean 1,457 / 4,732；205/205 规格和工具类型门禁通过。证据见 `amap-operator-icon-20261012.md`，生产仍为已验证的 `b4075d92f`，本批尚未发布。

## 2026-10-12 Agent AppBuilder Header 批次

构建状态 chip 的主题键已收敛为有限联合并保留未知状态回退，strict 诊断为 56,523 条、3,276 个欠债文件，strict-clean 1,456 / 4,732；205/205 规格和工具类型门禁通过。证据见 `agent-appbuilder-header-20261012.md`，生产仍为已验证的 `b4075d92f`，本批尚未发布。

## 2026-10-12 Mingo 小边界批次

Mingo Guide、LoadingWithSteps 及 prompt 配置/输入边界已严格化，strict 诊断为 56,526 条、3,277 个欠债文件，strict-clean 1,455 / 4,732；205/205 规格和工具类型门禁通过。证据见 `mingo-small-boundaries-20261012.md`，生产仍为已验证的 `b4075d92f`，本批尚未发布。

## 2026-10-12 ming-ui 基础组件批次

Input、LoadDiv、MdLink、Qr、SimplePagination、Splitter 和 MdAntTimeRangePicker 的 props 合同已严格化，strict 诊断为 56,536 条、3,283 个欠债文件，strict-clean 1,449 / 4,732；205/205 规格和工具类型门禁通过。证据见 `ming-ui-primitives-20261012.md`，生产仍为已验证的 `b4075d92f`，本批尚未发布。

## 2026-10-12 删除确认框参数批次

DeleteReconfirm 的选中值回调已明确为组件泛型值或 `undefined`，strict 诊断为 56,543 条、3,290 个欠债文件，strict-clean 1,442 / 4,732；205/205 规格、工具类型门禁和格式检查通过。本批只收紧类型，未发布生产。

## 2026-10-12 Agent @应用输入批次

Agent `appSource`、桌面/移动应用浮层和 MentionInput 已共享有限 `MentionApp`、输入值与 ref 合同，API/DOM/事件边界已严格化；strict 诊断为 56,544 条、3,291 个欠债文件，strict-clean 1,441 / 4,732；205/205 规格和工具类型门禁通过。证据见 `agent-mention-input-20261012.md`，生产仍为已验证的 `b4075d92f`，本批尚未单独发布。

## 2026-10-11 DatePicker TaskHeader 批次

TaskHeader 的类组件默认属性已改为类内静态 `defaultProps`，strict 诊断为 56,598 条、3,294 个欠债文件，strict-clean 1,438 / 4,732；204/204 规格和工具类型门禁通过。证据见 `date-picker-task-header-20261011.md`，生产仍为已验证的 `b4075d92f`，本批尚未单独发布。

## 2026-10-11 Mingo 任务标题批次

Mingo 任务标题入口的 `taskType` 参数已明确为数值协议，strict 诊断为 56,599 条、3,295 个欠债文件，strict-clean 1,437 / 4,732；204/204 规格和工具类型门禁通过。证据见 `mingo-task-title-20261011.md`，生产仍为已验证的 `b4075d92f`，本批尚未单独发布。

## 2026-10-11 Agent 确认卡片批次

RebuildConfirmCard 和 PlanDriftCard 的有限 props、动态 action 回调和可选 action 显示已完成，strict 诊断为 56,600 条、3,296 个欠债文件，strict-clean 1,436 / 4,732；204/204 规格、工具类型门禁和格式检查通过。证据见 `agent-confirmation-cards-20261011.md`，生产仍为已验证的 `b4075d92f`，本批尚未单独发布。

## 2026-10-11 Agent 小面板批次

OverviewPanel 和 PlanDriftCard 的 props 合同已完成，strict 诊断为 56,603 条、3,299 个欠债文件，strict-clean 1,433 / 4,732；204/204 规格通过。证据见 `agent-small-panels-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 Agent 面板批次

Agent AppBuilder 的 AI 助手、自定义页面和工作表面板 props 已严格化，strict 诊断为 56,604 条、3,300 个欠债文件，strict-clean 1,432 / 4,732；204/204 规格通过。证据见 `agent-panels-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 strict 门禁脚本批次

严格化门禁脚本自身已在终点配置下清零诊断，保留全量编译、安全阈值和欠债棘轮行为；当前全仓 strict 诊断 56,607 条、strict-clean 1,429 / 4,732，204/204 规格通过。证据见 `strict-gate-self-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 Agent 入口批次

Agent runtime exactOptional 契约已完成，strict 诊断为 56,607 条、3,303 个欠债文件，strict-clean 1,429 / 4,732；204/204 规格通过。证据见 `agent-entry-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 PaySuccess 批次（复验）

PaySuccess 支付结果边界、挂载节点和失败/卸载生命周期已完成严格化；专项覆盖 44 组页面、15 个非法响应及历史 A/B。当前产品严格诊断 56,608 条，strict-clean 1,428 / 4,732，fast key 2,464，完整规格 204/204；证据见 `pay-success-widget-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 PaySuccess 批次

PaySuccess 支付响应解码和挂载边界已完成，strict 诊断为 56,608 条、3,304 个欠债文件，strict-clean 1,427 / 4,731；fast key 2,464，203/203 规格通过。证据见 `pay-success-widget-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 CreateByMingDaoYun 批次

CreateByMingDaoYun props 合同已完成，strict 诊断为 56,618 条、3,305 个欠债文件，strict-clean 1,426 / 4,731；203/203 规格通过。证据见 `create-by-mingdao-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 RestrictAccessStatus 批次

RestrictAccessStatus props 合同已完成，strict 诊断为 56,619 条、3,306 个欠债文件，strict-clean 1,425 / 4,731；203/203 规格通过。证据见 `restrict-access-status-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 PayHeader 批次

PayHeader props 合同已完成，strict 诊断为 56,620 条、3,307 个欠债文件，strict-clean 1,424 / 4,731；203/203 规格通过。证据见 `pay-header-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 支付失败页批次

支付失败页 React root 挂载节点已严格验证，strict 诊断为 56,621 条、3,308 个欠债文件，strict-clean 1,423 / 4,731；203/203 规格通过。证据见 `pay-failed-mount-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 停用名称组件批次

DisabledDepartmentAndRoleName props 合同已完成，strict 诊断为 56,622 条、3,309 个欠债文件，strict-clean 1,422 / 4,731；203/203 规格通过。证据见 `disabled-name-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 ProductLicenseInfo 批次

ProductLicenseInfo props 合同已完成，strict 诊断为 56,623 条、3,310 个欠债文件，strict-clean 1,421 / 4,731；203/203 规格通过。证据见 `product-license-info-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 ErrorState 批次

ErrorState props/state 合同已完成，strict 诊断为 56,624 条、3,311 个欠债文件，strict-clean 1,420 / 4,731；203/203 规格通过。证据见 `error-state-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 评论配置批次

评论 SOURCE_TYPE/AT_ALL_TEXT 计算键已严格化并保留 undefined 协议，strict 诊断为 56,625 条、3,312 个欠债文件，strict-clean 1,419 / 4,731；203/203 规格通过。证据见 `comment-config-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 createTask 批次

createTask 动态入口及成员数组调用方已完成，strict 诊断为 56,626 条、3,313 个欠债文件，strict-clean 1,418 / 4,731；203/203 规格通过。证据见 `create-task-entry-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 createCalendar 批次

createCalendar 动态入口和调用方 options 协议已完成，strict 诊断为 56,628 条、3,314 个欠债文件，strict-clean 1,417 / 4,731；203/203 规格通过。证据见 `create-calendar-entry-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 SelectRecords 入口批次

SelectRecords functionWrap 入口已完成开放选项边界，strict 诊断为 56,629 条、3,315 个欠债文件，strict-clean 1,416 / 4,731；203/203 规格通过。证据见 `select-records-entry-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 SelectRecords 批次

SelectRecords Header/RowHead props 合同已完成，strict 诊断为 56,630 条、3,316 个欠债文件，strict-clean 1,415 / 4,731；fast key 2,465，203/203 规格通过。证据见 `select-records-header-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 RecordPay 批次

RecordPay props 合同已完成，strict 诊断为 56,642 条、3,317 个欠债文件，strict-clean 1,414 / 4,731；203/203 规格通过。证据见 `record-pay-widget-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 TelPhone 批次

桌面 TelPhone props 合同已完成，strict 诊断为 56,643 条、3,318 个欠债文件，strict-clean 1,413 / 4,731；203/203 规格通过。证据见 `telphone-widget-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 移动表单边界批次

移动关联记录 Text 和 WaitingUpload props 合同已完成，strict 诊断为 56,644 条、3,319 个欠债文件，strict-clean 1,412 / 4,731；203/203 规格通过。证据见 `mobile-boundaries-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 SplitLine 批次

桌面 SplitLine props 合同已完成，strict 诊断为 56,646 条、3,321 个欠债文件，strict-clean 1,410 / 4,731；203/203 规格通过。证据见 `splitline-widget-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 表单边界小批次

ChildTableContext、静态地图参数和移动 Subtotal 高级设置边界已收紧，三文件终点诊断清零。当前产品严格诊断 56,647 条、3,322 个欠债文件，strict-clean 1,409 / 4,731；fast key 2,466，203/203 规格通过。证据见 `form-boundaries-20261011.md`，生产仍为 `5cf1a7bbb`。

## 2026-10-11 表单展示控件批次

桌面/移动表单展示控件的有限 props 合同已完成，17 个源码文件零终点诊断；全仓严格诊断为 56,650 条、3,325 个欠债文件，strict-clean 1,406 / 4,731，203/203 规格通过。证据见 `form-display-widgets-20261011.md`；生产仍为 `5cf1a7bbb`，本批尚未发布。

## 2026-10-11 快速筛选工具批次

快速筛选工具 `fastFilter/util.ts` 的 15 条终点诊断已清零，日期默认值、颗粒度、默认设置和人员/关联记录序列化通过 8 组历史 A/B。产品严格诊断为 56,652 条、3,339 个欠债文件，strict-clean 1,392 / 4,731；fast key 为 2,467，完整规格 203/203。证据见 `fast-filter-util-20261011.md`；生产仍为 `5cf1a7bbb`，本批尚未发布。

## 2026-10-11 最新冻结批次

OnlySync、RecordInfo/DragCore、BaseColumnHead 及列头发布器的有限合同已完成并通过独立历史对照；ChildTable 本轮只补齐列头调用所需的当前 `control`，未把未完成的整类改造纳入提交。产品严格诊断为 56,666 条、3,340 个欠债文件，strict-clean 1,391 / 4,731；fast key 诊断 2,469，工具和语法门禁均为 0 条新增。完整规格为 202/202，专项证据见 `onlysync-recordinfo-basecolumn-20261011.md`。生产仍为 `5cf1a7bbb`，本批尚未发布。

用户目标：完成所有强类型改造，启用全 TS 严格化。本目标持续推进，局部门禁通过不是完成。

完成时需从当前文件与实际检查验证：

1. 产品及自有工具脚本的 tsconfig 正式开启 strict/noImplicitAny 等目标检查（产品含 noUncheckedIndexedAccess/exactOptionalPropertyTypes/noPropertyAccessFromIndexSignature），直接编译当前各完整程序零诊断；工具门禁目前 strict:false，不将它的语义零诊断当作严格化完成。
2. 严格类型欠债清单归零并移除豁免机制；基础语义检查不再依靠历史诊断基线放行。
3. 公共 API、缓存、JSON 及事件/Redux 边界使用准确有限模型或 unknown 验证。删除为迁移保留的 styled-components 类型下限及开放 any 结果等替代声明，使用实际依赖类型。
4. 自有产品代码的隐式/显式 any 不作为逃生口；确实开放的数据保留 unknown 并在使用前验证。真实协议假设须明确，不能用整包断言假装数据已验证。
5. 运行行为、必要的错误边界、生产构建与现有完整回归通过；用户已授权验证批次持续推送 GitHub。

2026-10-11 当前工作表筛选核心和编辑器批次已验证到：产品完整严格 CLI 57,306 条存量诊断、3,375 个欠债文件；1,340/4,715 个产品文件满足终点口径，fast 9,186 条。本批完成筛选核心及八个值编辑器、两个面板的有限合同，在 57,716 条基础上减少 410 条，按文件/错误码无新增；13 个达标文件移出名单，基线只收紧。工具完整严格 CLI 为 2,741 条，常规工具门禁零诊断。修复独立审查发现的保存回调异常和 Actions 重建后错误不清问题后，193/193 规格及全部 10 项门禁通过；实际 producer、历史对照和反例证据见 `worksheet-filter-chain-20261011.md`。此前打印选项/API 筛选的 100 条减少记录在 `print-filters-tools-20261011.md`，打印/透视表/工作表 API 的 846 条减少记录在 `print-pivot-api-20261011.md`。正式严格开关仍未全部开启；其它筛选 UI、私有组件、API 生产者、styled-components 旧 shim 与工具债务仍在，完整目标尚未完成。少数旧 codemod 显式 any 和无类型依赖可能隐藏债务，不把诊断清理等同于完成强类型。

生产当前为 7.5.0，前端已于 2026-10-11 更新到 `5cf1a7bbb`，包含既有人员搜索焦点修复；工作台、MOM 运维及 UAT 清单在已登录内部会话验收通过，详见 `production-20261011.md`。现网回滚副本保留 `9a1dd5378`，更早备份和旧 chunk 继续保留。当前 `2a927fcff` 批次尚未部署，亦未进行新的外部身份端到端验收。用户已要求每天 17:30 前更新生产，既有每日 16:45 发布任务保持 ACTIVE；未验证工作树不会发布。类型工作在 types-strict-diagnose，远端 main 按验证批次同步，两小时 GitHub 定时同步继续运行。

上游 `4790807e` 已通过 `946e9c615` 保留历史整合，该源码生产构建通过（1 分 53 秒）。本轮启动和提交前均核对了远端状态，没有新的遗漏上游提交。

本轮源码 `2a927fcff` 正式 release（1 分 50 秒）、本地 publish 和 1095 JS / 387 CSS / 3 runtime 资源校验通过。73 个顶层 HTML 的 532 个本地产物引用存在且无 dev JS；入口 revision 与源码一致，构建后工作树干净，冻结文件哈希匹配。本地候选版本已完成产物验证，仍未部署生产。

后续筛选核心/编辑器源码 `fae0befb3` 已完成正式 release（54 秒）、本地 publish 及同口径资源校验，193/193 规格与 release 类型门禁通过；44 个批次文件冻结哈希匹配、构建后工作树干净。最新本地候选入口 revision 为该源码提交；生产仍为 `5cf1a7bbb`，日常发布任务保持 ACTIVE。

本轮筛选面板、条件交互、动态值和列头发布器批次已完成 198/198 规格、全部 10 项门禁及严格诊断传播，产品严格诊断 57,306→57,028，按文件/错误码新增 0；strict 欠债 3,375→3,346，fast 9,129，工具门禁 0。完整记录在 `filter-ui-chain-20261011.md`。源码仍未部署生产。

该批源码 `3a385743f4` 已完成正式 release（55 秒）、本地 publish 和 1095 JS / 387 CSS / 3 runtime 资源校验；73 个 HTML 的 532 个资源引用存在、无 dev JS，入口 SHA256 为 `e18d3500b3224282ea81c5ff4bd6baeb8c8572cfcab19f8aff8177461b7e7db3`。生产仍为 `5cf1a7bbb`。

工具链批次 `b1347dbf6` 已推送：CI/utils、CI/generate、CI/serve、publishConfig、build、spec-harness 和 run-specs 的自有路径五开关零诊断；179/179 规格及 release 构建通过，资源为 1095 JS、387 CSS、3 runtime。全工具 strict 按诊断标题计数为 2929 条（3158 → 2929，减少 229；旧数字3391是含说明的输出行数），仍有 webpack 配置、其它脚本和既有测试 globals 等未处理债务；本批未更新生产。
