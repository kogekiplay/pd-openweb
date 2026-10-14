# 控件批量变更与布局写入严格化

`widgetConfig/util/data.tsx` 的覆盖、删除、属性更新、布局重排、移动、批量重置、标签删除和 Shift 选择建立了按实际字段拆分的有限上下文，移除这组操作的开放上下文和参数 any。回收站恢复字段路径显式传递布局、控件列表和两个 setter，保留历史调用语义。

缺失删除/更新列表按空列表处理；重置找不到控件时跳过该项，移动缺少激活项时返回；删除空标签允许没有 relationControls，Shift 缺失锚点不产生无效路径。正常操作保留回调顺序、延迟、输入不变性、别名/ID 匹配、行列排序与额外控件字段。

验证：

- `DATA_MUTATION_BEFORE_REV=b17939610 node src/pages/widgetConfig/util/dataMutation.spec.ts`：18 组历史 A/B 通过，另验证 5 类缺失目标边界；使用真实布局、分组、删除和 ID 匹配辅助函数。
- 全仓规格 231/231 通过，保留 1 项既有 PublicWorksheet 微信子路径隔离失败；tools、syntax、fast、strict 门禁通过，新增规格 ESLint 无错误或警告。
- 终点严格诊断 52,818 → 52,772，按文件/错误码无新增；data.tsx 135 → 89。该文件默认值、批量新增/复制和保存边界等剩余债务继续处理，本批不将它宣称为 strict-clean。
- 基础语义诊断 8,678 → 8,673，keys 2,331 → 2,330，基线只收紧；欠债仍为 3,129，strict-clean 1,627/4,756。

本批开始时已将前一批 b17939610 于上海时间 17:04 发布生产，记录见 production-20261014.md；本批源码另按完整验证流程选择为后续候选。诊断及规格证据在 `/private/tmp/hap-gunter-release-20261014/data-*.log`。
