# CustomPage Redux 严格化验收

自定义页面状态、控件布局、主题配置和动作载荷现在有明确类型。RootState.customPage、直接字段及控件/布局/按钮/配置的已知嵌套字段经真实 TypeScript 程序验证非 any；未消费的插件元数据继续保留 unknown。动作工厂按已处理的联合抽取 payload 并保留常量字面量；默认分支的无副作用检查保证新增动作漏处理时编译失败，Redux 初始化和未知动作仍返回原引用。

页面 patch 直接取 Partial<State>，可以显式清除原本可选的容器/配置字段，不能把必选初始字段覆盖为 undefined；flag 纳入 state。只读取得的 MOM 与 ERP 两个原始页面响应分别带数字版本 35/73，模型兼容数字、既有字符串和初始 null，两份完整控件/配置/应用载荷均通过编译。设备动作类型按实际 web/mobile 生产方约束，运行时仍保留原计算键；历史扩展键也在原始 A/B 中保留，不再被错误映射到 mobile。

## 行为与类型证据

51 项 reducer 规格包括 37 个历史 A/B 场景及 14 个绝对断言。使用 main 可达 fc6676e67 的真实 reducer/action、实际断言的冻结 SHA、真实 lodash/immutability-helper 和从 util 实际声明抽取的 helper。deepEqual 保留 undefined 自有键、NaN/Infinity、数组负下标属性与引用差异。原候选的 10 项差异及随后 Number(y) 导致的缺省行坐标回归均已复现并修正；保留原 _.pick、自有原型键元数据、缺布局/筛选的失败、无变化引用、原地高度 clamp 和动作常量尾空格。

独立的 linkageFiltersGroup 删除修复经过真实 configureStore 默认不可变中间件反例：旧路径抛错且修改旧对象，新路径正常派发、保留旧对象并只移除新状态的指定键；真正不存在的目标也覆盖。两个实际消费方 ViewDisplay/ChartDisplay 使用真实 react-redux connect 创建 HOC，并直接验证捕获的真实 selector。断言 WrappedComponent 确认没有用返回原组件的假 connect；真实 store/reducer 产生状态。该项验证 selector/HOC 创建，没有挂载业务组件或执行其 effect，不能当作界面渲染验收。

工具层另有 4,320 组默认布局、20 组 ID 定位、28 组主题同步、双向枚举/图标/默认配置及 9 处实际消费表达式的历史对照。保留移动默认布局读取顶层 y/h 的既有方式；只在数值加减处转换 number/undefined，分组和比较保留原坐标。

实际编译验证 20 个非法用法被拒绝，包括错误 ID/布尔值/坐标/配置/滤镜标志、必选字段清空和错误设备键；两份生产载荷及可选字段清空被接受。把 helper 返回虚拟改为 any 会使类型探针失败；向真实动作联合虚拟加入 UNHANDLED_CASE 会在默认分支产生 TS2345，语法检查通过，证明穷尽性检查确实生效。未用条件别名算出 never 来冒充编译断言。

## 门禁与构建

- strict 全量 51,219 → **51,154**；按文件/错误码无新增，CustomPage redux 由 45 条到 0。三条长诊断的推导摘要有变化，已核对原位置/错误码/拒绝原因仍是存量问题。
- strict-debt 3,089 → **3,087**，移出 action/reducers；strict-clean 1,678/4,767 → **1,682/4,769**。新产品类型文件是真实被消费的模型，未把类型测试放进产品分母。
- fast 8,511/2,291 keys → **8,499/2,287 keys**，baseline 每项只减不增；两个 JSON 均实际核验单调收紧。
- 第二次正式 release **261/261**，工具、后缀、语法、非增量 fast 和 strict 全通过，保留 subPathNavigation 既有一项隔离 known-failure。颜色/圆角/排版/JSX key 通过；本批相关 15 文件 ESLint 0 error、5 warning（hook 依赖与空行提示），不是全仓 ESLint 零错。
- runtime 资源检查 **1,095 JS / 387 CSS chunks**，publish 通过。正式构建 revision **e494d9c4d0e75b3aa9261a6db024f6c252ec1694**，入口 SHA256 **2602fc10dbfa52f9000c6715786e7188be4f6674f307fbd4dd1837c41b34e4c6**。

首次 release 正确拦截 260/261：生产环境关闭 RTK 开发不可变检查，使旧路径反例不抛错。规格现显式选择 test 环境加载和运行真实 RTK，结束恢复原 NODE_ENV；默认中间件与原断言保留，生产环境定向运行及正式 release 重新通过。保留首次失败日志，未降断言、跳测试或放宽门禁。

17,098 个候选文件已冻结逐文件 SHA 与完整压缩包，包 SHA256 dad9e11dc6e431bd6ca6578ec4e06bc4d36ff464e15b0326d835e68c5078660d。证据在 /private/tmp/hap-custompage-review-20261017/，含两个原始响应、编译探针/自检、诊断差分、全部门禁/构建日志、候选清单与恢复可用产物；客户响应未提交仓库。pre-push 与 release 顺序运行，正常推送以 hook 通过为前提。

## 生产与后续

已于2026-10-17 15:33:31上海发布冻结e494候选，完整空间整理、归档、回滚和生产验收见 [production-20261017-e494.md](production-20261017-e494.md)。当前生产验证改用 /private/tmp/hap-production-e494-20261017/http-verify-frozen.py；原2e清单与回滚链保留。

DSH 交付至 9ec 的必要修正已整合；后续 e2caa/ccd 与 lead 改动重复。9255 的 src 下类型断言含运行时代码且会计入产品分母，未纳入该批。协作历史和未提交修改保留，已把下一范围更新为 PublicWorksheetConfig Redux。全仓强类型与全局 strict 目标继续，尚未完成。
