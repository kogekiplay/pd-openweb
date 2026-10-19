# 自定义动作列表父层与真实刷新合同

CustomBtnFormSet 控制器、List、Header 的 props/state 和列表元素原为隐式 any/never[]；共享 refreshBtnData 的输入/返回也没有约束。本批沿 WorksheetInfo、FormControl、CustomButtonData 和实际按钮响应建有限合同，声明已消费的 description 搜索字段、空串/ASC/DESC 排序及实际可为 undefined 的 btnId。没有给缺 ID/名称伪造默认字符串，也没有把整个 CreateCustomBtn 编辑器宣称已强类型。

本批只有类型和规格变更：四个完整产品模块与冻结历史 **693870e1737f35457c6397a54c78270852fd28cb** 的 Babel 输出逐字节相同。控制器/List/Header/util 输出 SHA256 分别 **94e21f58269bf9d91070644b9a98d1823fc9ba1ccfd15ea3de325e929c8c368b**、**242bee62ab3a067787710c64116c2a0280b8aee0ca61dad055e1054226ed9a30**、**74adea47150d58b236fbf71979fcf2602a54be2b40875fd4975c3563d51aedaa**、**0755059e9ef83a623f265cb5afefcf689b7cb17a90ea1381c405d69beba366b1**。历史源文件均固定完整 SHA256；没有通过行归一化或输出集合比较替代全文相等。

refreshBtnData 是保留元素额外字段的泛型：添加时仍 push 输入数组并原样返回，更新时 map 替换全部匹配 ID，未改项保留引用；cloneDeep 仍在真实调用方。控制器搜索先读取 name/desc/description，再按原 String(text || '') 匹配；空搜索返回原数组。List 保留单项/批量分区、原生首字符排序和稳定并列顺序，缺 name 的原生失败继续保留。实际行的编辑/重命名回调驱动父补丁，btnId 自有键为 undefined 时仍传原空数组创建哨兵，找不到选中项仍为 undefined。

effect/getSheetBtns 保留原 abort、切换工作表时两次 abort 的次序、卸载回调、吞掉请求拒绝及旧状态；没有新增请求序号或 mounted 守卫。在传输不因 abort 拒绝的受控反例中，旧响应仍能覆盖新列表，两版一致，未将它计为已有乱序保护。CreateCustomBtn 的字段可见性（含继承字段）、真实复杂控件类型转换、template 覆盖和扩展引用不变；普通控件转换也会原样浅复制，没有误称原对象透传。

15组规格执行真实完整控制器/List/Header、实际 BtnTd 父回调、worksheet API 包装、react-use.useSetState、lodash.cloneDeep、refreshBtnData、redefineComplexControl、getFeatureStatus/getSyncLicenseInfo/getCurrentProject、projectTypes 解码和升级弹窗函数。覆盖数组/元数据/重复及缺 ID、搜索 getter 顺序、原地 push、map/clone 引用、排序与空态、创建/编辑/回收站、免费升级与付费入口、share/非法项目守卫、请求取消/拒绝/乱序等。UI 叶子、hook 调度、Dialog、网络和宿主环境受控；没有真实打印、添加/修改/删除按钮、打开付费交易、写 storage 或发送消息。

将实际 helper 的原地 push 改为复制数组的内存变异被真实引用断言拦截；最终变异证据针对行为身份，不以全文输出相等断言充当变异检查。原生完整根程序私有探针证明实际三组件 Props/state/已知嵌套 ID、控件和回调非 any、泛型保留额外元素类型；14个非法标记/ID/控件/回调/搜索/排序/字段真实编译拒绝，正常探针零额外诊断。初次未完成日志观察和错误测试假设均保留，结论只取编译终态及修正后的行为检查。

strict **50,783→50,748**，逐文件/错误码无新增：控制器10条、List16条、Header5条清零，refreshBtnData 四条清除。共享 util 其他函数仍有债，其他 Worksheet Redux/编辑器/API 消费方未冒称完成。fast **8,413/2,268 keys** 和 baseline 原字节不变，SHA256 **99484be7888978834a9e0ea8fd5e43e0f4be48c08ae9c1dca54904165fc72c59**。debt **3,068→3,065**，只移出三个父组件；clean **1,712/4,777**，没有新增产品文件。strict-debt SHA256 **0fa5994826ae394357ebc91cde1f732ed721734209acd607dce857cdaeb59f96**，集合只收紧。

正式 release **275/275**、工具/后缀/语法/fast/strict 和四项编译通过，耗时1m16s；颜色/圆角/排版/JSX key、四产品 ESLint 零错误、runtime **1,095 JS/387 CSS chunks**、publish 通过。控制器原 effect 的两个 hook 警告与历史一致，未改变函数声明位置或依赖触发，历史三个格式错误已清理；原 subPathNavigation 隔离 known-failure 保留。release 与 pre-push 顺序执行。

冻结整合候选 **1d6912c889206abce2610cd7aa15b1979163bd1d**，**尚未生产部署**，包含前一 BtnTd 候选4dc5的代码。相对现网9cd5合计减少60条 strict，相对本轮前main减少35，口径不混用。入口 SHA256 **50e19372414dc3da2612aae207f41b3ab89a4af86047a1c8cf56e677598f8c55**，包 SHA256 **7e1a544dc46871a586f1e665836dc6a9cf73cffb0c02b688863bb51b4b1658f7**，17,098文件/3元数据逐一回读通过，包261,559,482 bytes。冻结 `/private/tmp/hap-custom-button-list-1d6912c889-artifact-20261019/`，证据 `/private/tmp/hap-custom-button-list-20261019/`；旧4dc5冻结包继续保留，尚未单独部署，不能把本机 publish 混称生产发布。

现网9cd5六入口/34关键资源、五服务运行/ID/镜像/端口/完整 Mounts、nginx全配置和当前/旧回滚入口摘要复核正常。当前完整quick、七份实际完整恢复归档、a4c95/非completed旧历史链、厂商/doc四external卷保留，本轮没有远端写入或新生产UI验收。官方upstream8360adec0实际未变，无后端升级；实测/data余 **10,336,198,656 bytes** 低于当前完整复制/两候选/包/4GiB及256MiB预算 **18,591,070,464 bytes**，没有上传/部署。下一发布前按既有实际可恢复归档流程准备空间并重算预算，不降低保护。

DSH 的 **8140a387** 和10:05报告已初审，发现消息动作 result:any、整数组断言、部分已消费字段仍 unknown 及9条新增 actions 诊断，尚未验收/合入main。已通过固定目标文件授权只修必要派发/消费边界和4个真实 helper 类型声明；未授权修改既有 REMOVE_* 原地副作用，未启动新agent或发消息。后续独立审查新报告和实际提交，不把“60→0”单文件数字当全仓验收。

下一批处理 PrintSortableItem 与共享 MoreOption，保留打印和动作菜单两条真实消费链；全仓强类型/正式strict目标仍 active。
