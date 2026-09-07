# 行为测试说明

这个仓库有 62 个行为 spec。**它们不是重构安全网**，读完这一页再决定信它多少。

## 怎么跑

```bash
yarn test                                  # 全部，并发，约 4 秒
node scripts/run-specs.js --filter router  # 只跑路径含 router 的
node scripts/run-specs.js --concurrency 1  # 串行，输出不交错，约 16 秒
node scripts/run-specs.js --timeout 60000  # 调单个 spec 的墙钟上限（默认 30s）
```

零新增依赖：Node 内置 `assert` + 一个手写的 `scripts/spec-harness.js`（转译 `.ts/.tsx` 并打桩）。
**不要为它引入 jest/vitest** —— 零依赖是这套测试最主要的价值，换成框架就没了。

## 它能保证什么、不能保证什么

**覆盖面：87 个源文件，占全仓 4,341 个 `.ts/.tsx` 的约 2.0%。**
集中在 router / Form / ming-ui 组件 / Admin / AppHomepage 的纯函数与工具层。

- **`src/api` 覆盖为 0** —— 所有接口请求在 spec 里都是打桩的。接口契约回归是完全的盲区。
- 与 2026-09 那轮全量 TS 化中修掉的 21 条真缺陷**零交集**。
- 不覆盖任何需要登录态、真实后端、或浏览器渲染的路径。

**变异测试实测的护栏强度（这个数字必须分档看）：**

| 口径 | 杀死率 | 含义 |
|---|---|---|
| A 类：变异打在断言直接覆盖的逻辑上 | **95.7%**（67/70） | 被测到的那几十行，保护力很强 |
| B 类：变异打在同一文件的其它位置 | **16.7%**（3/18） | 同一个文件里没被断言点到的地方，基本不设防 |
| 合并 | 79.5%（70/88） | |

**只拿 95.7% 对外说会高估五倍以上。** 它守的是「这 87 个文件里被断言点到的那几十行」，
不是「这 87 个文件」。

## 已知薄弱点（变异测试实测存活）

改动下列文件时，别指望 spec 会拦住你：

- **`src/pages/Admin/components/SearchWrap/index.spec.js`** —— 唯一真正形同虚设的：
  只有一句 `assert.doesNotThrow(renderToStaticMarkup(...))`，零值断言。
  把语言包映射整体错位一格，它照样全绿。**本质是冒烟测试，不是行为测试。**
- **`src/components/ArchivedList/index.spec.js`** —— MenuItem 渲染分支从不执行
  （list 来自被打桩的接口、恒为空）。那个分支只被三条源码字符串断言守着。
- **`Form/MobileForm/widgets/Number/Numeric.spec.js`** —— 受控路径（`setCurrentValue`）零覆盖，
  只测了未受控 input 的 DOM value。
- **`src/pages/Admin/logs/utils.ts`** 的链接补全正则 —— 三条样例都只含一个链接，
  去掉 `g` 标志（只处理第一个）测不出来。

## 7 个「文本/AST 断言型」spec 很脆

`Location/index`、`Print/components/Header/index`、`Print/core/getPrintContent`、
`workflow/ProcessConfig/index`、`router/subPathNavigation`，以及 `ArchivedList/index`、
`Admin/logs/utils` 的部分断言 —— 它们断的是**源码文本形状**（字符串 includes / AST 匹配），
不是运行时行为。

实测 6/6 会被**行为等价**的改写打红：引号风格、布尔操作数顺序、`checked` vs `checked === true`、
去掉单行 if 的花括号、className 词序。也就是说一次无害的 prettier 或改名就可能挡住你 push，
而报错信息不会指向真正原因。**遇到这类失败先确认是不是纯形态变化。**

它们能证明「这行代码还在」，不能证明「这行代码是对的」。

## 隔离区（known-failure）

`src/router/subPathNavigation.spec.js` 有 2 条断言被 `expectedFailure()` 隔离，
对应 `PublicWorksheet/action.ts:540` 一处**上游未完成的 subPath 迁移**。

这是**真实的产品缺陷，尚未修复**，只是不阻塞门禁。若生产以 subPath 部署且
`md.global.Config.WebUrl` 不含 subPath，它就是活的线上 bug（`WebUrl` 由服务端下发，仓库内判定不了）。
搜 `TODO(subpath-weixinauth)` 找现场。

`expectedFailure()` 会自动退休：一旦被包裹的断言开始通过，它会主动报错，逼你删掉隔离而不是留个陈旧标记。
它**只吞断言失败**（`err.code === 'ERR_ASSERTION'`），其它异常照常抛出——否则一个 harness 故障
会被伪装成 known-failure，隔离区变成永远不响的黑洞。

## 挂在哪，以及怎么绕过

| 位置 | 何时跑 | 逃生口 |
|---|---|---|
| `yarn test` | 手动 | —— |
| `.githooks/pre-push` | 本机 push 前 | `SKIP_TESTS=1`；`git push --no-verify` 完全绕过 |
| `scripts/build.js` release 前置 | 每次 release 构建 | `SKIP_TESTS=1` |

`SKIP_TESTS` 与 `SKIP_TYPECHECK` 是**两个独立开关**，互不影响。
（历史缺陷：`SKIP_TYPECHECK=1` 曾经 `exit 0` 掉整个 hook，把行为门禁一并静默关掉且无提示。已修。）

pre-push hook **不随 clone 分发**，每个 clone / worktree 要各跑一次：

```bash
yarn hooks:install
```

所以真正不可绕过的只有 release 前置。**这个仓库没有 CI**，别人机器上推上来的回归拦不住。

## 命名约束

测试文件**只能**叫 `*.spec.js`。

`.gitignore` 曾经带一行 `*.test.js`（和删掉这批测试的 7.4.1 是同一个 commit 加的），
会让任何 `*.test.js` 静默消失——`git status` 里都看不见。那行已删，
且 `run-specs.js` 启动时会扫描并对残留的 `*.test.js` 报错，防止重蹈覆辙。
