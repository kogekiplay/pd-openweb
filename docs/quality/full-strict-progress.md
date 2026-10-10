# 全仓 TypeScript 严格化目标

用户目标：完成所有强类型改造，启用全 TS 严格化。本目标持续推进，局部门禁通过不是完成。

完成时需从当前文件与实际检查验证：

1. 产品及自有工具脚本的 tsconfig 正式开启 strict/noImplicitAny 等目标检查（产品含 noUncheckedIndexedAccess/exactOptionalPropertyTypes/noPropertyAccessFromIndexSignature），直接编译当前各完整程序零诊断；工具门禁目前 strict:false，不将它的语义零诊断当作严格化完成。
2. 严格类型欠债清单归零并移除豁免机制；基础语义检查不再依靠历史诊断基线放行。
3. 公共 API、缓存、JSON 及事件/Redux 边界使用准确有限模型或 unknown 验证。删除为迁移保留的 styled-components 类型下限及开放 any 结果等替代声明，使用实际依赖类型。
4. 自有产品代码的隐式/显式 any 不作为逃生口；确实开放的数据保留 unknown 并在使用前验证。真实协议假设须明确，不能用整包断言假装数据已验证。
5. 运行行为、必要的错误边界、生产构建与现有完整回归通过；用户已授权验证批次持续推送 GitHub。

2026-10-11 当前已验证到：产品完整严格 CLI 57,816 条存量诊断、3,391 个欠债文件；1,315/4,706 个产品文件满足终点口径，fast 9,254 条。打印、透视表与工作表 API 批次在 58,662 条基础上减少 846 条，文件/错误码无新增；六个达标文件移出名单，基线只收紧。全工具严格 CLI 为 2,919 条（本批减少 10），常规工具门禁零诊断。184/184 规格、全仓门禁、正式 release/publish 和 1095 JS / 387 CSS / 3 runtime 资源校验通过，详见 `print-pivot-api-20261011.md`。此前选择器/表格/上游整合验证保留在 `selectors-table-slider-20261010.md`、`upstream-4790807-20261010.md`。正式严格开关仍未全部开启；FiltersGenerate 私有逻辑、其它私有组件、API 生产者、styled-components 旧 shim 与工具债务仍在，完整目标尚未完成。

生产当前为 7.5.0，前端于 2026-10-10 16:52 更新到已验证的 `9a1dd5378`，真实工作台、UAT 清单和人员搜索验收通过，详见 `production-20261010.md`。15:09 的 `cfd1fd453` 保留为回滚版本。用户已要求每天 17:30 前更新生产，已设置 16:45 的每日前端发布任务；未验证工作树不会发布。类型工作在 types-strict-diagnose，远端 main 按验证批次同步，两小时 GitHub 定时同步继续运行。没有新验证变更时核验现网并保持安静。

包含本轮公共类型及上游更新的整合源码提交 `946e9c615` 完整生产构建通过（1 分 53 秒），构建后工作树干净，冻结源码哈希相同。本地新批次没有部署到生产。

工具链批次 `b1347dbf6` 已推送：CI/utils、CI/generate、CI/serve、publishConfig、build、spec-harness 和 run-specs 的自有路径五开关零诊断；179/179 规格及 release 构建通过，资源为 1095 JS、387 CSS、3 runtime。全工具 strict 按诊断标题计数为 2929 条（3158 → 2929，减少 229；旧数字3391是含说明的输出行数），仍有 webpack 配置、其它脚本和既有测试 globals 等未处理债务；本批未更新生产。
