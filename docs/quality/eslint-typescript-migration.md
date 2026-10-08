# ESLint TypeScript 改造验证

2026-10-08，在 `types-strict-diagnose` 工作区完成。改动前版本为 `85dab3fc6`。

## 配置与依赖

TS/TSX 使用 `@typescript-eslint/parser` 与 plugin 8.71.1；JS/JSX 保留 Babel parser。
只在 TS/TSX 关闭 core `no-undef`，`no-unused-vars` 换成扩展规则并保留 `ignoreRestSiblings: true`。
core `no-redeclare` 同样换成扩展规则，避免把合法函数重载当作重复声明。
未启用需要类型项目服务的 `no-unsafe-*` 等规则；语义检查继续由 tsc 负责。

ESLint 保持 10.11.0，类型检查编译器保持 7.0.2。typescript-eslint 的 peer range
支持 ESLint 10，但依赖 TS 6 的旧 API，直接加载 TS 7 会抛错。
按 [TypeScript 官方双版本方案](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0)：

- `@typescript/native` 别名安装 TS 7.0.2，`tsc` CLI、四道类型门禁和 TS7 工具显式使用该包。
- `typescript` 别名安装 `@typescript/typescript6` 6.0.2，实际提供 TS 6.0.3 API，供 ESLint 使用。
- `.bin/tsc` 实测指向 `@typescript/native/bin/tsc`；兼容编译器另名 `tsc6`。
- 依赖通过 `bun install` 安装，锁文件记录版本；安装无 peer 冲突。

依赖支持范围见 [typescript-eslint 文档](https://typescript-eslint.io/users/dependency-versions/)。
TS 专用 `no-undef` 配置依据见 [官方 FAQ](https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors)。

## 全 src 的规则统计

两次均运行 `node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js src --format json --output-file <结果路径>`，
不使用缓存，不自动修复。两次实际覆盖文件集合完全一致，都是 **4292 个文件**，fatal parsing error 为 0。
现有忽略范围保持不变，因此这个数字不包括已经明确忽略的 vendor、生成 API 和示例素材。
两次 lint CLI 均因存量 lint 错误返回 1；本次没有声称全仓 lint 已归零。

| 规则 | 改动前 | 改动后 | 差值 |
|---|---:|---:|---:|
| `no-undef` | 5095 | 0 | -5095 |
| `prettier/prettier` | 3139 | 3136 | -3 |
| `react-hooks/exhaustive-deps` | 1315 | 1314 | -1 |
| `no-unused-vars` | 1308 | 0 | -1308 |
| `padding-line-between-statements` | 482 | 482 | +0 |
| `no-useless-assignment` | 291 | 284 | -7 |
| `react-hooks/set-state-in-effect` | 94 | 94 | +0 |
| `react-hooks/refs` | 83 | 83 | +0 |
| `react-hooks/immutability` | 65 | 65 | +0 |
| `(inline directive)` | 10 | 12 | +2 |
| `react-hooks/preserve-manual-memoization` | 10 | 10 | +0 |
| `react-hooks/use-memo` | 10 | 10 | +0 |
| `no-unassigned-vars` | 8 | 8 | +0 |
| `no-irregular-whitespace` | 4 | 4 | +0 |
| `@typescript-eslint/no-explicit-any` | 2 | 0 | -2 |
| `react-hooks/purity` | 2 | 2 | +0 |
| `no-empty` | 1 | 1 | +0 |
| `react-hooks/static-components` | 1 | 1 | +0 |
| `@typescript-eslint/no-unused-vars` | 0 | 27 | +27 |

errors：9848 → 3460；warnings：2072 → 2073。
统计中的 `(inline directive)` 是未使用的 eslint-disable 指令，不是解析错误。

变化判读：

- `no-undef` 的 5095 条消失是 TS 规则关闭后的统计变化，不能全部称为假阳性。其中 12 条真实未定义标识符另行修复，剩余由类型门禁接管。
- core 未使用变量的 1308 条换成扩展规则的 27 条。测试确认已使用的 type-only import 不报错，真正未使用的类型导入、值变量仍报错。
- 解析器初次切换新增 8 条 core `no-redeclare`，逐条属于函数重载；启用扩展规则后消失，重复 `var` 声明仍会被测试捕获。
- `no-useless-assignment` 减少 7 条：涉及两个从模块导出的变量与五个在 JSX 中使用的组件绑定；源码未更改这些位置，是解析器对使用关系的分析差异。
- `react-hooks/exhaustive-deps` 减少 1 条，位于未修改的 `FixedTable/Grid.tsx`，内容是 `Cell` 被判为不必要依赖，来自解析器作用域分析差异。
- `prettier/prettier` 只减少 3 条，来自本次修改的 Welink 和 Users 文件的排版整理。
- 两条 `@typescript-eslint/no-explicit-any` 原来是未知规则报错。plugin 注册后规则可识别，但现有 disable 指令未抑制任何诊断，因此转为未使用指令提示。
- 其他规则数量不变，现有真正未使用变量和赋值、React Hooks 告警继续保留。

## 未定义标识符替代防线

改造前 `typecheck:fast` 按 file/code 计数做差分，`typecheck:strict` 对欠债文件整体放行。
在 Welink 和 EditUser 原文件末尾分别注入一个唯一未定义变量：
改造前 fast 失败，strict 却通过。因此 strict 原样不能替代 `no-undef`。

现在两道门禁对 TS2304、TS2552、TS18004、TS2662、TS2663 零容忍，历史基线和
strict 欠债名单均不能豁免。相同注入实验再次运行，两道门禁都返回 1，各准确报告 2 条。
探针使用 try/finally 恢复源文件，不增加基线或欠债条目。
tools 与 spec 由 `typecheck:tools` 零容忍检查，JS 文件继续保留 ESLint `no-undef`。

原先 Welink 的 `purchaseMethodFunc` 仍缺 import，已从现有付费弹窗模块导入。
EditUser 的 `companyName` 已在 state 解构中声明，无需修改。
为启用这道零容忍检查，还清理了全仓其余同类存量诊断：

- Account 的 `Icon`、DateCalc 的 `Fragment`、移动表单 Checkbox 的 `Select` 补齐 import。
- Inbox 的 re-export 不建立本地绑定，改为先 import，再 export，渲染函数可以访问它。
- 知识上传助手 `saveLastPos(root, folder)` 错用了函数作用域外的 `currentRoot`，改用实参 `root`。
- 组织角色快速筛选、用户筛选、子表弹窗的三处 `find` 改为已经导入的 `_.find`。

宽松诊断 **10573 → 10561**，恰好减少 12 条，无新增类型诊断；基线据实收紧。
移动表单 Select 所在旧分支在当前调用链下不可达，此处是修复存量名称诊断，不声称存在实际移动端崩溃。

## 验证

以下十项全部通过：

1. `bun run typecheck:syntax`：4287 个文件，0 语法诊断。
2. `bun run typecheck:fast`：10561 条存量诊断，无新增。
3. `bun run typecheck:strict`：清单外全部零诊断，新增未定义名称不再豁免。
4. `bun run check:ext-collisions`。
5. `bun run typecheck:tools`：工具与浏览器工具两份配置均 0 诊断。
6. `bun run check:colors`。
7. `bun run check:radius`。
8. `bun run check:typography`。
9. `bun run check:jsx-key`：4377 个文件，无缺失/重复 key。
10. `node scripts/run-specs.ts`（通过 `bun run test` 调用）：90/90。

行为测试仍有一项已有隔离：`PublicWorksheet weixinAuth baseUrl is not subPath-aware`。
新增 `scripts/eslint.spec.ts` 使用真实配置，覆盖类型命名空间、类型导入、真实未使用变量、
rest 剥离、重载与真正重复声明、JS 未定义变量，以及 TS6 API/TS7 编译器共存。
TS7 `tools/ts7.ts` API 冒烟测试能正常打开项目、读取 Welink 诊断并关闭编译器进程。

没有运行 release 构建或浏览器验证，没有推送或部署。主检出 `pd-openweb` 未修改。
原始 lint JSON、门禁日志与探针日志保存在 `/private/tmp/hap-eslint-n3Fa8G`（临时目录可能被系统清理）；
本报告和相邻汇总 JSON 是持久的评审材料。
