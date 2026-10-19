# 打印模板行与共享菜单强类型

PrintSortableItem 和 MoreOption 的 props/回调原为隐式 any 或 Component<any,any>。本批沿真实 PrintListModel、PrintRangeData、WorksheetInfo、FilterWireItem、打印次数接口和 SortableDragHandle 建有限合同，明确可缺 ID/视图名称、云打印 fieldKey/value、筛选载荷及局部对话框补丁。共享菜单 setFn 始终携带 showMoreOption；复制补丁不携带 isRename，打印行仍把该状态写成原有 undefined，没有假造 false。

类型提交 **851af84d3** 与欠债收紧 **8c4e64ab2** 不改产品运行时代码。打印行、共享菜单、打印父控制器及 record 四个完整模块的 Babel 输出与冻结历史 **15dc6948ded42d93f0f8229ee19dbe66a53623fb** 逐字节相同，输出 SHA256 分别 **536e96bebff065bddb63d570fcbde7cff8d5b9e95dbd1bbf8fe53ea545b9bf3d**、**d736e0a648a9477342a504b9c5b1ae68f80679ff3c77e011d8ad23d42c38782d**、**9eabf2a45b59f4cd317364ed8a72e8a60f0db7d174c9115b77bf824cf69d60ef**、**5301bc1d901b4a2be4dcae81a83f8850dbf06061765674287993cc1de5d5ebee**。不以行归一化、行集合或样例相等替代全文证明。

打印父层只收紧 loadPrint 的已消费参数、补齐次数回调可缺模板 ID，以及固定 useDragHandle=true 路径的擦除标记；整个父控制器仍有29条债，未宣称完成。sendCloudPrint 的原始转发接受调用方实际传入的 own undefined ID 及 rowIds 中的 undefined 槽，不制造默认 ID/字符串或丢弃槽。云参数的 value 只覆写不解码，保留 unknown；已消费 fieldKey 明确为字符串，没有新增整对象/整数组断言或 any 逃生口。

14组真实完整行/菜单规格覆盖全部模板类型、范围/视图旧名称、缺视图原生失败、编辑/预览/云打印/二维码路径、重命名与空名焦点、云参数 cloneDeep/首个 name 字段/原数组和扩展、复制提示关闭后刷新、删除确认、真实 RangeDrop 父更新及 dirty 标记重复保存、递归筛选 display/formatter 及混合已删除项不剪裁、次数 null/0/升级和父 Promise 返回身份、props 变化、缺 ref 原失败、云打印缺 ID/槽/51条拒绝等。

执行真实 worksheet API 包装、lodash、打印枚举和卡片信息、真实 sendCloudPrint、原过滤规格的真实模块依赖设置（固定完整 SHA）、filterData/formatValuesOfCondition/redefineComplexControl；没有复制打印/筛选算法。React 调度、UI/DragHandle/ClickAway、jQuery/DOM、选记录弹窗、次数弹窗、二维码挂载、云打印策略/升级宿主及 mdyAPI 传输受控。没有挂载真实打印页面、保存配置、打印/上传/绑定云打印、删除模板或发消息。

六种旧异常（五类请求拒绝及云参数缺 name 的原生失败）在旧新版本分别发出相同真实 unhandledRejection。每版独立进程复用编译宿主，逐项验证事件数量、原生类型和消息，汇总后仍非零退出，父规格检查完整六项及两版一致；没有通过增加生产 catch 或伪造 TypeError 文本“修复”旧路径。它们是已知保留风险，不能把本批称为请求失败处理已完善。菜单 stopPropagation/关菜单/复制次序的内存变异被已有真实 helper 规格拦截。

原生完整产品程序的私有正负探针证明实际组件/ClickAway 对外 Props、模板/视图/筛选 ID、菜单和本地回调非 any；云 value 为 opaque unknown，rowIds 为有限 primitive 槽。14项非法字段/ID/标记/筛选/计数/组件/回调实际编译拒绝，正常探针零额外诊断。状态沿有限 props/初值或明确 boolean|undefined 建模，不用返回注解把输入 any 藏起来。

strict **50,748→50,727**，逐文件/错误码无新增：共享菜单4条、打印行14条清零，AIAction/FormIndexSetting回调各1条及 MobilePrintList 的真实 own undefined 合同另减少1条。fast **8,413/2,268keys** 和 baseline 原字节不变，SHA256 **99484be7888978834a9e0ea8fd5e43e0f4be48c08ae9c1dca54904165fc72c59**。debt **3,065→3,063**，只移出行/菜单，clean **1,714/4,777**，没有新增产品文件；strict-debt SHA256 **3a7e395cf1628ec982283c819beea2b9ffb69bab39f84d6667d4f19af2761d0e**。相对现网9cd5，整合待发代码合计减少81条，与本轮21条区分。

第一轮正式 release 被已有 SearchInput 的真实墙钟防抖规格拦下（275/276）：并行负载会让10ms等待超过20ms门槛。独立测试提交 **6e92308ef** 改为 Node 逻辑 Date/setTimeout，直接检查19ms不触发、20ms只触发末次输入、回车立即触发且取消、切换视图取消及卸载取消，finally恢复时钟；延迟改0和删除 cancel 的两种内存变异均被真实断言拒绝。没有修改 SearchInput 产品代码、加长等待或放宽断言。

第二轮被打印规格重复初始化十二个异常子进程的耗时拦下（275/276）。独立测试提交 **6d0f4ec00** 每个版本复用一个异常宿主，保留六种真实异常事件/类型/消息/非零退出及两版对照，没有提高 runner 超时或减少覆盖。两份失败日志及后续通过日志全部保留。

最终正式 release **276/276**、工具/后缀/语法/fast/strict 及四项编译通过，耗时1m57s；颜色/圆角/排版/JSX key、runtime **1,095 JS/387 CSS chunks**、publish通过。原 subPathNavigation 隔离 known-failure 保留。MoreOption ESLint零错误；PrintSortableItem 的一个历史 no-useless-assignment（params={}）原样保留以保证全文擦除相同，旧间距警告清理，没有新增 lint 错误或禁用。release 与 pre-push 顺序执行。

冻结整合候选 **6d0f4ec004dd4b9cce1a4ee80104191426e916f3**，**尚未生产部署**，包含原1d691/4dc5待发代码及两项测试修正。入口 SHA256 **5fda1c930734e45bbde1ce2fda6c3587d46c2ef66a64d2c332386dbaa41591e4**，包 SHA256 **bc2c7ab3797ef1030fe26b231330c6166980c90c7cdedec12ea52b063adac81e**，17,098文件/3元数据逐一回读通过，包261,563,839 bytes。冻结 `/private/tmp/hap-print-item-6d0f4ec004-artifact-20261019/`，证据 `/private/tmp/hap-print-item-20261019/`；所有旧冻结包/证据保留，不将本机 publish 称作上线。

现网仍9cd5，六入口/34关键资源、服务身份/运行/端口/完整 Mounts、nginx全配置与当前/旧回滚入口摘要复核正常；本轮没有远端写入或重新登录UI验收。当前完整quick、七份实际完整恢复归档、a4c95/非completed历史链及厂商/doc四external卷保留。实测/data余 **10,337,128,448 bytes**，低于本候选完整复制/两候选/包/4GiB及256MiB预算 **18,591,074,821 bytes**；没有上传或部署，下次按既有实际可恢复归档流程准备空间并重算预算。官方upstream8360adec0未变，无后端升级。

DSH 的 a4b8e8864/后续注释报告已二次初审，仍见新增 bottomList:any、模拟原生 TypeError 文案及未充分证明的 concat 重写，不因40规格/四门禁绿而合入。已在固定目标给出具体修正，actions/helper有限授权与私有探针方案持续有效，不需用户重复决定；协作源码和报告没有被 lead 覆盖。下一批完成 Print/index.tsx 的打印控制器和次数抽屉，全仓强类型/正式strict目标仍 active。
