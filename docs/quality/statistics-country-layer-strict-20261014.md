# Statistics CountryLayer 严格化

## 范围

`src/pages/Statistics/Charts/CountryLayer.tsx` 的地图数据、联动、行政区下钻、气泡图层和 Redux 连接边界。

## 改动

- 为地图记录、坐标轴、行政区配置、汇总数据、联动筛选、图表实例和气泡图层建立有限模型。
- 保留动态加载 `@antv/l7plot`、区域/气泡切换、直辖市粒度、联动菜单、原始数据入口和上卷/下钻路径行为。
- 将 API 返回值在边界解码为 `unknown` 后消费，处理缺少图表、地图记录、坐标或颜色分级时的安全回退。
- 移除组件 `any` props/state、隐式参数、动态实例字段和宽泛索引；strict 欠债清单移出该文件。

## 验证

- `npm test`：227/227 通过，保留既有 `PublicWorksheet weixinAuth` 隔离失败。
- `npm run typecheck:syntax`：4,745 个文件、0 条语法诊断。
- `npm run typecheck:tools`：两个工具 tsconfig、0 条诊断。
- `npm run typecheck:fast -- --write-baseline`：8,740 条基线诊断、无新增，移除 63 条已消失诊断。
- `npm run typecheck:strict`：欠债清单外 0 条诊断；清单 3,132 个文件，strict-clean 1,622 / 4,754。

严格诊断由 53,162 降至 53,036，按文件和错误码没有新增；CountryLayer 的 126 条终点诊断已清零。本批只收紧类型和门禁记录，未修改 HAP 后端、数据库、业务记录或授权。
