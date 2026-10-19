# 打印设置控制器与创建抽屉强类型

Print 控制器和 CreatePrintDrawer 原为 Component<any,any>，state、列表、排序与子组件补丁均未建模。本批按 PrintItemData、WorksheetInfo、FormControl、实际打印列表及编辑/预览/新建模式声明有限 props/state/回调；templateId/name/previewRowId 的可缺值和后增自有键保留。exampleData 由父层原样透传，保持 opaque unknown；整合服务响应只消费长度、元素保持 unknown，没有宣称完整响应解码或整个编辑/云打印子组件已强类型。

类型提交 **da5fe0cfc** 与欠债收紧 **6e7cd5342** 不改变产品运行时代码。Print/index、PrintCountSetting 和 API 声明三个完整模块与冻结历史 **51e39c44ba29ab03009b67996f38fff59cb48c2c** 的 Babel 输出逐字节相同，SHA256 分别 **9eabf2a45b59f4cd317364ed8a72e8a60f0db7d174c9115b77bf824cf69d60ef**、**ceb2455abb777efa817856d658b79371ebc66b22898c665155b39508e4cad0c9**、**5ecf2f4d83e6260dabd6ec48e76d8ddebccf956563f34072221bf960d3b8c255**。React 的局部 setState 补丁通过擦除的有限 Partial<State> 重载声明，不用整对象 as、宽索引或默认值转换状态。

真实后端 WorksheetFilterSort 的 boolean isGroup 改为 true/false 两支类型，保留同一布尔取值集；原字段/递归 groupFilters 不变，dynamicSource 以真实 DefaultSourceModel 的字段映射保留结构，供有限筛选条件合同消费。没有添加 any/unknown 索引来掩盖已知字段。PrintCountWorksheetInfo 的 ID 补齐真实父层传入的 absent/own undefined；请求仍传原值，不伪造空字符串或过滤缺失槽。

16组规格执行真实完整 Print 控制器、创建抽屉、次数设置卡、PrintSortableItem 回调、worksheet/systemIntegration API 包装、lodash、打印枚举，以及既有真实 feature/projectTypes/升级函数。覆盖挂载请求次序和 loading、列表原引用与 own undefined、旧响应覆盖、类型分组和计数、更新每项均浅复制及重复/缺 ID、排序真/假响应的原快照与 deep clone、499/500上限、创建抽屉代码回调先于关闭/海外隐藏/项目兜底、Word/Excel权限升级、绑定完成、二维码原controls引用、编辑/云/系统弹窗哨兵和关闭刷新、真实子行范围补丁、次数 null/0/previousCount 与 Promise、统计卡并发守卫/成功合并/失败回退/props effect 等。

三种既有请求拒绝（列表/排序/整合状态）分别在旧新版本的独立进程内发出真实 unhandledRejection，检查完整事件数/原生类型与消息，两版均非零退出；没有模拟 TypeError 或新增生产 catch，把旧异常伪称已修复。取消/卸载没有原本不存在的新守卫，旧乱序覆盖依照历史保留。排序失败不 deep clone 的内存变异被实际状态/元素引用断言拦截，产品代码未被变异。

UI/SortableList/抽屉/编辑器、React setState/hook调度、二维码挂载、绑定弹窗和 mdyAPI 传输受控；真实功能函数和父回调原文执行。没有实际打印、绑定凭据、保存生产模板/次数偏好、上传或发消息。类宿主以原浅合并方式同步执行 setState，不称真实 React 挂载/浏览器布局验收；复制引用/顺序/异常对照不等于全产品UI覆盖。

原生完整产品程序私有探针检查实际 InstanceType<Print>.state、ComponentProps、创建抽屉、列表/筛选/ID/更新回调非 any，unknown editor 数据不可被当字符串，真实 Wire Print DTO 可赋给行模型。14项非法状态/ID/排序/模式/次数/回调/筛选标记实际编译拒绝，有限 setState 重载不能写任意键或错误布尔值；正常探针零额外诊断。初次探针仅自身 unused import 失败，移除后重新完整编译，失败日志保留。

strict **50,727→50,698**，逐文件/错误码无新增，全部29条来自 Print/index.tsx 清零；shared DTO/次数卡合同没有增加消费方诊断。fast **8,413/2,268keys** 与 baseline 原字节不变，SHA256 **99484be7888978834a9e0ea8fd5e43e0f4be48c08ae9c1dca54904165fc72c59**。debt **3,063→3,062**，只移出实际控制器，clean **1,715/4,777**，无新增产品文件；strict-debt SHA256 **92b3c628fb2de8108892e08d27ac53a44ca10c0e373931fce4a0aed52f18de0e**。相对生产9cd5累计待发代码 strict50,808→50,698，减少110，与本轮29区分。

正式 release **277/277**、工具/后缀/语法/fast/strict 及四项编译通过，耗时1m38s；颜色/圆角/排版/JSX key、控制器/次数卡 ESLint 零错误警告、runtime **1,095 JS/387 CSS chunks**、publish 通过。历史间距警告清理，原 subPathNavigation 隔离 known-failure保留；前批已修的墙钟防抖与异常宿主复用继续通过，未增加禁用或放宽门禁。release/pre-push 顺序执行。

冻结候选 **6e7cd534295f0c9eda6f38ea4d09218957ec71e7**，**尚未生产部署**，整合原6d0f/1d691/4dc5待发代码；旧包均未单独部署且证据保留。入口 SHA256 **c098ec2e146297835a10005423212b3402930d973fced9c9b8ebb7eaadb91b3f**，包 SHA256 **77f41ec301c537cc6fdc568d3e4e9a5c08a609e729c7a9952311d66b07819243**，17,098文件/3元数据逐一回读通过，包261,563,657 bytes。冻结 `/private/tmp/hap-print-controller-6e7cd53429-artifact-20261019/`，原始编译/行为/探针/失败与变异证据 `/private/tmp/hap-print-controller-20261019/`。本机 publish 只是整理产物。

现网仍9cd5，六入口/34资源复核健康；本轮没有远端写入/上传/部署或新登录UI验收，完整quick原fbaa、七份实际完整恢复归档/a4c95/非completed历史/厂商/doc四external卷保留。实测/data余 **10,358,362,112 bytes**，低于完整复制/两候选/包/4GiB及256MiB预算 **18,591,074,639 bytes**，没有上传或触发部署。下一次依既有实际可恢复归档准备空间并重算预算，不能用本机构建清单代替现网9cd5清单；上游8360adec0未变，无后端升级。

Chat 协作最新报告和提交继续独立复核，恢复原表达式及“手写 ChatState非any”不替代实际 RootState.chat/已消费嵌套字段/行为/类型/全仓门禁证据，不因规格数或局部绿灯提前合入。下一批处理 CloudPrint 字段映射的真实 unknown JSON/动态字段边界和有限状态；全仓强类型/正式strict目标仍 active。
