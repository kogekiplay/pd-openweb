# 公开表单配置 Redux 强类型

公开表单配置原先从默认 ReduxAction 的 any 载荷推导状态，六个状态字段及其元素没有有效约束。整合协作方 16 个提交后，lead 又校正了生成 DTO 的缺省值、隐藏字段批量参数及生产方约束。上海时间 **2026-10-17 17:29:21** 已完成生产切换，revision **3b0ff2ea0c80ecd07b87dd1f6e8d2b57d9538696**。

`worksheetInfo` 和 `worksheetSettings` 按真实生成 DTO 派生，保留 `_.pick` 对显式 undefined 自有键的复制。`extendDatas` 保留接口字符串映射，局部声明已知 shareConfig；不通过整对象断言隐藏形状。隐藏字段 ID 允许源控件缺失 ID 时的 undefined，hideControl 同时接受组件实际传入的单 ID 和 ID 数组。同步 dispatch、加载映射和 clear 都通过同一判别联合检查，公开更新参数从该联合派生。新动作有实际泛型约束检查。

加载动作原样透传可缺失的 controls，类型保留 undefined。真实 Redux store 会拒绝该子状态并保留原根引用，因此读取已装配 store 的 thunk 使用的非空断言有直接运行证据；没有用空数组替换原失败路径。originalControls 保留原生 map 表达式，恢复协作实现中手工异常和缓存 URL 属性值改变的行为：null/undefined 的异常信息、先发生的扩展数据修改及 getter 读取次数均与历史基线相同。

范围外 getDisabledControls/getNotSupportControlIds 在真实函数边界标注 FormControl 和生成设置类型，去除调用处数组断言。有限常量数组的 includes 用真实 lodash includes 表达相同查找语义；缺失值和原有顺序保留。Node 子进程夹具移至 scripts/spec-fixtures/publicWorksheetRefreshFailure.ts，由已有 tools 零容忍门禁检查；没有增加产品排除项。旧 CustomPage 协作树专用 helper 没有引入 main。

独立行为修复：刷新分享 URL 接口拒绝时显示本地“刷新失败”错误提示，不派发成功 URL、不显示成功提示；成功调用参数、提示/dispatch 顺序和 thunk 原返回协议不变。保留协作方该独立修复及其旧拒绝子进程证据；没有真实刷新生产公开链接或调用保存接口。SHOW_CONTROL 误删否定和 getDispatchData 默认参数的协作回归已连同修正一并整合。

## 验证

- 真实历史 A/B 基线 `3f768fdd2603727b9ba11c0c579a6d58c4d8283a`，实际核验模块 SHA；真实 lodash/Redux/RTK，helper 从实际声明抽取。16 项 reducer、25 项 thunk、8 项单切片 store、7 项真实根装配，共 56 项检查；根装配的兄弟切片为替身，不称完整业务组件渲染。
- 新增原生 null/undefined map 异常及副作用、缺字段/显式 undefined、批量隐藏、URL getter 读取次数和 Redux 拒绝未定义子状态的对照。行为比较用 deepEqual/Object.is，保留引用与非 JSON 值。未处理拒绝、未到汇总均非零退出。
- 范围外两个 helper 另从 `9a2ef96d0` 与当前源码抽取真实声明，注入实际 RELATION_SEARCH_SHOW_TYPE 常量，完成 **4,860 组**历史对照，包括 type 51、缺失 ID、系统映射、权限串及 NaN，全部一致。原 thunk 规格使用的是当前 helper，不能把它冒充这部分历史对照。
- 真实终点编译：RootState 六字段、元素、controlId/type/advancedSetting、设置/信息全部已知键非 any，状态双向兼容；14 个非法使用均拒绝。对当前动作联合实际增加 UNHANDLED_CASE 的副本，约束产生 TS2344。取证文件位于私有临时目录，不计入产品文件分母。
- strict **51,154 → 51,101**，按文件/错误码无新增，Redux 范围零诊断；strict-debt **3,087 → 3,085**，移出 actions/reducers；clean **1,685/4,770**。fast **8,499/2,287 keys → 8,492/2,284 keys**。两个 JSON 的集合/多重集均只收紧。
- 正式 release **265/265** 规格、后缀/工具/语法/非增量 fast/strict 门禁与四项编译通过，保留原 subPathNavigation 隔离 known-failure。颜色、圆角、排版、JSX key 审计通过；runtime 资源校验通过（1,095 JS、387 CSS chunks），publish 通过。没有并行运行 release 与 pre-push。

证据 `/private/tmp/hap-publicworksheet-review-20261017/`，冻结包与逐文件清单 `/private/tmp/hap-publicworksheet-artifact-20261017/`。最初外置编译探针的 rootDir/Node 类型解析配置失败保留；修正探针配置后才确认上述类型证据，不把失败日志当作通过。全仓强类型和正式 strict 目标仍未完成。

## 生产与回滚

入口 SHA256 **c1fc76897474252c36b31984487d2b989d483900171e43387e7cd333e6d115c8**，冻结包 SHA256 **fc39fd702dd90a084f2805764aefeffeac841cab69b81aa5923b9324c018d249**。完整包逐条读取校验 17,098 文件及三项元数据，上传暂存、切换候选及现网又按完整清单核验。公网六入口、34 项资源均符合冻结候选；PM 两项代理资源仍为 200/0 bytes，摘要与前版一致。

当前 release `/data/mingdao/frontend-3b0ff2ea0c-20261017/`，完整快速回滚 `/usr/local/MDPrivateDeployment/www-prev-20261017-3b0ff2ea0c` 对应原 e494，入口 SHA256 **2602fc10dbfa52f9000c6715786e7188be4f6674f307fbd4dd1837c41b34e4c6**，17,098 原候选文件逐项复核全部匹配，rollback.sh 语法通过。原更早 e494 标签回滚未变。五容器身份/镜像/端口/完整 Mounts、nginx 全配置摘要均与切换前相同；后端 7.5.1、文档服务四 external 卷、厂商资源与旧恢复链保留。

发布前将更旧 `www-prev-20261017-2e255b9686` 完整归档：81,473 条目 tar compare 通过，原清单稳定、包与恢复脚本持久保存后才释放旧目录，再独立重读全部归档成员，81,266 普通文件 SHA 校验通过。包 SHA256 **498a99ed8e0297a8bf54ad4c85360b29e5741aa4ad571da686b961c145be4fa6**，逐成员清单 SHA256 **b330d41079238b16ede41dcef4398279841738e5aa3c758c10509392e7499c89**；材料位于 `/data/mingdao/hap-frontends-publicworksheet-20261017/`。旧 2e staging 按完整原包/元数据/17,098 文件校验后释放重复树，保留包与 restore-staging.sh。始终保护当时 e494 生产及其快速回滚。

上传前可用 19,096,563,712 bytes，高于完整复制、上传/解包、覆盖余量与 4 GiB 预留的预算 18,524,714,386 bytes；解包后 18,151,415,808 bytes，高于部署预算 17,625,762,630 bytes。切换后复核可用 **5,674,319,872 bytes**，未降低预留。下一次复制或大归档均须重新核算预算。归档与部署作业均已终态 returncode 0，没有通过状态文件推测存活或观察超时就重启。

已登录 1280×720 只读验收：MOM 数值卡、材质图、库位图与 2,036 库位计数正常；ERP 工作台与四项常用导航正常；两页 DOM revision 为本版，console warn/error 均 0。既有“盘具构成·新旧”后端维度失效仍单列、不计通过项。没有保存记录/配置、发送消息、刷新公开链接或执行工作台按钮；本次未设置 viewport override，测试页已关闭。生产证据 `/private/tmp/hap-production-3b0ff2ea0-20261017/`，远端作业 `/data/mingdao/hap-storage-publicworksheet-20261017/`。正式 release 结束后才普通 push，未并行运行两者。
