# Statistics TopChart 严格化

## 范围

`src/pages/Statistics/Charts/TopChart.tsx` 的排行数据转换、进度条、联动菜单和类组件生命周期。

## 改动

- 为图表返回值、排行数据、x/y 轴、样式、摘要、联动筛选和组件 props/state 建立有限结构。
- 明确动态排行字段的 `unknown` 值边界，收紧进度宽度和排名字段选择，保留无排序时回退到首个 Y 轴的行为。
- 为 DOM ref、用户头像 JSON、缺失项目 ID 和空图表数据提供安全边界，避免把缺省值扩散为隐式 `any`。
- 清理组件上的 `Component<any, any>`、事件参数、回调参数和动态索引诊断。

## 验证

- `/private/tmp/hap-topchart-parity-20261014.cjs`：排行数据、排序字段选择和进度宽度与旧实现一致。
- `npm test`：227/227，通过；`src/router/subPathNavigation.spec.ts` 保留既有 PublicWorksheet `weixinAuth` 隔离失败。
- `npm run typecheck:syntax`：4,745 个文件、0 条语法诊断。
- `npm run typecheck:tools`：两个工具 tsconfig、0 条诊断。
- `npm run typecheck:fast`：8,803 条基线诊断、无新增。
- `npm run typecheck:strict`：欠债清单外 0 条诊断；清单 3,133 个文件，strict-clean 1,621 / 4,754。

严格诊断由 53,201 降至 53,162，按文件和错误码没有新增；TopChart 的 39 条终点诊断已清零。本批仅同步类型与门禁记录，未发布生产。
