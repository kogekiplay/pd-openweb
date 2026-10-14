# Statistics 时间工具严格化

## 范围

`src/pages/Statistics/common/timeUtils.ts` 的时间范围、对比文案、日期粒度、筛选和 tooltip 辅助函数。

## 改动

- 为范围选项、对比选项、动态时间筛选、时间格式和粒度选项建立有限结构。
- 为导出的筛选、格式化和 tooltip 函数补齐参数与返回类型，处理 exact optional property 的可选输入。
- 保留过去/未来、自定义动态范围、财政年度和周粒度的原有格式化结果；历史配置缺失时返回空文案，避免读取不存在的选项。
- 将时间选项查找改为带类型收窄的原生 `find`，避免 lodash 泛型把真实选项退化成联合类型。

## 验证

- `/private/tmp/hap-time-utils-parity-20261014.cjs`：8 组有效输入与旧实现结果一致。
- `npm test`：227/227，通过；`src/router/subPathNavigation.spec.ts` 保留既有 PublicWorksheet `weixinAuth` 隔离失败。
- `npm run typecheck:syntax`：4,745 个文件、0 条语法诊断。
- `npm run typecheck:tools`：两个工具 tsconfig、0 条诊断。
- `npm run typecheck:fast`：8,814 条基线诊断、无新增。
- `npm run typecheck:strict`：欠债清单外 0 条诊断；清单 3,134 个文件，strict-clean 1,620 / 4,754。

严格诊断由 53,249 降至 53,201，按文件和错误码没有新增；`timeUtils.ts` 的 41 条终点诊断已清零。本批仅同步类型与门禁记录，未发布生产。
