# 全仓 TypeScript 严格化目标

用户目标：完成所有强类型改造，启用全 TS 严格化。本目标持续推进，局部门禁通过不是完成。

完成时需从当前文件与实际检查验证：

1. 产品 tsconfig 正式开启 strict/noImplicitAny/noUncheckedIndexedAccess/exactOptionalPropertyTypes/noPropertyAccessFromIndexSignature，直接编译当前全仓零诊断。
2. 严格类型欠债清单归零并移除豁免机制；基础语义检查不再依靠历史诊断基线放行。
3. 公共 API、缓存、JSON 及事件/Redux 边界使用准确有限模型或 unknown 验证。删除为迁移保留的 styled-components 类型下限及开放 any 结果等替代声明，使用实际依赖类型。
4. 自有产品代码的隐式/显式 any 不作为逃生口；确实开放的数据保留 unknown 并在使用前验证。真实协议假设须明确，不能用整包断言假装数据已验证。
5. 运行行为、必要的错误边界、生产构建与现有完整回归通过；用户已授权验证批次持续推送 GitHub。

2026-10-09 当前已验证到：严格 CLI 62899 条存量诊断、3499 个存量文件仍在欠债清单。strict 等最终开关仍未全部开启。已完成部分工作表公共状态、表格、层级、看板动作和树表，继续处理共享筛选、worksheet 工具及全局请求/缓存。

生产当前为 7.5.0，加已完成的门户会话/路由热修复；类型工作在 types-strict-diagnose，未验证工作树不会发布。远端 main 已同步验证提交。定期同步自动任务会在有可推送变化时处理，并在无变化时保持安静。
