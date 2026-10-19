# 自定义动作父项与菜单强类型

BtnTd 的 props、行数据、局部状态、视图、保存载荷和菜单回调原本隐式 any，templateId 后续才加入 state 却没有声明。本批沿真实 WorksheetBtnEntity、ButtonRangeData、WorksheetView 和 Input.manualRef 建有限模型，映射可缺字段及 own undefined，保留子范围回调可返回局部按钮的实际合同。CustomBtnMoreOption 的已消费名称、状态和各回调同样明确；未用宽索引或整对象断言把局部按钮伪造成完整后端 DTO。

行为提交 **30f0cb2e8** 与类型提交 **6a08e3ed8** 分开。保存、复制、删除、停用和启用的传输拒绝新增相应失败提示，不执行成功刷新或范围保存回调。使用 then 的第二个参数处理传输拒绝，成功回调自身抛错仍保持原生拒绝，不误报请求失败；同步 API/父回调错误保留原失败前缀。重命名仍先乐观更新原列表，再保存原大小写 **EditAttrs**；范围更新仍清除旧 displayViews 并以 **editAttrs** 请求，在成功回调中替换所有匹配 ID，未改项沿原引用。没有因保存返回 false/undefined 改写原有成功回调语义。

范围标签将真实 safeParse 的结果接为 unknown，再复用实际数组容器校验，不删除未来条目、稀疏槽或未知元数据。先按原顺序读取 detail/list，执行列表 filter，再执行详情 concat/uniq/find/join；本地批量成员比较数组允许 unknown，源视图 ID 仍沿 WorksheetView 有限合同。非数组容器显式失败，属于独立行为改变；所有记录分支继续短路，不触发范围解码。未假造空数组以覆盖非法载荷。

templateId 初始仍缺少自有键，仅在原 setState 路径加入；props-change effect 仍依赖原 props，保留 effect 执行前的旧行值、原 input.focus 缺 ref 失败、空名/重名提示和聚焦顺序。颜色/图标/停用判定、菜单确认、copy alert 与 reload 的先后、delete 与启停的 truthiness、旧 captured 列表乱序保存覆盖均保留。标题缺名称的原本传参用擦除断言保留，没有新增假名称默认值。格式化后的 import 顺序位于独立行为层，不将整个行为层称为历史逐字节相同。

固定真实历史基线 **2d7ad35ee9421a2e68b5b7c184315ea574b8a945**，行/自定义菜单/共享菜单/父 List 源 SHA256 分别 **1ba8fcb1b0b8fd9b1641a3bbe1fe091ea8bf34222cac02b9b54e2fcedc405176**、**94d12dc93493114cdf4b729454c4d996b50605be57f59e98be17dbe265823f1c**、**d1f423d2d324966b06e1bc38cea496580966dfb6c9f1834e6f300f42b8c41df9**、**0048b0c7151f8f48cce6e7ce7b67ebca22eccf174ce9f4bd0d53de8f5bbff889**。BtnTd 类型层与独立行为层 Babel 全文相同，SHA256 **14c7f15d34df6fa260596cac44760acf41caa07fdfc9e851da6aacd305faf67c**；菜单类型层与历史全文相同，未编辑的 MoreOption/List 同样比较通过。

16组规格执行完整真实行、两级菜单、父 List、范围下拉、safeParse/getShowViews、lodash、实际 worksheet API 包装及真正 react-use.useSetState 实现（固定 SHA256）。覆盖完整 JSX 矩阵、native ID/扩展/重复/稀疏/NaN、原 getter/filter/concat 次序、初始缺键和 merge、副作用、重命名、范围原数组及扩展引用、父排序/分区、菜单确认、API truthiness、props effect 与乱序闭包。五条传输拒绝均有旧进程非零/新进程零的真实源码对照；两类成功回调抛错在两版均非零。保留旧 displayViews 的内存变异被保存载荷断言拦截，产品源码没有变异。

UI 叶子、hook 调度、ClickAway、Dialog 确认、input/DOM 和 mdyAPI 传输受控；未挂载真实页面、修改真实 storage、复制/启停/删除/保存生产按钮、执行打印或发消息。共享 MoreOption 和列表控制器仍有 any，本批不冒称整条父链已强类型。copy/option 响应仅按原 truthiness 消费，保持 unknown，不声称已有完整 unknown 解码器；已消费按钮模型继续沿现有有限 API DTO。

原生完整根程序私有探针证明实际组件 Props、菜单参数及 state、已知按钮/范围/嵌套 view ID 非 any；13个非法状态、ID、菜单补丁、保存字段和回调真实编译拒绝，正常探针零额外诊断。工具门禁曾拦下测试中的推断错误，修正后才计通过；初次菜单名称 optional 的真实编译诊断也已修正，完整逐文件/错误码无新增。

strict **50,808→50,783**，行17条、菜单8条清零，无其他文件新增。fast **8,416→8,413**、keys **2,269→2,268**；debt **3,070→3,068**，只移出两组件，clean **1,709/4,777**，未增加产品文件分母。baseline SHA256 **99484be7888978834a9e0ea8fd5e43e0f4be48c08ae9c1dca54904165fc72c59**、strict-debt SHA256 **e0f0b43f48c7035f63ac0ae14536bfcefce9683475d121a5c7a2edd1924043a7**；集合及每项计数均只收紧。

正式 release **274/274**、工具/后缀/语法/fast/strict 和四项编译通过；颜色/圆角/排版/JSX key、runtime **1,095 JS/387 CSS chunks**、publish 通过。两产品 ESLint 零错误，仅保留旧 props effect 的 setState 依赖警告；间距警告清理，未新增禁用或改变触发条件。原 subPathNavigation 隔离 known-failure 保留。release 与 pre-push 顺序执行。

冻结候选 **4dc5ec932bf25c7bcd91d0e8d81cedf74465f83b**，**尚未生产部署**，入口 SHA256 **a7fa9dcd426d3d352228d79e6314548d3c08811df8c7e091daaa38c896ac7cac**，包 SHA256 **181880aa966e8bc44b798095bc9c9c0225c489a7c745e266ac7bce29757efc90**，17,098文件/3元数据逐一回读通过，包261,562,697 bytes。目录 `/private/tmp/hap-btntd-4dc5ec932b-artifact-20261019/`，全部编译/行为/类型/原始失败和修正证据 `/private/tmp/hap-btntd-20261019/`。本机 publish 只整理产物，不表示生产发布；安排与后续验证批次整合按日程发布。

现网仍 **9cd5c15d0885a92ba610a45b5fe6e1dfe7b135fc**，本轮六入口/34关键资源与该冻结版清单一致；五服务运行、ID/镜像/端口/完整 Mounts、nginx全配置及当前/旧回滚入口摘要正常，upstream8360adec0实际未变，无后端升级。本轮未重复登录浏览器验收、没有远端写入或活部署作业。实测/data余 **10,398,068,736 bytes**，低于当前候选完整复制/两候选/包/4GiB及256MiB预算 **18,591,073,679 bytes**；没有上传或启动部署。当前完整快速回滚、七份实际完整恢复归档、a4c95及非completed历史链、厂商和doc四external卷保留，下一次依既有可恢复归档流程准备空间并重算预算，不降低保护。

下一批处理 CustomBtnFormSet 控制器、List/Header 及真实 refreshBtnData 必要边界：保留 abort/effect、按钮局部补丁、description 搜索、分区/排序、cloneDeep及push/map引用语义，未编辑的 SearchBox 不重复盘点。DSH Chat reducer 范围不变；全仓强类型和正式 strict 目标继续 active。
