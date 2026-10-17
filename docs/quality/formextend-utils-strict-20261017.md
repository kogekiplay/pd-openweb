# 公开表单工具层严格检查

清除 `src/pages/FormExtend/utils.tsx` 的剩余 15 条终点诊断，补充时间设置、提示信息、控件位置和字段 ID 的真实参数类型。此记录表示本批严格检查通过；`getPageConfig` 返回值仍继承全局 `safeParse:any`，并未宣称该 JSON 边界已完成强类型化。下一批需连同实际消费方处理，保留原有 JSON 查找、回退及失败语义。

位置合并改用带显式空对象累加器的 reduce，保留输入数组的 spread，维持稀疏项先转成 undefined 再参与合并的行为。位置键保留缺失 ID 的 `"undefined"` 转换，也维持原生运行时 Symbol/原型键行为。坐标和子表的非空断言只擦除类型：缺坐标仍产生 NaN，缺少 relationControls/showControls 仍按原生表达式失败，没有填入零或空数组。时间设置从生成 DTO 派生有限字段；动态键只按协议键作标量类型视图，运行时仍执行原来的动态查找，未知名字的失败路径保留。

首次 private 类型探针发现完整生成接口不能赋给仅模板索引形式的时间设置类型，改为有限 DTO 映射后接受真实接口；两份失败日志保留。首次 fast 门禁还发现，在非 strictNullChecks 口径下，两个原 `return;` 在收窄返回类型后触发 TS7030；改成逐位等价的 `return undefined;`，保留失败日志，后续完整门禁通过。没有以 strict 总数下降掩盖 fast 的新增错误。

协作方晚出的 `ed3fe9919` 九项分支规格已审查并整合，覆盖保存假值/无回调、添加字段失败、关联控件 showtype 6 和非 29 类型、两种可见性分支、无滚动宿主与重置假值；main 的 thunk 规格现为 34 项，均在受控 Promise/API 替身内运行，没有调用生产写接口。修正与全部历史保留。

## 验证

- 新增真实历史 A/B 规格，基线 `ed8251af3f4e1d2084f32ff22a4992a7b93dc86f`，实际断言源码 SHA。使用真实 lodash、moment、React 和真实 safeParse 声明，枚举来自实际源码；CountDown 仅是稳定叶节点替身，不挂载组件、不开定时器、不发网络请求。
- 9 组对照覆盖缺省坐标、NaN/Infinity、空行、稀疏位置数组、undefined/null/Symbol/原型键、继承 ID、getter 顺序、嵌套引用、子表过滤与原生错误、全部时间模式、缺数组/非法星期、React 元素/倒计时属性，以及原始 JSON 为对象/原始值/无效文本/null 时的旧行为。
- 7 个函数类型擦除后的声明逐字节相同；时间格式函数只将两处 `return;` 显式写为 `return undefined;`，并有直接行为对照。去掉位置数组 spread 的内存变异版本被稀疏项断言拒绝，未修改产品文件。
- 真实终点编译探针证明布局/时间/提示/删除检查的已知参数与返回值非 any、真实 DTO 可赋值，10 个非法用法拒绝；另明确断言 `getPageConfig` 返回仍是 any，作为剩余欠债证据，未把它算作强类型成功。
- strict **51,101 → 51,086**，按文件/错误码无新增；15 条消失均在本工具文件。strict-debt **3,085 → 3,084**，strict-clean **1,686/4,770**；无新增产品文件，规格由 tools 门禁检查。fast 仍 **8,492/2,284 keys**，保留原基线内容，不制造无效时间戳更新。
- 正式 release **266/266**、后缀/工具/语法/非增量 fast/strict 和全部编译通过；颜色、圆角、排版、JSX key、该产品文件 ESLint 通过。保留原 subPathNavigation 隔离 known-failure。pre-push 与 release 顺序执行。

证据 `/private/tmp/hap-formextend-utils-20261017/`。全仓强类型和正式 strict 仍未完成。

## 冻结候选与现网

冻结 revision **cc8ec93623b6011d80b99bfc4f68e9c9cf8527aa**，入口 SHA256 **ff1ab91d80fb014d6749b3be07b248eeb7a4fcb141f6362b0fe32452bb2749d9**，包 SHA256 **8ba61783954276d2b3281bd47d2d26ca793acb718c397e35d20dfee91b4488dc**。`/private/tmp/hap-formextend-utils-artifact-20261017/` 中完整包已逐条读取并校验 17,098 个文件及三项元数据。runtime 资源校验（1,095 JS/387 CSS chunks）与 publish 通过。

本批尚未切换生产。实测 `/data` 可用 **5,568,385,024 bytes**，现网 **12,465,209,344 bytes**，仅完整复制和 4 GiB 预留就需要 **16,760,176,640 bytes**，另需上传/解包与覆盖余量；不满足既有可回滚流程预算。没有删除未完成旧批或降低保护。现网仍为17:29发布的 **3b0ff2ea0c80ecd07b87dd1f6e8d2b57d9538696**，以该版冻结清单复核六入口/34资源通过，实际现网/完整快速回滚摘要及五容器完整 Mounts 与发布记录相同。当前快速回滚和全部原包/归档/恢复材料保留，预算核验保存为 production-budget.json。
