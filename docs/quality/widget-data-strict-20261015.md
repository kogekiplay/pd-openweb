# 控件新增、复制与保存边界严格化

`widgetConfig/util/data.tsx` 剩余的新增/复制上下文、拖拽参数、自动编号保存信息和 JSON 默认值边界已显式建模，递归格式化返回 `FormControl[]`。JSON 列表先收窄为记录数组，扩展字段原样保留；复制游离子表继续替换内部 ID、保留配置缓存，查询与分段复制保持现有顺序。空新增、缺失拖拽路径及缺失复制目标按空操作处理。回收站恢复调用显式传入布局及 setter，Mingo 回调的默认参数修正为对象。

配套收紧 `adjustControlSize` 和批量删除参数，未复制或修改同步树的未提交拖拽批次。全仓终点诊断 52,772 → 52,675，按文件/错误码新增 0；data.tsx 89 → 0。欠债 3,129 → 3,128，strict-clean 1,628/4,756（34.2%）。fast raw 8,673 → 8,656，keys 2,330 → 2,328；两份清单已验证仅收紧。

验证：`DATA_MUTATION_BEFORE_REV=5ef6c1b31 node src/pages/widgetConfig/util/dataMutation.spec.ts` 42 组历史 A/B 通过，覆盖 setter 顺序、回调延迟、布局宽度与顺序、复制 ID/缓存、输入不变性、人员/部门/角色默认值、关联记录及级联默认值、查询层级和保存格式。另有缺失输入边界断言。数据文件和规格 ESLint 零错误/警告。正式发布门禁及生产验收另见当日 production 记录。

证据目录：`/private/tmp/hap-data-release-20261015/`。上游 main 仍为 `5788d7d5d`（7.5.1），已包含在当前历史；本轮无需微服务升级。全仓严格开关尚未全部启用，完整强类型目标继续进行。

最终补充：历史对照直接提取并执行 src/common/global.ts 的真实 safeParse，覆盖级联字符串及对象 ID。最终源码 8889535fa 已完成生产发布，见 production-20261015.md。
