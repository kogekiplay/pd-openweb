# 公开表单配置 Redux 强类型

公开表单配置原先从默认 ReduxAction 的 any 载荷推导状态，六个状态字段及其元素没有有效约束。整合协作方 16 个提交后，lead 又校正了生成 DTO 的缺省值、隐藏字段批量参数及生产方约束。冻结构建 revision 为 `3b0ff2ea0`；生产发布状态在本记录后续更新。

`worksheetInfo` 和 `worksheetSettings` 按真实生成 DTO 派生，保留 `_.pick` 对显式 undefined 自有键的复制。`extendDatas` 保留接口字符串映射，局部声明已知 shareConfig；不通过整对象断言隐藏形状。隐藏字段 ID 允许源控件缺失 ID 时的 undefined，hideControl 同时接受组件实际传入的单 ID 和 ID 数组。同步 dispatch、加载映射和 clear 都通过同一判别联合检查，公开更新参数从该联合派生。新动作有实际泛型约束检查。

加载动作原样透传可缺失的 controls，类型保留 undefined。真实 Redux store 会拒绝该子状态并保留原根引用，因此读取已装配 store 的 thunk 使用的非空断言有直接运行证据；没有用空数组替换原失败路径。originalControls 保留原生 map 表达式，恢复协作实现中手工异常和缓存 URL 属性值改变的行为：null/undefined 的异常信息、先发生的扩展数据修改及 getter 读取次数均与历史基线相同。

范围外 getDisabledControls/getNotSupportControlIds 在真实函数边界标注 FormControl 和生成设置类型，去除调用处数组断言。有限常量数组的 includes 用真实 lodash includes 表达相同查找语义；缺失值和原有顺序保留。Node 子进程夹具移至 scripts/spec-fixtures/publicWorksheetRefreshFailure.ts，由已有 tools 零容忍门禁检查；没有增加产品排除项。旧 CustomPage 协作树专用 helper 没有引入 main。

独立行为修复：刷新分享 URL 接口拒绝时显示本地“刷新失败”错误提示，不派发成功 URL、不显示成功提示；成功调用参数、提示/dispatch 顺序和 thunk 原返回协议不变。保留协作方该独立修复及其旧拒绝子进程证据；没有真实刷新生产公开链接或调用保存接口。SHOW_CONTROL 误删否定和 getDispatchData 默认参数的协作回归已连同修正一并整合。

## 验证

- 真实历史 A/B 基线 `3f768fdd2603727b9ba11c0c579a6d58c4d8283a`，实际核验模块 SHA；真实 lodash/Redux/RTK，helper 从实际声明抽取。16 项 reducer、25 项 thunk、8 项单切片 store、7 项真实根装配，共 56 项检查；根装配的兄弟切片为替身，不称完整业务组件渲染。
- 新增原生 null/undefined map 异常及副作用、缺字段/显式 undefined、批量隐藏、URL getter 读取次数和 Redux 拒绝未定义子状态的对照。行为比较用 deepEqual/Object.is，保留引用与非 JSON 值。未处理拒绝、未到汇总均非零退出。
- 真实终点编译：RootState 六字段、元素、controlId/type/advancedSetting、设置/信息全部已知键非 any，状态双向兼容；14 个非法使用均拒绝。对当前动作联合实际增加 UNHANDLED_CASE 的副本，约束产生 TS2344。取证文件位于私有临时目录，不计入产品文件分母。
- strict **51,154 → 51,101**，按文件/错误码无新增，Redux 范围零诊断；strict-debt **3,087 → 3,085**，移出 actions/reducers；clean **1,685/4,770**。fast **8,499/2,287 keys → 8,492/2,284 keys**。两个 JSON 的集合/多重集均只收紧。
- 正式 release **265/265** 规格、后缀/工具/语法/非增量 fast/strict 门禁与四项编译通过，保留原 subPathNavigation 隔离 known-failure。颜色、圆角、排版、JSX key 审计通过；runtime 资源校验通过（1,095 JS、387 CSS chunks），publish 通过。没有并行运行 release 与 pre-push。

证据 `/private/tmp/hap-publicworksheet-review-20261017/`，冻结包与逐文件清单 `/private/tmp/hap-publicworksheet-artifact-20261017/`。最初外置编译探针的 rootDir/Node 类型解析配置失败保留；修正探针配置后才确认上述类型证据，不把失败日志当作通过。全仓强类型和正式 strict 目标仍未完成。
