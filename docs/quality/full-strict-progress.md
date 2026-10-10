# 全仓 TypeScript 严格化目标

用户目标：完成所有强类型改造，启用全 TS 严格化。本目标持续推进，局部门禁通过不是完成。

完成时需从当前文件与实际检查验证：

1. 产品及自有工具脚本的 tsconfig 正式开启 strict/noImplicitAny 等目标检查（产品含 noUncheckedIndexedAccess/exactOptionalPropertyTypes/noPropertyAccessFromIndexSignature），直接编译当前各完整程序零诊断；工具门禁目前 strict:false，不将它的语义零诊断当作严格化完成。
2. 严格类型欠债清单归零并移除豁免机制；基础语义检查不再依靠历史诊断基线放行。
3. 公共 API、缓存、JSON 及事件/Redux 边界使用准确有限模型或 unknown 验证。删除为迁移保留的 styled-components 类型下限及开放 any 结果等替代声明，使用实际依赖类型。
4. 自有产品代码的隐式/显式 any 不作为逃生口；确实开放的数据保留 unknown 并在使用前验证。真实协议假设须明确，不能用整包断言假装数据已验证。
5. 运行行为、必要的错误边界、生产构建与现有完整回归通过；用户已授权验证批次持续推送 GitHub。

2026-10-10 当前已验证到：严格 CLI 59209 条存量诊断、3407 个存量文件仍在欠债清单；1284/4691 个产品文件满足终点口径。strict 等最终开关仍未全部开启。上游最新仍为已包含的 `ff5c412a3`。本批公共控件、滚动和真实样式类型在 59443 条基础上减少 234 条，按文件/错误码无新增；fast 当前 9412 条，11 个达标文件移出欠债名单，旧诊断基线只收紧。170 项规格和工具/类型等全部门禁通过，详见 `wrappers-scroll-styles-20261010.md`。Cascader、ScrollView、Dialog 及相关样式使用有限模型或实际 SDK 类型；styled-components 旧 shim（1575 个生产模块）、DataFormat 值引擎、私有 UI、公共 API payload 与全局开放声明仍有后续工作。此前已验证的功能与上游历史保持。

生产当前为 7.5.0，前端于 2026-10-10 15:09 更新到已验证的 `cfd1fd453`，真实页面和人员搜索验收通过，详见 `production-20261010.md`。用户已要求每天 17:30 前更新生产，已设置 16:45 的每日前端发布任务；未验证工作树不会发布。类型工作在 types-strict-diagnose，远端 main 按验证批次同步，两小时 GitHub 定时同步继续运行。没有新验证变更时核验现网并保持安静。
