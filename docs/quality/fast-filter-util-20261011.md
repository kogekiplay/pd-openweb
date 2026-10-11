# 快速筛选工具严格化

本批完成 `src/pages/worksheet/common/ViewConfig/components/fastFilter/util.ts` 的终点类型收紧。日期显示方式、日期颗粒度、快速筛选默认值、人员/部门/组织角色/关联记录 ID 投影和日期范围解析都使用有限输入输出模型；异常日期范围保持原有 `undefined` 结果，不用空数组掩盖坏数据。

验证结果：

- 15 条该文件的终点诊断清零，自有 tools 门禁 0 条诊断。
- fast 基线 key：2,469 → 2,467；strict 总诊断：56,666 → 56,652；严格欠债文件：3,340 → 3,339；strict-clean：1,392 / 4,731。
- 专项规格覆盖 8 组默认值、日期颗粒度、ID 投影、日期范围和异常输入，并与提交 `9ec583272` 的生产 Babel 输出做历史 A/B；完整规格 203/203 通过，保留既有 `PublicWorksheet weixinAuth` subPath 已知隔离失败。
- 语法、工具链和格式门禁通过；本批未改生产环境，候选代码仍需按既有发布流程处理。

证据：`/private/tmp/hap-fastfilter-20261011-*`，专项规格为 `src/pages/worksheet/common/ViewConfig/components/fastFilter/util.spec.ts`。
