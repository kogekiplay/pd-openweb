# 公共控件、滚动和真实样式类型

本批从 `cfd1fd453` 出发，继续全仓强类型与严格化目标。上游仍为已包含的 `ff5c412a3`。同日用户要求每天 17:30 前生产更新，已先将上一验证批次 cfd1fd453 于 15:09 部署并完成真实页面验收，详见 `production-20261010.md`；本批在部署时仍处于开发阶段，没有混入该生产版本。

## 最终实现

- Cascader 的选项树、值、回调、搜索、加载结果及 ref 使用有限模型和真实 styled-components 类型。未知树检查实际字段、递归子节点和稀疏数组，保留合法数组、条目及元信息引用。实际 Desktop producer 提供 loaded/failed/cancelled 结果，成功必须等待实际 API 与选项更新；根/搜索失败显示错误并按原关键词重试。缓存 B 展开会使 A 的旧失败过期，清除当前 spinner/error；关闭、disabled、卸载、搜索及空 key 的加载标记有实际规格。相邻 Widget 仍有 36 条私有类型债，不冒称完整后端 DTO 或全文强类型。
- Tooltip/Button 使用真实 Ant Design 公共 props/ref/events，移除宽颜色断言。Modal/Input 已有原生模型，其实际绑定和 Modal focusable 原引用一并验证。Tooltip 的 shortcut/white 函数标题保持延迟求值，避免将函数直接当作 React 子节点；普通函数仍保留原引用与 receiver。组件桶明确导出实际 wrapper 类型，避免同名 props 错指 Ant Design 原生契约。Date/Score 两处 Dialog 状态按原禁用真值与打开/关闭行为收为 boolean，正常绑定保持。
- ScrollView 的配置、实例、viewport、事件、ref、返回信息与两个插件使用实际安装 SDK 类型。未知插件扩展只检查四个已消费开关，元信息保持 unknown；getter 保留未挂载返回空对象、未初始化返回 undefined、已初始化返回完整信息的三条分支。原配置 merge、DOM 透传、class、滚轮/触摸、导航接管和方法 receiver 保留；defer 后提前卸载安全结束，卸载/替换 handler 取消旧 trailing 回调。318 个实际 producer、22 组生产 Babel 及实际模块规格覆盖此边界。
- GeneralSelect 的四个样式模块及 AILoading/BgIconButton/ConfirmPanel/VCenterIconText 使用真实样式库类型，15 个样式定义及 keyframes 的动态分支受检。Dialog/Confirm/Promise/Footer 的完整公共 props、ref、事件、关闭与 thenable 签名同步收紧，真实 Styled(Dialog) 不再继承目标组件 any。action/then receiver、then getter 读取顺序、false/拒绝/异步关闭语义保留；React 19 ref 指向真实内层 class。原未消费的 legacy props 继续保留在实例 props 上，不新增其 UI 效果。
- ControlOption 的额外字段从 any 收为 unknown；已声明选项字段保持准确类型。全局关闭注册仅补显式 undefined，保持既有 method variance；API resolve payload、ControlValue/RecordRow 与其余全局声明仍有后续工作。

## 验证

完整终点严格 CLI 59443 → 59209，减少 234 条，按文件/错误码新增 0；fast 9442 → 9412，减少 30 条。欠债清单 3418 → 3407，仅移出 11 个已达标文件；终点口径零诊断 1284/4691。Cascader wrapper 的 66 条旧诊断清零，8 个样式模块及 Dialog 完整 callee 按实际库模型零诊断。静态 Any 缺口减少也计入本批，未将所有零诊断文件冒称已消除 any。

170/170 行为规格通过；工具、语法、严格欠债、fast、后缀、颜色、圆角、排版、JSX key 全部门禁通过。新规格另按工具终点严格 flags 检查，自身零诊断；工具程序已有历史严格欠债及 PublicWorksheet 微信子路径 known failure 保持，不放宽类型配置或增加基线条目。

源码提交 `7e09e2bab` 的本地生产构建通过，用时 1 分 17 秒；构建后工作树干净，3 个 runtime 的资源校验通过（1095 JS、387 CSS）。本批尚未部署，当前实际生产版本为同日 15:09 更新的 cfd1fd453。

实际生产 Babel 有效对比通过：四个 wrapper 1089 组、Date/Score 完整原 DOM 控制、Cascader 单/多/嵌套/搜索/原位数组及实际 Widget 请求/保存、ScrollView 22 组；15 样式/keyframes 的 SSR HTML/CSS 相同，浏览器构建使用同一实际库。公共错误类型探针分别 wrapper 20、Cascader 11、样式/Dialog 16、ScrollView/选项 12 个拒绝，合法主体零诊断，导入依赖旧债单独计入。API 加载/拒绝/重试、缓存分支旧失败、空 key、title 函数装饰、SDK 未初始化卸载及 trailing 清理均执行实际模块。

只读交叉审查指出的缓存 B 旧失败覆盖和首次搜索失败仍“搜索中”已修复并复验。与本批无关的私有 UI、泛化 API payload 和全仓值引擎未被宣称完成。整个 styled-components 旧 shim 尚未删除，实际 bare import 仍有 1575 个生产模块（本批整体迁移 9 个，含 Cascader），需要继续收紧。

证据位于 `/private/tmp/hap-wrapper-scroll-release-20261010`、`/private/tmp/hap-scroll-options-20261010`、`/private/tmp/hap-cascader-20261010`、`/private/tmp/hap-antd-wrappers-20261010`、`/private/tmp/hap-strong-20261010/styled-collection` 和 `/private/tmp/hap-wrapper-cross-review-20261010`。完整目标仍未完成：全部 strict 开关、全部基线/欠债及全局替代声明尚待移除。
