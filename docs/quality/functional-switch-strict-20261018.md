# 功能开关、范围设置与旧系统编号边界

FunctionalSwitch 原 props/state、批量编辑载荷和弹窗字段存在隐式 any/空对象推断；Range 的真实 props/DOM 引用、系统编号检查列表也未建模。本批按实际 WorksheetInfo、SwitchConfigDto 和 UI 生产方建有限模型，保留前端统计总开关 type500、未知数字标记、可缺失视图 ID 和局部空 showData；未断言成完整后端 DTO 或用宽索引 state 绕过检查。

行为修复 **f4c030370** 与类型提交 **1042d8721** 分开。主组件 getSwitch 继续使用已有有限生成 DTO，保留先展开响应再 filter 计算统计状态和追加500的原顺序；加载拒绝/原生结构错误新增失败重试，批量保存拒绝告警。成功路径仍按原 captured info 保留不匹配项，再 push 完整 switchList；统计500仍从后端请求中排除，批量/统计总开关的 pick 分支仍仅复制四字段，未改子项仍直接透传原引用/扩展。不修复旧响应乱序覆盖语义，也未以默认对象掩盖 find 缺项的原生失败。

Range 的 ClickAway 对外 props、视图范围/角色/流转图回调和实际 DOM 引用均明确。取消勾选仍通过真实 lodash.pull 原地修改 viewIds，再沿父回调保存；缺失 viewId 可以进入数组，role 选择0/100、流转图0/1按真实按钮建模。定位仍走原计时器/resize/容器查询，缺失 chat 的原生错误和缺失 top 的原算术行为保留，不假设总有 DOM 或默默提供默认尺寸。

旧系统编号的 workflow 响应在实际 then 边界接 unknown，验证实际使用的 name/flowNodes，保留数组/条目/节点引用及所有扩展。验证会额外读取已知字段，不能称任意 getter 的读取次数与旧代码相同；未知扩展不提前读取。错误或拒绝不会被当成“未使用该字段”的成功空列表，而会恢复检查状态并提示失败。删除响应的 data 字段仅按原 truthiness 消费，保持 unknown，不伪造为已完全解码的布尔 wrapper；成功告警→delCallback→onClose、false响应和同步异常前缀保留，拒绝新增失败提示且不关闭弹窗。

safeLocalStorageSetItem 的实际生产方会传 null，声明已允许该值。两个真正的转发实现只增加擦除的 tuple 标记，仍把原参数交给浏览器 WebIDL 做 DOMString 转换，没有改成 removeItem 或应用层字符串转换。WorksheetInfo.closeAutoID 来自真实 DTO。原本状态为 loading 时的重复检查、初始 worksheetId 存入 state 后的旧 props-change 行为、确认框和范围关闭告警时序均保留，不在类型清理中偷改。

类型层的主组件/删除弹窗与各自行为修复层 Babel 全文逐字节相同，SHA256分别为 **d78c4991822f6f76bcc5e447500f457866182085fb44278c124cc3e6fee2a8ea**、**7270bf2cba1454632b8108b258195b01ed2be9307416d4de9b53aa5be044d4ec**；Range/config/WorksheetInfo声明/两个存储转发实现与历史输出一致。主组件中为保留原数值或空字符串 includes 语义增加有限数组别名/helper，此实现已在历史对照中检查，不称整个行为修复与旧源全文一致。

## 验证

- 冻结完整历史基线 **4e470d710c554cfc9f1d2e917dfde10e7b54c133**。主组件/Range/删除弹窗源 SHA256 分别为 **82fb54846afa51a328d8948c097d6e91688d24618ae91b74c6c14ad948dcc8fb**、**a7d0e979e3a8627aa4e797bce4e750826f609f1f8f390ad9e5073675eddfd26c**、**66c7063e0324b1befa32c572c865fdf9018bc0ac3b90b7dcf8baa0334034c035**。
- 17组检查执行完整真实组件模块、实际配置、lodash、worksheet/workflow API包装、workflow base 和实际存储辅助函数。主组件仅插入测试观察钩子以获取原函数闭包，没有复制 edit/范围算法。覆盖普通/全部批量与统计组合、pick字段、500过滤、顺序/重复/引用/扩展、反向完成、确认框锁定、范围坐标/关闭告警、真实Range与父回调组合、pull原地修改、偏好转发、autoID显隐/检查/删除、嵌套工作流名称和失败路径。
- 四类请求拒绝均有真实旧源码子进程非零与新源码零退出反例；不再过滤统计500的内存变异被真实请求断言拦截，产品源码未变。UI/ClickAway包装、hook调度、DOM/计时器/存储、jQuery宿主和mdyAPI传输为受控替身；没有挂载真实页面、修改真实 localStorage、执行确认框权限变更或删除生产系统编号。Range宿主定位/事件测试不代表全浏览器布局验收。
- 原生完整根程序私有编译探针证明实际主/Range/删除 props、已知 state/条目/位置/ID/工作流节点非 any，usage入参和删除data结果为 unknown，统计500及缺失ID如实建模；12个非法值/回调/标记/节点/存储载荷真实拒绝，fixture零诊断。新夹具动态配置导出的声明缺口被工具门禁拦下后补齐，后续才计入通过。
- strict **50,941→50,856**，逐文件/错误码无新增：主54条、Range25条、删除弹窗5条清零，nullable存储合同另减少createTask1条。fast **8,439→8,416**、keys **2,271→2,269**；debt **3,075→3,072**，仅移出这三个实际组件，clean **1,704/4,776**，未增加产品文件分母。baseline SHA256 **b4e4bc266026934be8cc2df4301d2bfd42b6490236cd90e87f97e961b5bff978**，strict-debt SHA256 **ba76ca06b4a93bb303cc422a3dfdddbb6b7febbf2c514fb29203426b54a59de6**，集合与每项计数只收紧。
- 正式 release **272/272**、全部门禁与四项编译通过，耗时1m4s；颜色/圆角/排版/JSX key、五产品文件 ESLint零错误、runtime **1,095 JS/387 CSS chunks**、publish通过。旧主组件的 getSwitchData hook依赖警告保留一条，未改变请求触发或新增禁用；间距警告清理，原 subPathNavigation 隔离 known-failure保留。release/pre-push顺序执行。

冻结整合构建 **fbaa6cbfb059a5986cda13e64755266641d823d3**，包含原FormSet入口候选ff0e13c7e。入口SHA256 **15bed1f20441f16dae77833db0b0c6343dd110de9d90c313010abe53722f9ff4**，包SHA256 **2414df9eae874b9570ee549464fdf128373ac391860526771cd21bdd395ab036**，17,098文件/三元数据逐条读取通过，包261,560,515bytes。材料 `/private/tmp/hap-functional-switch-fbaa6cbfb0-artifact-20261018/`，原始证据 `/private/tmp/hap-functional-switch-20261018/`；冻结本身不表示已部署，最终以独立生产验证为准。

发布前现网仍6a6f6defe7，六入口/34资源复核健康。本轮按既有流程准备完整归档一份不活动da标签旧回滚，只有实际全恢复/全文件/元数据通过后才释放重复树，再以实时完整预算发布；当前生产/完整快速回滚、a4c95、厂商和文档四外部卷、其他历史恢复链保留，不降低4GiB或门禁。下一批处理打印/动作范围下拉RangeDrop和BtnRangeDrop（8/12条），全仓目标继续active。


## 整合生产发布结果

上海时间 **2026-10-18T02:49:17.814138+08:00** 完成生产切换，revision **fbaa6cbfb059a5986cda13e64755266641d823d3**，包含上一FormSet入口候选ff0e13c7e；旧ff0包未单独部署、代码已随本版上线。相对原6a生产 strict **50,955→50,856**（减少99），相对上一main减少85，两种口径不混算。公网六入口/34资源、现网及完整快速回滚各17,098文件全部匹配。五服务ID/镜像/端口/完整Mounts/nginx全配置SHA不变，后端7.5.1、doc2.1.0四external卷和厂商资源保留；PM两资源仍200/0bytes/SHA e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855。upstream8360adec0实际无更新，无后端升级。

当前release **/data/mingdao/frontend-fbaa6cbfb0-20261018/**，完整快速回滚 **/usr/local/MDPrivateDeployment/www-prev-20261018-fbaa6cbfb0** 含原6a，入口SHA **04ac80a75b49ce55ea8bbbf8684814bca072abf92f235865ba2af07c9ff19b0a**，rollback.sh语法通过；旧6a标签回滚仍含ae且摘要未变，a4c95/未完成旧批/其他历史恢复链保留。

旧不活动www-prev-20261017-da815a95e4全程持有生产锁完整流式归档至 **/Users/kogeki/dev/HAP-release-archives/20261017/**，81,625条目/81,418文件，经独立成员SHA、回传tar compare、实际完整恢复、每文件SHA和元数据验证后才释放验证过的重复树。receipt.phase=offloaded/restorationVerified=true，包SHA **367780639b7ddeb6a3de42164bcbc10c8ee3b39f1d8b5fc7f9bf87f79374842f**，成员清单SHA **52ed0b2267f40c6abd2f3dabb7fafa188959cb538a52ac945db35467188fb166**，逐文件清单SHA **f63290c03f6bbe60a3a7f3ebd76cec1ede908b513d46de12fb35621d11046416**。与3b/e494/23358/63d/c1共六份包/收据/清单/恢复脚本/固定工具/README和失败记录全保留，服务器索引/data/mingdao/hap-offloaded-rollbacks/。原tree raw守卫和文件大小/权限/mtime/类型/名称/UID/GID/link/tar检查不放宽，恢复投影仅排除目录物理allocation。

上传前 **24994648064bytes** 高于完整预算 **18584381937**；解包后 **24049401856** 高于部署预算 **17685418135**，保留4GiB。发布后/data余 **11553378304bytes**，下一版重新预算。当前生产/完整quick始终在服务器；归档/恢复/上传/部署全部终态，无活作业，未因观察超时重复启动。pre-push/release顺序执行。

1280×720已登录只读验收保存真正切换前后截图：MOM数值卡/库位2,036、ERP工作台四常用导航正常，两页DOM fbaa版本、console warn/error均0；无viewport override，临时页已关闭。未保存业务记录/配置/权限、刷新公开链接、上传、执行业务按钮、删除系统编号或发消息。真实开关/范围/自动编号删除/微信/上传写接口未验收，既有“盘具构成·新旧”后端缺维度仍不计通过项。

完整生产证据 **/private/tmp/hap-production-functional-fbaa6cbfb0-20261018/** 含该冻结版http-verify-frozen.py、上传预算/包与逐文件校验、前后截图/DOM、完整远端终态记录。冻结artifact.json的false保持原样，实际部署以新verification/phase/job/线上revision和SHA为准。下一批打印/动作范围下拉，完整全仓强类型/正式strict仍active。
