# 主题引擎归一 实施计划（视觉重构 子项目 A）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让「应用的主题色」成为唯一输入，一处设定后应用区域的主按钮、选中态、链接、边框全部跟随，而平台外壳保持平台色。

**Architecture:** 用 antd 6 的 `theme.getDesignToken()`（**纯函数，Node 里可直接调**）把一个种子色算成完整调色板，再把结果写成 CSS 自定义属性挂到 `document.documentElement` 的 **inline style** 上；平台外壳元素挂 `.platformThemeScope` 类，用一条注入的 `<style>` 把平台调色板重新声明回去。应用区域的绑定点是 `src/router/Application/index.tsx`（`/app/:appId` 的真实子树根）。

**Tech Stack:** antd 6.6.4（已装）、`@ctrl/tinycolor` 4.2.1（已装，`setAppThemeColor` 已在用）、react-redux、react-router 7。**不引入任何新依赖。**

## Global Constraints

- 本仓是 **bun 项目**（`bun.lock`、`engines.bun >= 1.3.0`，无 package-lock.json）。跑脚本一律 `bun run <script>`。
- **构建必须用 node**：`--max-old-space-size=8192` 是 V8 flag，bun 用 JavaScriptCore 不认，而 webpack 确实需要这 8G 堆。
- **零新依赖**。spec 一律是 `node` + 内置 `assert` 的普通脚本（本仓没有 jsdom / vitest / jest / @testing-library，全仓 79 个 spec 都是这个形态）。这条直接决定了下面的拆分：**调色板映射必须是纯函数，React 那一层必须薄到不值得测**。
- 六道门禁每个任务收尾都要全绿：
  ```bash
  bun run typecheck:syntax && bun run typecheck:fast && bun run typecheck:strict && bun run check:ext-collisions && node scripts/run-specs.ts && bun run typecheck:tools
  ```
- `~/dev/pd-openweb`（主检出）必须保持 0 改动，所有工作在 worktree `/Users/kogeki/dev/pd-openweb-dnd` 里做。
- 生产是全公司在用的 OA（`https://oa.tlytelec.com:8880`）：**不重启生产服务、不用用户账号登录、不输密码、不删部署目标目录**（nginx 的 `50x.html` 在里面）。
- **不做降级**。依赖版本对不上就升运行时，不许把依赖回退到旧版本。
- **不把第三方包硬改成 TS**，可以换用自带 TS 的第三方包。
- **验收用的测试应用必须新建，不许改现有应用的 `iconColor`** —— 现有应用的配色是业务方设的。用完删掉。

## 已经核实过的事实（实施时不要重新假设）

| 事实 | 来源 |
| --- | --- |
| `theme.getDesignToken({ token: { colorPrimary } })` 是**纯函数**，Node 里 `require('antd')` 直接可调 | 实测 |
| primary 系列 token 共 10 个：`colorPrimary` / `colorPrimaryBg` / `colorPrimaryBgHover` / `colorPrimaryBorder` / `colorPrimaryBorderHover` / `colorPrimaryHover` / `colorPrimaryActive` / `colorPrimaryTextHover` / `colorPrimaryText` / `colorPrimaryTextActive` | `node_modules/antd/es/theme/interface/maps/colors.d.ts:131-194` |
| `theme.darkAlgorithm` 同样能进 `getDesignToken`，产出暗色调色板 | 实测：`#e91e63` → 亮色 `colorPrimaryHover=#f5477b`、暗色 `#df4271` |
| ming-ui `Dialog` 用 `createPortal` 挂到 `document.body` | `src/ming-ui/components/Dialog/DialogBase.tsx:120,375` |
| 全仓**没有根级 theme `ConfigProvider`**；113 处 `ConfigProvider` 几乎全是 `button={{ autoInsertSpace: false }}` 这种局部配置，不带 `theme`，嵌套时会继承父级 token | `grep -rn ConfigProvider src --include='*.ts*'` |
| `state.appPkg` 是全局 redux slice，`defaultState = { iconColor: '#1677ff', ... }`，`CLEAR_APP_DETAIL` 只在 `AppDetail` 卸载时派发一次 | `src/pages/PageHeader/redux/reducers.ts:11,248` |
| `/app/my/*` 与 `/app/lib/` 走的是 `AppHomepage/AppCenter`（应用中心），**不是** `Application` | `src/router/config.ts:224-231` vs `:240` |
| `/app/:appId` 由 `src/router/Application/index.tsx` 渲染，内部还有一层自己的 `<Routes>` | `src/router/config.ts:240-244` |
| `setBodyThemeMode` 给 `document.documentElement` 设 `data-theme="dark"` | `src/utils/common.ts` |
| `setAppThemeColor` 每调一次往 `<head>` 追加一个 `<style>`（会泄漏），唯一调用点是 `src/pages/Chatbot/index.tsx:120` | `src/utils/common.ts:1420` |
| `var(--color-primary*)` 2893 处、`var(--app-primary-color)` 29 处、`var(--color-app*)` 3 处、`antd-color.less` 522 行 | 实测计数 |

## 关键取舍（与 spec 的两处偏离，都是往简单处走）

1. **spec 写的是 `theme.useToken()`，这里改用 `theme.getDesignToken()`。**
   两者产出同一套 token，但后者是纯函数：不需要在 `ConfigProvider` 子树里调，spec 的「hook 调用位置」风险直接消失，而且映射函数能被现有的 node spec runner 测到。**这是这份计划能有真测试的前提。**

2. **spec 写的是「变量写在应用区域的包裹元素上」，这里改成写在 `document.documentElement` 的 inline style 上，平台外壳反过来用 `.platformThemeScope` 类覆盖。**
   原因是核实出来的硬事实：ming-ui `Dialog` 用 `createPortal` 挂到 `document.body`，**在应用区域包裹元素之外**。按 spec 的写法，应用里弹出的所有对话框都吃不到应用色 —— 而对话框恰恰是主按钮最密集的地方。反过来做之后：
   - inline style 天然压过 `:root {}` 和 `[data-theme='dark'] {}`（两者特异性都是 0,1,0，谁后加载谁赢 —— 靠加载顺序很脆），不用玩特异性把戏；
   - 元素自身匹配到的 `.platformThemeScope` 规则压过从 `documentElement` **继承**下来的值（继承弱于任何直接声明），平台岛照样稳。

## File Structure

| 文件 | 职责 |
| --- | --- |
| `src/common/theme/palette.ts` | **纯**：种子色 + 明暗模式 → CSS 变量键值对。无 DOM、无 React。 |
| `src/common/theme/palette.spec.ts` | 上面那个纯函数的行为 spec。 |
| `src/common/theme/applyThemeVars.ts` | **薄 DOM 层**：把键值对写到任意 `HTMLElement` 的 inline style / 注入平台 `<style>`。无 React。 |
| `src/common/theme/applyThemeVars.spec.ts` | DOM 层的行为 spec（用最小假元素，不需要 jsdom）。 |
| `src/common/theme/AppThemeScope.tsx` | **薄 React 层**：挂载时套应用色、卸载时还原平台色。渲染 `null`。 |
| `src/common/theme/index.ts` | 对外出口。 |
| `tools/audit-colors.ts` | 硬编码色审计 + 棘轮（`--check` 模式）。 |
| `tools/audit-colors.baseline.json` | 棘轮基线。 |
| `docs/superpowers/checklists/theme-visual-pages.md` | 逐页人工目视清单（门禁测不到视觉，这是唯一的兜底）。 |

改动（不新建）：
`src/router/index.tsx`（根 `ConfigProvider`）、`src/router/Application/index.tsx`（挂 `AppThemeScope`）、`src/router/PageHeader/index.tsx`（`<header>` 加平台岛类）、`src/router/App.tsx`（`#chat` / `#chatPanel` 加平台岛类）、`src/common/preall.tsx`（启动时装平台调色板）、`src/utils/common.ts`（`setBodyThemeMode` 里刷新、删 `setAppThemeColor`）、`src/common/mdcss/themes/theme-default.less` 与 `theme-dark.less`（字面值降级成兜底注释）、`package.json`（`check:colors` 脚本）。

---

## Task 1: 硬编码色审计工具 + 棘轮

**为什么第一个做：** 六道门禁**一道都测不到视觉回归**。Task 7 之后要动 3039 处颜色，没有一条「硬编码色只能变少不能变多」的棘轮，改到一半就没人说得清有没有倒退。这个工具顺带产出后面分批需要的真实分区计数。

**Files:**
- Create: `tools/audit-colors.ts`
- Create: `tools/audit-colors.baseline.json`
- Modify: `package.json`（scripts 加一条）

**Interfaces:**
- Consumes: 无
- Produces: `bun run check:colors` 退出码 0/1；`bun run check:colors --stats` 打印分区计数。

- [ ] **Step 1: 写工具**

`tools/audit-colors.ts`：

```ts
#!/usr/bin/env node
/**
 * 硬编码色审计 + 棘轮。
 *
 * 【为什么需要它】六道门禁测的全是类型和纯函数行为，没有一道能发现
 * 「颜色改错了」。视觉重构要动 3000 多处颜色，唯一能自动化的安全网就是
 * 「硬编码色只能变少」这条单调性 —— 它抓不到改错色，但能抓到
 * 「顺手又写死了一个 #1677ff」，而后者才是主题引擎被重新捅穿的方式。
 *
 * 用法：
 *   node tools/audit-colors.ts              # 打印总数
 *   node tools/audit-colors.ts --stats      # 按分区打印
 *   node tools/audit-colors.ts --check      # 对比基线，变多就非 0 退出
 *   node tools/audit-colors.ts --write-baseline
 */
const fs = require('fs');
const path = require('path');

const ROOT: string = path.resolve(__dirname, '..');
const BASELINE: string = path.join(__dirname, 'audit-colors.baseline.json');

/** 只看会进样式的文件。.ts/.tsx 里的内联 style 同样算。 */
const EXTS = new Set(['.less', '.css', '.ts', '.tsx', '.js', '.jsx']);
/** 这些目录是第三方产物或压缩包，不是我们写的。 */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'library', 'mdImg', '.git']);

/** #rgb / #rrggbb / #rrggbbaa / rgb() / rgba() / hsl() / hsla() */
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;

/** 分区：路径前缀 -> 人看得懂的名字。顺序敏感，先匹配到的算数。 */
const AREAS: Array<[string, string]> = [
  ['src/ming-ui/', 'ming-ui 共享组件'],
  ['src/common/mdcss/', '全局样式'],
  ['src/pages/workflow/', '工作流'],
  ['src/pages/Statistics/', '统计'],
  ['src/pages/widgetConfig/', '字段配置'],
  ['src/pages/Admin/', '后台管理'],
  ['src/pages/worksheet/', '工作表'],
  ['src/pages/customPage/', '自定义页面'],
  ['src/components/', '业务组件'],
];

function areaOf(rel: string): string {
  for (const [prefix, name] of AREAS) if (rel.startsWith(prefix)) return name;
  return '其它';
}

function walk(dir: string, out: string[]): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (EXTS.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

export function countColorsInSource(source: string): number {
  const matches = source.match(COLOR_RE);
  return matches ? matches.length : 0;
}

export function collect(): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const file of walk(path.join(ROOT, 'src'), [])) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const n = countColorsInSource(fs.readFileSync(file, 'utf8'));
    if (!n) continue;
    const area = areaOf(rel);
    tally[area] = (tally[area] || 0) + n;
  }
  return tally;
}

function total(tally: Record<string, number>): number {
  return Object.values(tally).reduce((a, b) => a + b, 0);
}

if (require.main === module) {
  const argv: string[] = process.argv.slice(2);
  const tally = collect();

  if (argv.includes('--write-baseline')) {
    fs.writeFileSync(BASELINE, JSON.stringify(tally, null, 2) + '\n');
    console.log(`基线已写入 ${path.relative(ROOT, BASELINE)}，合计 ${total(tally)} 处`);
    process.exit(0);
  }

  if (argv.includes('--stats') || argv.includes('--check')) {
    const rows = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    for (const [area, n] of rows) console.log(String(n).padStart(6), area);
    console.log(String(total(tally)).padStart(6), '合计');
  } else {
    console.log(total(tally));
  }

  if (argv.includes('--check')) {
    if (!fs.existsSync(BASELINE)) {
      console.error('没有基线文件，先跑 --write-baseline');
      process.exit(1);
    }
    const base: Record<string, number> = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    const worse = Object.entries(tally).filter(([area, n]) => n > (base[area] || 0));
    if (worse.length) {
      console.error('\n硬编码色变多了（棘轮只允许变少）：');
      for (const [area, n] of worse) console.error(`  ${area}: ${base[area] || 0} -> ${n}`);
      console.error('\n清掉新增的写死颜色，或者在确有理由时跑 --write-baseline 重设基线并在提交信息里写明原因。');
      process.exit(1);
    }
    console.log('\n棘轮通过：各分区都没有变多。');
  }
}
```

- [ ] **Step 2: 跑一次看真实分布**

```bash
node tools/audit-colors.ts --stats
```

预期：打印各分区计数与合计。合计量级应在 3000 上下（spec 里记的是 3039 处 / 908 个不同色值，统计口径不完全相同，数量级对得上即可）。

- [ ] **Step 3: 写基线**

```bash
node tools/audit-colors.ts --write-baseline
```

- [ ] **Step 4: 验证棘轮真的会拦（负向对照）**

先故意往一个文件里塞一个写死的颜色，确认 `--check` 失败；再撤销，确认通过。

```bash
printf '\n.__audit_probe { color: #123456; }\n' >> src/common/mdcss/themes/theme-default.less
node tools/audit-colors.ts --check; echo "预期非 0，实际 = $?"
git checkout -- src/common/mdcss/themes/theme-default.less
node tools/audit-colors.ts --check; echo "预期 0，实际 = $?"
```

**不做这一步就等于没有棘轮** —— 一个永远返回 0 的检查和没有检查是一回事。

- [ ] **Step 5: 接进 package.json**

在 `scripts` 里加：

```json
"check:colors": "node tools/audit-colors.ts --check"
```

- [ ] **Step 6: 过门禁**

`tools/` 归第 6 道门禁管（`scripts/typecheck/tools-gate.ts`，对 `tools/` 下的 `.ts` 零容忍）。

```bash
bun run typecheck:tools && bun run check:colors
```

- [ ] **Step 7: 提交**

```bash
git add tools/audit-colors.ts tools/audit-colors.baseline.json package.json
git commit -m "chore(theme): 加硬编码色审计棘轮

六道门禁没有一道测得到视觉回归。视觉重构要动 3000 多处颜色，
这条棘轮抓不到「改错色」，但能抓到「顺手又写死一个 #1677ff」——
后者才是主题引擎被重新捅穿的方式。

负向对照验过：塞一个写死色 --check 非 0 退出，撤销后回到 0。"
```

---

## Task 2: `buildThemeVars` 纯函数

**Files:**
- Create: `src/common/theme/palette.ts`
- Test: `src/common/theme/palette.spec.ts`

**Interfaces:**
- Consumes: `antd` 的 `theme.getDesignToken` / `theme.darkAlgorithm`；`@ctrl/tinycolor` 的 `TinyColor`
- Produces:
  ```ts
  export type ThemeMode = 'light' | 'dark';
  export type ThemeVars = Record<string, string>;
  export const PLATFORM_PRIMARY: string;              // '#1677ff'
  export function buildThemeVars(seed: string, mode?: ThemeMode): ThemeVars;
  export function themeVarsToCssText(vars: ThemeVars): string;
  ```

- [ ] **Step 1: 先写失败的 spec**

`src/common/theme/palette.spec.ts`：

```ts
/**
 * buildThemeVars 的行为 spec。
 *
 * 【守的是什么】整个主题引擎的正确性都压在这一个纯函数上：
 * 它之外的两层（写 DOM、React 挂载）薄到只剩三五行。所以这里钉死的
 * 不只是「能跑」，而是三条会被后人悄悄改掉的性质：
 *   1. 调色板【必须】是 antd 算出来的那一套，不是我们另算一份 ——
 *      否则 antd 组件和我们的 Less 会分叉成两种蓝，正是现在要修的病。
 *   2. 暗色【必须】走 darkAlgorithm，不能拿亮色值硬加透明度。
 *   3. 透明度那几档明暗两套取值不同（theme-dark.less 原本就是这么写的），
 *      抄错了暗底上会看不见。
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');

type ThemeVars = Record<string, string>;
type BuildThemeVars = (seed: string, mode?: 'light' | 'dark') => ThemeVars;

function loadPalette(): { buildThemeVars: BuildThemeVars; themeVarsToCssText: (v: ThemeVars) => string } {
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'palette.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports as never;
}

const { buildThemeVars, themeVarsToCssText } = loadPalette();
const { theme } = require('antd');

const SEED = '#e91e63';

// 1. 【核心】主色原样透出，不被二次加工
const light = buildThemeVars(SEED, 'light');
assert.strictEqual(light['--color-primary'], SEED);

// 2. 【核心】hover / active 必须等于 antd 自己算的值 —— 这条就是「不分叉」
const antdLight = theme.getDesignToken({ token: { colorPrimary: SEED } });
assert.strictEqual(light['--color-primary-light'], antdLight.colorPrimaryHover);
assert.strictEqual(light['--color-primary-dark'], antdLight.colorPrimaryActive);

// 3. 【核心】暗色走 darkAlgorithm，而不是亮色值
const dark = buildThemeVars(SEED, 'dark');
const antdDark = theme.getDesignToken({ token: { colorPrimary: SEED }, algorithm: theme.darkAlgorithm });
assert.strictEqual(dark['--color-primary'], antdDark.colorPrimary);
assert.notStrictEqual(dark['--color-primary'], light['--color-primary']);

// 4. 透明档：明暗两套取值不同（对应 theme-default.less 的 .4/.12/.06 与 theme-dark.less 的 .5/.2/.12）
assert.strictEqual(light['--color-primary-focus-outer'], 'rgba(233, 30, 99, 0.4)');
assert.strictEqual(light['--color-primary-transparent'], 'rgba(233, 30, 99, 0.12)');
assert.strictEqual(light['--color-primary-transparent-light'], 'rgba(233, 30, 99, 0.06)');
assert.strictEqual(dark['--color-primary-focus-outer'], `rgba(${rgbOf(antdDark.colorPrimary)}, 0.5)`);
assert.strictEqual(dark['--color-primary-transparent'], `rgba(${rgbOf(antdDark.colorPrimary)}, 0.2)`);
assert.strictEqual(dark['--color-primary-transparent-light'], `rgba(${rgbOf(antdDark.colorPrimary)}, 0.12)`);

// 5. 应用色三个变量跟主色同源（spec 要求 --color-app 系列并入主色）
assert.strictEqual(light['--color-app'], light['--color-primary']);
assert.strictEqual(light['--color-app-light'], light['--color-primary-light']);
assert.strictEqual(light['--color-app-dark'], light['--color-primary-dark']);

// 6. 旧的 --app-primary-color 三兄弟也由同一套产出（Task 6 才删，过渡期要能共存）
assert.strictEqual(light['--app-primary-color'], light['--color-primary']);
assert.strictEqual(light['--app-primary-hover-color'], light['--color-primary-light']);
assert.strictEqual(light['--app-highlight-color'], 'rgba(233, 30, 99, 0.2)');

// 7. mode 缺省 = light
assert.deepStrictEqual(buildThemeVars(SEED), light);

// 8. 非法种子色不能让整站崩：退回平台色而不是抛
const bogus = buildThemeVars('not-a-color', 'light');
assert.strictEqual(bogus['--color-primary'], '#1677ff');

// 9. themeVarsToCssText 产出可直接塞进 <style> 的声明串
assert.strictEqual(themeVarsToCssText({ '--a': '#fff', '--b': 'red' }), '--a:#fff;--b:red;');

// 10. 键集合稳定：三处消费者（inline style / 平台 <style> / 卸载时还原）靠同一份键
assert.deepStrictEqual(Object.keys(light).sort(), Object.keys(dark).sort());

function rgbOf(hex: string): string {
  const { TinyColor } = require('@ctrl/tinycolor');
  const { r, g, b } = new TinyColor(hex).toRgb();
  return `${r}, ${g}, ${b}`;
}

console.log('palette.spec: 10 组断言全部通过');
```

- [ ] **Step 2: 跑，确认它失败**

```bash
node scripts/run-specs.ts --filter palette
```

预期：FAIL，报 `palette.ts` 找不到。

- [ ] **Step 3: 写实现**

`src/common/theme/palette.ts`：

```ts
/**
 * 主题调色板：种子色 -> CSS 自定义属性。
 *
 * 【为什么是纯函数】它是整个主题引擎唯一有逻辑的地方，另外两层
 * （写 DOM、React 挂载）薄到只剩三五行。纯函数才能被本仓的 spec
 * runner 测到 —— 本仓没有 jsdom/vitest/jest，79 个 spec 全是
 * node + assert，不存在「渲染一个组件再断言」这个选项。
 *
 * 【为什么用 getDesignToken 而不是 theme.useToken()】两者产出同一套
 * token，但前者是纯函数、不要求在 ConfigProvider 子树里调用。设计文档里
 * 「useToken 的调用位置」那条风险因此直接不存在了。
 *
 * 【调色板绝不能分叉】下面每个值要么原样取自 antd 的 token，要么是对
 * token 加一档透明度。我们【不】自己算 lighten/darken —— 那样 antd 组件
 * 和我们的 Less 会得到两种不同的蓝，正是这次要修的病。
 */
import { theme } from 'antd';
import { TinyColor } from '@ctrl/tinycolor';

export type ThemeMode = 'light' | 'dark';
export type ThemeVars = Record<string, string>;

/**
 * 平台色 = theme-default.less 里 --color-primary 的字面值。
 * 以后要做「组织级品牌色」的话，改成从组织设置里读即可，这里是唯一入口。
 */
export const PLATFORM_PRIMARY = '#1677ff';

/**
 * 透明档的取值。明暗两套【故意不同】，直接照搬自
 * theme-default.less（.4 / .12 / .06）与 theme-dark.less（.5 / .2 / .12）——
 * 暗底上同样的 alpha 会看不见，原作者已经调过，不要合并成一套。
 */
const ALPHA: Record<ThemeMode, { focusOuter: number; transparent: number; transparentLight: number }> = {
  light: { focusOuter: 0.4, transparent: 0.12, transparentLight: 0.06 },
  dark: { focusOuter: 0.5, transparent: 0.2, transparentLight: 0.12 },
};

/** --app-highlight-color 原本就是 setAlpha(0.2)，明暗一致，见 utils/common.ts 里的旧实现。 */
const HIGHLIGHT_ALPHA = 0.2;

function alpha(color: string, a: number): string {
  return new TinyColor(color).setAlpha(a).toRgbString();
}

export function buildThemeVars(seed: string, mode: ThemeMode = 'light'): ThemeVars {
  // 非法色不能让整站没主题色。TinyColor 对乱字符串返回 isValid=false 而不是抛，
  // 但 antd 的算法拿到它会产出一串 NaN 颜色，界面会变成透明/黑块。
  const safeSeed = new TinyColor(seed).isValid ? seed : PLATFORM_PRIMARY;

  const token = theme.getDesignToken({
    token: { colorPrimary: safeSeed },
    ...(mode === 'dark' ? { algorithm: theme.darkAlgorithm } : {}),
  });

  const a = ALPHA[mode];
  const primary = token.colorPrimary;

  return {
    // ——— 主色（theme-default.less 的 7 个）———
    '--color-primary': primary,
    '--color-primary-light': token.colorPrimaryHover,
    '--color-primary-dark': token.colorPrimaryActive,
    '--color-primary-focus': primary,
    '--color-primary-focus-outer': alpha(primary, a.focusOuter),
    '--color-primary-transparent': alpha(primary, a.transparent),
    '--color-primary-transparent-light': alpha(primary, a.transparentLight),

    // ——— 应用色（theme-default.less 的 4 个）———
    // 原注释写「由各个模块定义，未传入时和主色一致」，但全仓没有一处赋值，
    // 是死变量。归一之后它和主色永远同源，Task 6 会把这 3 处引用改掉再删。
    '--color-app': primary,
    '--color-app-light': token.colorPrimaryHover,
    '--color-app-dark': token.colorPrimaryActive,
    '--color-app-transparent': alpha(primary, a.transparent),

    // ——— 旧的 setAppThemeColor 三兄弟 ———
    // 29 处引用还在，Task 6 才改指 --color-primary。过渡期由这里一并产出，
    // 保证「两条路并存时结果一致」。
    '--app-primary-color': primary,
    '--app-primary-hover-color': token.colorPrimaryHover,
    '--app-highlight-color': alpha(primary, HIGHLIGHT_ALPHA),
  };
}

/** 拼成可直接塞进 <style> 的声明串。 */
export function themeVarsToCssText(vars: ThemeVars): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
}
```

- [ ] **Step 4: 跑，确认通过**

```bash
node scripts/run-specs.ts --filter palette
```

预期：PASS，打印「10 组断言全部通过」。

- [ ] **Step 5: 负向对照 —— 确认 spec 真的在测东西**

把 `'--color-primary-light': token.colorPrimaryHover` 临时改成 `token.colorPrimaryActive`，重跑，必须 FAIL；改回来，必须 PASS。**这一步不能省**：第 2 组断言是整份计划里唯一钉住「不分叉」的地方，它如果恒真就白写了。

- [ ] **Step 6: 过门禁并提交**

```bash
bun run typecheck:syntax && bun run typecheck:fast && bun run typecheck:strict && bun run check:ext-collisions && node scripts/run-specs.ts && bun run typecheck:tools
```

```bash
git add src/common/theme/palette.ts src/common/theme/palette.spec.ts
git commit -m "feat(theme): 加 buildThemeVars —— 种子色到 CSS 变量的纯映射

antd 的 getDesignToken 是纯函数，所以调色板算得出来也测得到，
不需要 React 环境（本仓没有 jsdom/vitest/jest）。

每个值要么原样取自 antd token，要么是对 token 加一档透明度，
不自己算 lighten/darken —— 否则 antd 组件和我们的 Less 会分叉成
两种蓝，那正是这次要修的病。spec 第 2 组断言专门钉这条。"
```

---

## Task 3: `applyThemeVars` —— 写 DOM 的薄层

**Files:**
- Create: `src/common/theme/applyThemeVars.ts`
- Test: `src/common/theme/applyThemeVars.spec.ts`

**Interfaces:**
- Consumes: Task 2 的 `buildThemeVars` / `themeVarsToCssText` / `PLATFORM_PRIMARY` / `ThemeVars` / `ThemeMode`
- Produces:
  ```ts
  export const PLATFORM_SCOPE_CLASS: string;               // 'platformThemeScope'
  export function currentThemeMode(): ThemeMode;
  export function applyThemeVars(el: ElementLike, vars: ThemeVars): void;
  export function clearThemeVars(el: ElementLike, vars: ThemeVars): void;
  export function installPlatformTheme(): void;
  export function applyAppTheme(seed: string): void;
  export function resetToPlatformTheme(): void;
  ```
  `ElementLike` = `{ style: { setProperty(k, v): void; removeProperty(k): void } }` —— 故意窄到只要求用得上的两个方法，spec 才能用几行假对象测，不必引 jsdom。

- [ ] **Step 1: 先写失败的 spec**

`src/common/theme/applyThemeVars.spec.ts`：

```ts
/**
 * applyThemeVars 的行为 spec。
 *
 * 【守的是什么】这一层只做三件事，但每件都有一个会静默出错的方式：
 *   1. 写 inline style —— 写错属性名不会报错，只会「主题色没生效」。
 *   2. 卸载时【逐键删除】而不是整体清空 —— 整体清空会顺带抹掉别人写在
 *      documentElement 上的 inline 样式（比如无障碍缩放）。
 *   3. 平台 <style> 只注入一次 —— 每次调用都 append 的话就是
 *      setAppThemeColor 那个老毛病（每调一次往 head 塞一个 style）。
 *
 * 本仓没有 jsdom，所以这里用最小假元素。ElementLike 的类型也是照着
 * 「只要求 setProperty/removeProperty」写的，正是为了这一点。
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');

function load(file: string) {
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports as never;
}

function fakeEl() {
  const props: Record<string, string> = {};
  return {
    props,
    style: {
      setProperty: (k: string, v: string) => {
        props[k] = v;
      },
      removeProperty: (k: string) => {
        delete props[k];
      },
    },
  };
}

const { applyThemeVars, clearThemeVars, PLATFORM_SCOPE_CLASS } = load('applyThemeVars.ts') as any;

// 1. 写入：键值原样落到 inline style
const el = fakeEl();
applyThemeVars(el, { '--color-primary': '#e91e63', '--color-app': '#e91e63' });
assert.deepStrictEqual(el.props, { '--color-primary': '#e91e63', '--color-app': '#e91e63' });

// 2. 【核心】清除是逐键删，不碰别人写的 inline 样式
el.style.setProperty('zoom', '1.2'); // 假装别人写的
clearThemeVars(el, { '--color-primary': '', '--color-app': '' });
assert.deepStrictEqual(el.props, { zoom: '1.2' });

// 3. 重复 apply 是覆盖而不是叠加
const el2 = fakeEl();
applyThemeVars(el2, { '--color-primary': '#111111' });
applyThemeVars(el2, { '--color-primary': '#222222' });
assert.deepStrictEqual(el2.props, { '--color-primary': '#222222' });

// 4. 空对象是安全的 no-op
const el3 = fakeEl();
applyThemeVars(el3, {});
clearThemeVars(el3, {});
assert.deepStrictEqual(el3.props, {});

// 5. 平台岛类名是这个确切的字符串 —— App.tsx / PageHeader 里手写的那几处靠它
assert.strictEqual(PLATFORM_SCOPE_CLASS, 'platformThemeScope');

console.log('applyThemeVars.spec: 5 组断言全部通过');
```

- [ ] **Step 2: 跑，确认失败**

```bash
node scripts/run-specs.ts --filter applyThemeVars
```

预期：FAIL，`applyThemeVars.ts` 不存在。

- [ ] **Step 3: 写实现**

`src/common/theme/applyThemeVars.ts`：

```ts
/**
 * 把调色板写进 DOM。这一层【故意薄】—— 有逻辑的部分都在 palette.ts 里。
 *
 * 【为什么写 documentElement 的 inline style，而不是应用区域的包裹元素】
 * 设计文档原本写的是后者。核实时发现一条硬事实推翻了它：
 * ming-ui 的 Dialog 用 createPortal 挂到 document.body
 * （src/ming-ui/components/Dialog/DialogBase.tsx:120,375），
 * 在应用区域包裹元素【之外】。按原方案，应用里弹出的所有对话框都吃不到
 * 应用色 —— 而对话框正是主按钮最密集的地方。
 *
 * 反过来做还顺带解决了特异性问题：inline style 天然压过
 * `:root {}` 和 `[data-theme='dark'] {}`（两者特异性都是 0,1,0，
 * 谁后加载谁赢，靠加载顺序很脆）。
 *
 * 平台外壳则用 .platformThemeScope 类把平台调色板重新声明回去：
 * 元素【自身匹配到】的规则压过从 documentElement【继承】下来的值，
 * 继承弱于任何直接声明。
 */
import { buildThemeVars, PLATFORM_PRIMARY, themeVarsToCssText } from './palette';
import type { ThemeMode, ThemeVars } from './palette';

/** 只要求用得上的两个方法，这样 spec 能用几行假对象测，不必引 jsdom。 */
export interface ElementLike {
  style: { setProperty(key: string, value: string): void; removeProperty(key: string): void };
}

export const PLATFORM_SCOPE_CLASS = 'platformThemeScope';

const PLATFORM_STYLE_ID = 'md-platform-theme';

/** 暗色的唯一真相是 setBodyThemeMode 设在 documentElement 上的 data-theme。 */
export function currentThemeMode(): ThemeMode {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function applyThemeVars(el: ElementLike, vars: ThemeVars): void {
  for (const [key, value] of Object.entries(vars)) el.style.setProperty(key, value);
}

/**
 * 【逐键删，不要整体清空】documentElement 的 inline style 不只有我们在写，
 * 一把 cssText = '' 会顺带抹掉别人的。
 */
export function clearThemeVars(el: ElementLike, vars: ThemeVars): void {
  for (const key of Object.keys(vars)) el.style.removeProperty(key);
}

/**
 * 注入平台岛的样式规则。【只注入一次】——
 * 旧的 setAppThemeColor 每调一次就往 head 追加一个 <style>，
 * 那是个泄漏，不要重蹈。
 */
function ensurePlatformStyle(): HTMLStyleElement {
  const existing = document.getElementById(PLATFORM_STYLE_ID);
  if (existing) return existing as HTMLStyleElement;

  const style = document.createElement('style');
  style.id = PLATFORM_STYLE_ID;
  document.head.appendChild(style);
  return style;
}

function platformVars(): ThemeVars {
  return buildThemeVars(PLATFORM_PRIMARY, currentThemeMode());
}

/** 启动时调一次；切换明暗时再调一次。 */
export function installPlatformTheme(): void {
  const vars = platformVars();
  applyThemeVars(document.documentElement, vars);
  ensurePlatformStyle().textContent = `.${PLATFORM_SCOPE_CLASS}{${themeVarsToCssText(vars)}}`;
}

/** 进入某个应用时调。 */
export function applyAppTheme(seed: string): void {
  applyThemeVars(document.documentElement, buildThemeVars(seed, currentThemeMode()));
}

/** 离开应用时调 —— 不是「清空」，是「还原成平台色」。 */
export function resetToPlatformTheme(): void {
  applyThemeVars(document.documentElement, platformVars());
}
```

- [ ] **Step 4: 跑，确认通过**

```bash
node scripts/run-specs.ts --filter applyThemeVars
```

预期：PASS。

- [ ] **Step 5: 负向对照**

把 `clearThemeVars` 临时改成 `el.style.cssText = ''` 的等价写法（对假元素来说就是清空 `props`），重跑，第 2 组必须 FAIL。改回来。

- [ ] **Step 6: 出口文件**

`src/common/theme/index.ts`：

```ts
export { buildThemeVars, themeVarsToCssText, PLATFORM_PRIMARY } from './palette';
export type { ThemeMode, ThemeVars } from './palette';
export {
  applyAppTheme,
  applyThemeVars,
  clearThemeVars,
  currentThemeMode,
  installPlatformTheme,
  resetToPlatformTheme,
  PLATFORM_SCOPE_CLASS,
} from './applyThemeVars';
export { default as AppThemeScope } from './AppThemeScope';
```

**注意：** `AppThemeScope` 在 Task 4 才建，这一行先不要写 —— 写了 `typecheck:syntax` 当场红。本步只导出前两个模块，Task 4 再补最后一行。

- [ ] **Step 7: 过门禁并提交**

```bash
bun run typecheck:syntax && bun run typecheck:fast && bun run typecheck:strict && bun run check:ext-collisions && node scripts/run-specs.ts && bun run typecheck:tools
```

```bash
git add src/common/theme/applyThemeVars.ts src/common/theme/applyThemeVars.spec.ts src/common/theme/index.ts
git commit -m "feat(theme): 加 applyThemeVars —— 调色板落到 DOM 的薄层

变量写 documentElement 的 inline style，不是应用区域包裹元素：
ming-ui 的 Dialog createPortal 到 document.body（DialogBase.tsx:120,375），
在包裹元素之外，按原方案应用里所有对话框都吃不到应用色。
inline 还顺带压过 :root 和 [data-theme=dark]，不用玩特异性把戏。

平台外壳改用 .platformThemeScope 类把平台色声明回去 ——
自身匹配的规则压过从 documentElement 继承下来的值。"
```

---

## Task 4: 接线 —— 根 `ConfigProvider` + `AppThemeScope` + 平台岛

**Files:**
- Create: `src/common/theme/AppThemeScope.tsx`
- Modify: `src/common/theme/index.ts`（补最后一行导出）
- Modify: `src/router/index.tsx`（根 `ConfigProvider`）
- Modify: `src/router/Application/index.tsx`（挂 `AppThemeScope`）
- Modify: `src/router/PageHeader/index.tsx:18`（`<header>` 加类）
- Modify: `src/router/App.tsx:144,149`（`#chatPanel` / `#chat` 加类）
- Modify: `src/common/preall.tsx`（启动时 `installPlatformTheme()`）

**Interfaces:**
- Consumes: Task 3 的 `applyAppTheme` / `resetToPlatformTheme` / `installPlatformTheme` / `PLATFORM_SCOPE_CLASS`；Task 2 的 `PLATFORM_PRIMARY`
- Produces: `<AppThemeScope seed={string} />`，渲染 `null`，只有副作用。

- [ ] **Step 1: 写 `AppThemeScope`**

`src/common/theme/AppThemeScope.tsx`：

```tsx
import { useEffect } from 'react';
import { applyAppTheme, resetToPlatformTheme } from './applyThemeVars';

interface Props {
  /** 应用主题色，取自 state.appPkg.iconColor。 */
  seed?: string;
}

/**
 * 进入应用时把调色板换成应用色，离开时还原成平台色。渲染 null。
 *
 * 【为什么挂在 Application 里而不是按路径判断】/app/my/* 和 /app/lib/
 * 走的是 AppHomepage/AppCenter（应用中心），不是 Application
 * —— 见 src/router/config.ts:224-231 与 :240。react-router v7 里
 * 静态段排序恒高于动态段，所以「挂在 Application 内部」这件事本身
 * 就已经把应用中心排除掉了，不需要再写一个 /^\/app\// 的谓词
 * （写了反而会把应用中心误判成应用）。
 *
 * 【为什么不靠 state.appPkg.id 判断在不在应用里】CLEAR_APP_DETAIL
 * 只在 AppDetail 卸载时派发一次（AppDetail/index.tsx:248），
 * 不是所有应用路由都挂了它。组件自身的卸载才是可靠信号。
 */
export default function AppThemeScope({ seed }: Props) {
  useEffect(() => {
    if (!seed) return;
    applyAppTheme(seed);
  }, [seed]);

  useEffect(() => resetToPlatformTheme, []);

  return null;
}
```

- [ ] **Step 2: 补出口**

在 `src/common/theme/index.ts` 末尾加：

```ts
export { default as AppThemeScope } from './AppThemeScope';
```

- [ ] **Step 3: 启动时装平台调色板**

`src/common/preall.tsx`：在设置 locale 那段（约 200 行，`moment.locale(dateLocale)` 附近）之后加一行，并在文件顶部 import。

```tsx
import { installPlatformTheme } from 'src/common/theme';
```

```tsx
// 装平台调色板。必须在首屏渲染前跑：否则 theme-default.less 的字面值
// 会先显示一帧再被换掉。装完之后那些字面值就只是「JS 没执行时的兜底」。
installPlatformTheme();
```

- [ ] **Step 4: 根 `ConfigProvider`**

`src/router/index.tsx` 整体替换为：

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import { GlobalStoreProvider } from 'src/common/GlobalStore';
import store from 'src/redux/configureStore';
import { PLATFORM_PRIMARY } from 'src/common/theme';
import App from './App';

const root = createRoot(document.getElementById('app'));

// 全仓原先【没有】根级 theme ConfigProvider：113 处 ConfigProvider 几乎全是
// button={{ autoInsertSpace: false }} 这种局部配置，不带 theme，嵌套时会继承
// 父级 token，所以在这里加一层是安全的。
//
// 这里只给平台色。应用区域的 antd token 由 Application 里的 ConfigProvider
// 覆盖（见 src/router/Application/index.tsx）。
root.render(
  <Provider store={store}>
    <GlobalStoreProvider>
      <ConfigProvider theme={{ token: { colorPrimary: PLATFORM_PRIMARY } }}>
        <Router>
          <App />
        </Router>
      </ConfigProvider>
    </GlobalStoreProvider>
  </Provider>,
);
```

- [ ] **Step 5: 应用区域接上**

`src/router/Application/index.tsx`：

顶部补 import：

```tsx
import { ConfigProvider } from 'antd';
import { AppThemeScope } from 'src/common/theme';
```

`mapStateToProps` 里补一个字段（该文件已经 `connect` 过，找到它的 `mapStateToProps` 加一行）：

```ts
appIconColor: state.appPkg.iconColor,
```

`render()` 里，把原来返回的 `<Routes>…</Routes>` 子树整体包起来：

```tsx
<ConfigProvider theme={{ token: { colorPrimary: this.props.appIconColor } }}>
  {/* 渲染 null，只有副作用：把 CSS 变量换成应用色，卸载时还原平台色。
      两条路必须同源 —— 上面 ConfigProvider 喂给 antd 的、和 AppThemeScope
      写进 CSS 变量的，是同一个 iconColor 经同一套 antd 算法算出来的。 */}
  <AppThemeScope seed={this.props.appIconColor} />
  <Routes>{/* …原有内容原样保留… */}</Routes>
</ConfigProvider>
```

- [ ] **Step 6: 平台岛加类**

`src/router/PageHeader/index.tsx:18`：

```tsx
import { PLATFORM_SCOPE_CLASS } from 'src/common/theme';
```
```tsx
<header className={PLATFORM_SCOPE_CLASS}>
```

`src/router/App.tsx`，两处 `<section>` 加类（第 144 行与第 149 行附近）：

```tsx
<section id="chatPanel" className={PLATFORM_SCOPE_CLASS}>{rp && <ChatPanel />}</section>
```
```tsx
<section id="chat" className={PLATFORM_SCOPE_CLASS}>
```

同样在 `App.tsx` 顶部补 import。**这三处都是给已有元素加 className，不新增任何 DOM 节点** —— `#containerWrapper` 是 flex 容器，往里塞包裹 div 会改变 flex 布局。

- [ ] **Step 7: 过门禁**

```bash
bun run typecheck:syntax && bun run typecheck:fast && bun run typecheck:strict && bun run check:ext-collisions && node scripts/run-specs.ts && bun run typecheck:tools && bun run check:colors
```

- [ ] **Step 8: 在真实环境验「两条路不分叉」**

这一条**门禁测不到**，必须手动验，而且是整个子项目 A 唯一能证伪核心假设（`getDesignToken` 与 `ConfigProvider` 产出同一套 token）的地方。

进一个应用页面，在浏览器控制台跑：

```js
const el = document.querySelector('.ant-btn-primary');
getComputedStyle(el).backgroundColor === getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
  ? 'OK：antd 与 CSS 变量同源'
  : ['分叉了', getComputedStyle(el).backgroundColor, getComputedStyle(document.documentElement).getPropertyValue('--color-primary')];
```

两边取值要么都是 hex 要么都是 rgb()，比较前先归一化（用 `new Option().style.color = x` 再读回也行）。**结果不一致就停下**，说明 `getDesignToken` 和 `ConfigProvider` 的 seed 传法有差异，后面所有任务都建立在这条假设上。

- [ ] **Step 9: 提交**

```bash
git add src/common/theme src/router/index.tsx src/router/Application/index.tsx src/router/PageHeader/index.tsx src/router/App.tsx src/common/preall.tsx
git commit -m "feat(theme): 把应用主题色接到 CSS 变量与 antd token 上

一处输入（state.appPkg.iconColor），两路输出：
antd 组件走 ConfigProvider 的 token，我们的 Less 走 CSS 变量，
两者都由同一个 iconColor 经同一套 antd 算法算出，不会分叉。

挂在 Application 内部而不是按 /app/ 路径判断：/app/my/* 和 /app/lib/
走的是应用中心（config.ts:224-231），路径谓词会把它误判成应用。

平台外壳三处只加 className 不加 DOM ——
#containerWrapper 是 flex 容器，塞包裹 div 会改布局。"
```

---

## Task 5: 暗色跟随

**Files:**
- Modify: `src/utils/common.ts`（`setBodyThemeMode` 末尾刷新调色板）
- Modify: `src/common/mdcss/themes/theme-default.less`（主色与应用色那 11 行加兜底说明）
- Modify: `src/common/mdcss/themes/theme-dark.less`（同上）

**Interfaces:**
- Consumes: Task 3 的 `installPlatformTheme`
- Produces: 无新导出。

- [ ] **Step 1: 明暗切换时刷新**

`src/common/theme/applyThemeVars.ts` 里的 `currentThemeMode()` 读的是 `data-theme`，而 `setBodyThemeMode` 是**设**它的人 —— 设完必须重算一次，否则切到暗色后主色还停在亮色档（透明档的 alpha 尤其明显：暗底上 0.06 基本看不见）。

`src/utils/common.ts` 的 `setBodyThemeMode` 末尾加：

```ts
  // data-theme 变了，调色板的明暗档也得跟着重算 ——
  // 暗色用的是 darkAlgorithm 和另一套 alpha（.5/.2/.12 而不是 .4/.12/.06），
  // 不重算的话切到暗色后聚焦环和高亮底基本看不见。
  installPlatformTheme();
```

并在文件顶部 import：

```ts
import { installPlatformTheme } from 'src/common/theme';
```

**注意循环依赖**：`src/common/theme/applyThemeVars.ts` 不 import `src/utils/common`，所以这条边是单向的。实施时确认一下 `palette.ts` / `applyThemeVars.ts` 的 import 列表里没有 `src/utils/common`（按 Task 2/3 写出来的版本是没有的）。

- [ ] **Step 2: 应用区域的暗色**

`AppThemeScope` 现在只在 `seed` 变化时 apply，明暗切换时不会重跑。补一个监听：

`src/common/theme/AppThemeScope.tsx` 里把第一个 `useEffect` 换成：

```tsx
  useEffect(() => {
    if (!seed) return undefined;
    applyAppTheme(seed);

    // setBodyThemeMode 改的是 documentElement 上的 data-theme。
    // 平台层由 setBodyThemeMode 自己调 installPlatformTheme 刷新，
    // 但那一刷会把 documentElement 写回【平台色】—— 在应用里这是错的，
    // 所以这里盯住属性变化再把应用色盖回去。
    const observer = new MutationObserver(() => applyAppTheme(seed));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [seed]);
```

- [ ] **Step 3: Less 字面值降级成兜底**

`theme-default.less` 顶部主色那段，注释改成：

```less
:root {
  /* ================= 主色 =================
    【运行期这一段由 JS 覆盖】src/common/theme 会把 antd token 算出的调色板
    写成 documentElement 的 inline style，优先级高于这里。
    下面的字面值现在只是【JS 执行前的兜底】——首屏那一帧的默认外观。
    要改主题色请改 state.appPkg.iconColor 或 src/common/theme/palette.ts 里的
    PLATFORM_PRIMARY，改这里不会有任何运行期效果。
  */
```

`theme-dark.less` 的 `[data-theme='dark']` 块顶部加同样口径的一段注释。

**不要删这些字面值** —— 它们是 JS 未执行时的兜底，删了首屏会没有主色。

- [ ] **Step 4: 过门禁**

```bash
bun run typecheck:syntax && bun run typecheck:fast && bun run typecheck:strict && bun run check:ext-collisions && node scripts/run-specs.ts && bun run typecheck:tools && bun run check:colors
```

- [ ] **Step 5: 手动验暗色不回归**

浏览器里跑：

```js
window.setBodyThemeMode ? setBodyThemeMode('dark') : document.documentElement.setAttribute('data-theme', 'dark');
getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
```

分别在**应用内**和**平台页（/admin）**各验一次：
- 平台页切暗色 → `--color-primary` 应该是 `#1677ff` 经 darkAlgorithm 算出的暗色值，**不是** `#1677ff` 本身；
- 应用内切暗色 → 应该是该应用 `iconColor` 经 darkAlgorithm 算出的值；
- 切回亮色 → 两边都回到亮色档。

再按 spec 的约束逐个看一眼 `WaterMark` / `MdMarkdown` / `Checkbox` —— 它们内部有明暗分支，是暗色回归最可能暴露的地方。

- [ ] **Step 6: 提交**

```bash
git add src/utils/common.ts src/common/theme/AppThemeScope.tsx src/common/mdcss/themes/theme-default.less src/common/mdcss/themes/theme-dark.less
git commit -m "feat(theme): 暗色走 darkAlgorithm，Less 字面值降级成兜底

setBodyThemeMode 设完 data-theme 必须重算调色板：暗色除了换算法
还换了一套 alpha（.5/.2/.12 而不是 .4/.12/.06），不重算的话
暗底上聚焦环和高亮底基本看不见。

应用内额外盯 data-theme 的属性变化 —— 平台那一刷会把 documentElement
写回平台色，在应用里是错的。

Less 里的字面值【不删】，它们现在是 JS 执行前那一帧的兜底。"
```

---

## Task 6: 退役 `--color-app` / `--app-primary-color` / `setAppThemeColor`

**Files:**
- Modify: `src/utils/common.ts:1420`（删 `setAppThemeColor`）
- Modify: `src/pages/Chatbot/index.tsx:19,120`（删调用）
- Modify: 引用 `var(--app-primary-color)` / `var(--app-primary-hover-color)` / `var(--app-highlight-color)` 的 24 个文件（29 处）
- Modify: 引用 `var(--color-app*)` 的文件（3 处）
- Modify: `src/common/theme/palette.ts`（删掉这 7 个已无人引用的键）
- Modify: `src/common/theme/palette.spec.ts`（删第 5、6 组断言）
- Modify: `src/common/mdcss/themes/theme-default.less` / `theme-dark.less`（删应用色那 4 行）

- [ ] **Step 1: 列出全部引用点**

```bash
grep -rn 'var(--app-primary-color\|var(--app-primary-hover-color\|var(--app-highlight-color\|var(--color-app' src --include='*.less' --include='*.css' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx'
```

预期：29 + 3 = 32 处左右（`--app-primary-color` 29 处分布在 24 个文件里）。

- [ ] **Step 2: 逐处替换**

映射固定，**逐处看一眼再改，不要 sed 全量替换**：

| 旧 | 新 |
| --- | --- |
| `var(--app-primary-color)` | `var(--color-primary)` |
| `var(--app-primary-hover-color)` | `var(--color-primary-light)` |
| `var(--app-highlight-color)` | `var(--color-primary-transparent)` |
| `var(--color-app)` | `var(--color-primary)` |
| `var(--color-app-light)` | `var(--color-primary-light)` |
| `var(--color-app-dark)` | `var(--color-primary-dark)` |
| `var(--color-app-transparent)` | `var(--color-primary-transparent)` |

注意 `--app-highlight-color` 原本是 alpha 0.2，`--color-primary-transparent` 亮色是 0.12。**这是一处真实的视觉变化**（高亮底变浅）。两个选择：接受统一（推荐，因为 0.2 那一档只服务 Chatbot 一个页面），或者保留一个 `--color-primary-highlight` 变量。**选了哪个要写进提交信息**，别让后人以为是手滑。

- [ ] **Step 3: 删 `setAppThemeColor`**

`src/utils/common.ts` 删掉整个函数（约 1420-1426 行）；`src/pages/Chatbot/index.tsx` 删 import（第 19 行里的那个名字）和第 120 行的调用。

Chatbot 的应用色从此由 `AppThemeScope` 负责 —— 但 Chatbot 不在 `Application` 子树里（它是 `/chatbot` 独立路由）。**所以这一步必须同时在 Chatbot 里挂上 `AppThemeScope`**：

```tsx
<AppThemeScope seed={appItem[0].iconColor} />
```

放在原来调 `setAppThemeColor` 的那个组件的 render 里。没挂就是功能回归 —— Chatbot 会丢掉应用色。

- [ ] **Step 4: 从调色板里删掉这 7 个键**

`palette.ts` 的返回对象里删掉 `--color-app` / `--color-app-light` / `--color-app-dark` / `--color-app-transparent` / `--app-primary-color` / `--app-primary-hover-color` / `--app-highlight-color`，连同 `HIGHLIGHT_ALPHA` 常量。`palette.spec.ts` 删掉第 5、6 组断言。

- [ ] **Step 5: Less 里删应用色那段**

`theme-default.less` 与 `theme-dark.less` 里 `--color-app*` 四行连同上面那段「由各个模块定义」的注释一起删 —— 那段注释描述的机制从来没实现过。

- [ ] **Step 6: 确认清干净**

```bash
grep -rn 'app-primary-color\|app-highlight-color\|color-app\b\|setAppThemeColor' src --include='*.less' --include='*.css' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' | grep -v node_modules
```

预期：无输出。

- [ ] **Step 7: 过门禁并提交**

```bash
bun run typecheck:syntax && bun run typecheck:fast && bun run typecheck:strict && bun run check:ext-collisions && node scripts/run-specs.ts && bun run typecheck:tools && bun run check:colors
```

```bash
git add -A src
git commit -m "refactor(theme): 退役 --color-app / --app-primary-color / setAppThemeColor

--color-app 系列是死变量：注释写着「由各个模块定义」，但全仓一处赋值都没有。

--app-primary-color 唯一注入点 setAppThemeColor 只在 Chatbot 被调过一次，
而且每调一次往 head 追加一个 <style>。改由 AppThemeScope 统一负责，
Chatbot 里同步挂上 —— 它不在 Application 子树里，不挂就丢应用色。

--app-highlight-color 原本 alpha 0.2，并入 --color-primary-transparent 后
亮色是 0.12，高亮底会变浅一点。这是有意统一，不是手滑。"
```

---

## Task 7: ming-ui `Button` 内部换 antd

**为什么从 Button 开始：** 252 个引用点，是「主题色跟随」最可见的载体，而且 API 面最小。跑通之后 Checkbox(281) / Radio(100) / RadioGroup(93) / Menu(111) / Dropdown(256) / Dialog(553) 按同一套流程做。

**Files:**
- Modify: `src/ming-ui/components/Button/`（内部实现）
- Test: `src/ming-ui/components/Button/Button.spec.ts`

**Interfaces:**
- Consumes: 无（纯内部替换）
- Produces: `ming-ui` 的 `Button` 对外 API **一个字都不变**。

- [ ] **Step 1: 先把现有 API 面钉下来**

**不要先动实现。** 先读 `src/ming-ui/components/Button/` 的全部源码，把它接受的每个 prop、每个 className 分支、每个默认值列成一张表写进 `Button.spec.ts` 的头注释里。252 个调用点用到的组合远多于文档里写的。

```bash
grep -rn "from 'ming-ui'" src --include='*.tsx' --include='*.jsx' | grep -c Button
grep -rhoE "<Button[^>]*" src --include='*.tsx' --include='*.jsx' | grep -oE '\s[a-zA-Z]+=' | sort | uniq -c | sort -rn
```

第二条命令列出**实际被用到的 prop 频次**。这张表就是替换的验收范围 —— 文档里有但没人用的 prop 不必保。

- [ ] **Step 2: 写失败的 spec**

`src/ming-ui/components/Button/Button.spec.ts`：用 Task 2/3 的 `transformFileSync` + `new Function` 套路载入模块，断言的是**纯的那部分**：prop → className / style 的映射函数。

```ts
/**
 * ming-ui Button 的 API 面 spec。
 *
 * 【守的是什么】这个组件有 252 个调用点，内部实现要换成 antd。
 * 本仓没有 jsdom，测不了渲染结果，所以把「prop -> className/变体」
 * 这段逻辑抽成纯函数单独测 —— 抽不出来就说明耦合太紧，
 * 那本身就是该先解决的问题。
 *
 * 下面每组的 prop 组合都来自真实调用点的频次统计（见 Step 1）。
 */
```

具体断言内容由 Step 1 的频次表决定 —— **这一步必须先做完 Step 1 才能写**，照抄一张想当然的 prop 表是没意义的。

- [ ] **Step 3: 跑，确认失败**

```bash
node scripts/run-specs.ts --filter Button
```

- [ ] **Step 4: 内部换 antd**

把 `Button` 的渲染改成 antd 的 `Button`，外部 prop 原样接住并映射到 antd 的 `type` / `variant` / `color` / `size` / `danger` / `loading`。

查 API 不要凭记忆：

```bash
antd info Button --version 6.6.4 --format json
antd demo Button basic --format json
```

**保留 `className` 透传** —— 252 个调用点里大量靠外部 class 定制，断了就是大面积回归。

- [ ] **Step 5: 跑，确认通过**

```bash
node scripts/run-specs.ts --filter Button
```

- [ ] **Step 6: 过门禁 + antd lint**

```bash
bun run typecheck:syntax && bun run typecheck:fast && bun run typecheck:strict && bun run check:ext-collisions && node scripts/run-specs.ts && bun run typecheck:tools && bun run check:colors
antd lint src/ming-ui/components/Button --format json
```

- [ ] **Step 7: 手动验一批高频调用点**

至少看 5 个不同页面的 Button：主按钮、次按钮、危险按钮、loading 态、带自定义 className 的。**这一步不能省** —— 门禁测不到渲染。

- [ ] **Step 8: 提交**

```bash
git add src/ming-ui/components/Button
git commit -m "refactor(ming-ui): Button 内部换成 antd，对外 API 不变

252 个调用点一个都没改 —— 替换收在组件内部。
prop 表来自真实调用点的频次统计，不是照抄文档：
文档里有但没人用的 prop 不在验收范围内。

className 透传必须保住，大量调用点靠外部 class 定制。"
```

---

## Task 8: 按同一流程换掉其余 5 个主题相关组件

对 `Checkbox`(281) / `Radio`(100) / `RadioGroup`(93) / `Menu`(111) / `Dropdown`(256) **各自重复 Task 7 的 8 个步骤**，一个组件一次提交。

每个组件开工前先跑频次统计（把 `Button` 换成目标组件名）：

```bash
grep -rhoE "<Checkbox[^>]*" src --include='*.tsx' --include='*.jsx' | grep -oE '\s[a-zA-Z]+=' | sort | uniq -c | sort -rn
```

查 API：

```bash
antd info Checkbox --version 6.6.4 --format json
```

**已知坑（实施前先看）：**
- **`Menu`**：antd 6 里 `children` 形式的 `<Menu.Item>` 已废弃，要走 `items` 数组。本仓还有 `<Menu.Item>` 写法在用（例如 `src/pages/Admin/user/membersDepartments/structure/components/tabList/index.tsx:138-142`）。`ming-ui` 的 `Menu` 换内部实现时要把 children 形式在组件内部转成 `items`，**不要把这个转换推给 111 个调用点**。
- **`Dropdown`**：antd 6 的 `popupRender` 取代了 `overlay`，`styles.root` 取代了 `overlayStyle`。同样在组件内部消化。
- **`Dialog`(553)** 留到最后，它是引用最多、prop 面最大的一个，而且 `Promise.tsx` / `Confirm.tsx` 两条命令式入口要一并处理。**如果时间不够，Dialog 可以推到子项目 B** —— 前 5 个换完，主题色跟随的可见载体已经覆盖住了。

每个组件的验收同 Task 7 Step 7：至少 5 个真实页面目视。

- [ ] Checkbox
- [ ] Radio
- [ ] RadioGroup
- [ ] Menu
- [ ] Dropdown
- [ ] Dialog（可推迟到子项目 B，推迟就在提交信息里写明）

---

## Task 9: `antd-color.less` 逐条退役

**Files:**
- Modify: `src/common/mdcss/themes/antd-color.less`（522 行）

**前置：** Task 4 之后 antd 已经由 token 驱动，这 522 行 `!important` 覆盖里**凡是只为了把 antd 染成主题色**的规则都已经是多余的。

- [ ] **Step 1: 分类**

通读 522 行，把每条规则归成三类，直接写进文件里的分节注释：
1. **主题色覆盖** —— token 已接管，删。
2. **尺寸/间距/圆角覆盖** —— 不属于子项目 A（那是 B 的排版现代化），留着，标注 `/* TODO(视觉重构 B)：改走 ConfigProvider 的组件级 token */`。
3. **antd 未开放的内部结构** —— 删不掉，**必须在原地写清为什么**。

- [ ] **Step 2: 一次删一节，每节单独验**

按上面的分节顺序，一次删第 1 类里的一节，然后：

```bash
bun run check:colors
```

再在浏览器里看一眼这一节覆盖的那类组件（规则的选择器已经告诉你是哪个组件）。**一次删一节、一节一验** —— 522 行一把删掉之后没人能定位是哪条引起的回归。

- [ ] **Step 3: 收尾**

删完之后文件顶部写一段说明：还剩哪几类、为什么留、什么条件下能继续删。

- [ ] **Step 4: 提交**

每删若干节提交一次，提交信息写明删了哪几类规则、为什么现在是多余的。

---

## Task 10: 硬编码色分批映射 —— 第一批（共享层）

**顺序（spec 定的）：** 共享层（`ming-ui` + `common/mdcss`）→ 工作流(303) → 统计(274) → widgetConfig(237) → 后台(214) → 工作表(161) → 其余。

**本任务只做共享层。** 后续每一批**重复本任务的全部步骤**，只换分区 —— 分区名和真实计数跑 `node tools/audit-colors.ts --stats` 拿。

- [ ] **Step 1: 列出本批的全部色值与出现位置**

```bash
grep -rnoE '#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)' src/ming-ui src/common/mdcss --include='*.less' --include='*.css' --include='*.tsx' --include='*.ts' | sort -t: -k3 | uniq -c -f2 | sort -rn | head -60
```

- [ ] **Step 2: 按语义逐处判断**

| 情况 | 处理 |
| --- | --- |
| 三代蓝 `#2196f3`(Material) / `#1890ff`(antd 4) / `#1677ff`(antd 5/6) | 一律 → `var(--color-primary)` |
| 文字色 | → `--color-text-primary` / `-secondary` / `-tertiary` / `-title` / `-placeholder` / `-disabled` / `-inverse` |
| 背景色 | → `--color-background-primary` / `-secondary` / `-tertiary` / `-disabled` / `-card` / `-hover` / `-overlay` / `-input` 等 |
| 边框色 | → `--color-border-primary` / `-secondary` / `-tertiary` / `-hover` / `-strong` |
| 状态色 | → `--color-success` / `-warning` / `-error` / `-info`（含各自的 `-bg` / `-border` / `-hover`） |
| 链接 | → `--color-link` / `-hover` / `-visited` |
| **品牌色**（微信绿 `#47B14B`、钉钉蓝等） | **保留**，原地加注释写明是第三方品牌色 |
| **图表配色盘** | **保留**，原地加注释 —— 序列色不该跟随主题，否则两条序列会撞色 |
| **语义独立的状态色** | 已经有专门变量的走变量；没有的保留并注明 |

**不做机械全量替换。** 同一个 `#1677ff` 在「主按钮底色」和「图表第一条序列」里语义不同：前者该跟随主题，后者不该。判断必须逐处做 —— 这也是为什么这份计划里没有给一条 sed 命令。

可用的 73 个变量全名见 `src/common/mdcss/themes/theme-default.less`（Task 6 之后是 69 个，`--color-app*` 那 4 个已删）。

- [ ] **Step 3: 每改 20-30 处跑一次棘轮**

```bash
node tools/audit-colors.ts --stats
```

本批对应分区的数字必须单调下降。

- [ ] **Step 4: 本批改完过门禁**

```bash
bun run typecheck:syntax && bun run typecheck:fast && bun run typecheck:strict && bun run check:ext-collisions && node scripts/run-specs.ts && bun run typecheck:tools && bun run check:colors
```

- [ ] **Step 5: 更新棘轮基线**

```bash
node tools/audit-colors.ts --write-baseline
```

- [ ] **Step 6: 目视本批覆盖的页面**

共享层影响面最大 —— 按 `docs/superpowers/checklists/theme-visual-pages.md`（Task 11 建）逐页看。

- [ ] **Step 7: 提交**

```bash
git add -A src tools/audit-colors.baseline.json
git commit -m "refactor(theme): 共享层硬编码色映射到语义变量（第 1 批）

三代蓝（#2196f3 / #1890ff / #1677ff）统一归到 --color-primary。
品牌色（微信绿等）和图表配色盘【保留】并原地注明原因 ——
序列色跟随主题会让两条序列撞色。

棘轮基线同步下调。"
```

**后续批次：** 工作流 → 统计 → widgetConfig → 后台 → 工作表 → 其余，每批重复 Step 1-7，`grep` 的路径换成该分区。

---

## Task 11: 逐页目视清单 + 发布

**Files:**
- Create: `docs/superpowers/checklists/theme-visual-pages.md`

**说明：** 六道门禁**一道都测不到视觉回归**，`check:colors` 棘轮只能抓「写死的颜色变多了」，抓不到「颜色改错了」。生产是全公司在用的 OA，而按约束**不能用用户账号登录**，所以自动化的截图比对拿不到会话 —— 这份清单就是唯一的兜底，它是人工的，这一点要说清楚而不是假装有自动化。

- [ ] **Step 1: 建清单**

`docs/superpowers/checklists/theme-visual-pages.md`，每页一行，含：路径、该页最能暴露主题色的元素（主按钮 / 选中态 / 链接 / 聚焦环）、明暗两栏勾选框。

起始清单（从 `src/router/config.ts` 与部署记忆里的可达页面取；**已知 `/kc/my` 和 `/calendar` 在本部署下返回 404，不是回归，不要列**；日历的正确路径是 `/apps/calendar/home`）：

| 路径 | 看什么 | 亮 | 暗 |
| --- | --- | --- | --- |
| `/dashboard` | 应用卡片、主按钮 | ☐ | ☐ |
| `/app/:appId`（测试应用） | 左侧导航选中态、主按钮、顶栏 | ☐ | ☐ |
| `/app/:appId` 工作表视图 | 行选中、筛选器、分页 | ☐ | ☐ |
| `/app/:appId` 记录详情弹层 | **对话框里的主按钮**（portal 路径，Task 3 的核心验证点） | ☐ | ☐ |
| `/app/:appId` 自定义页面 | 按钮组件、图表配色 | ☐ | ☐ |
| `/app/:appId` 应用设置 | 表单控件、开关 | ☐ | ☐ |
| `/admin/structure/:projectId` | **必须保持平台色** | ☐ | ☐ |
| `/admin/*` 其余几页 | 同上 | ☐ | ☐ |
| `/apps/calendar/home` | 日程色块、今日高亮 | ☐ | ☐ |
| `/apps/task` | 任务状态色 | ☐ | ☐ |
| `/feed` | 动态流链接色 | ☐ | ☐ |
| `/personal` | 表单、头像 | ☐ | ☐ |
| `/search` | 搜索高亮 | ☐ | ☐ |
| `/workflowedit/:flowId` | 节点选中态、连线 | ☐ | ☐ |
| 聊天面板（右侧） | **必须保持平台色** | ☐ | ☐ |
| 顶栏 | **必须保持平台色** | ☐ | ☐ |

- [ ] **Step 2: 建测试应用**

**新建一个应用，不要改现有应用的 `iconColor`** —— 现有应用的配色是业务方设的。把它的图标色设成一个和平台蓝明显不同的颜色（例如 `#e91e63`），跑完清单后删掉这个应用。

- [ ] **Step 3: 跑一遍清单（发布前，本地/预发）**

- [ ] **Step 4: 验收判据 2 —— 可证伪的那条**

改测试应用的 `iconColor`，确认：
- 该应用区域的主按钮、选中态、链接**全部跟随**；
- 平台外壳（顶栏、左侧平台导航、后台管理、聊天）**不变**。

**这句话在动工前是不成立的**（99% 的 CSS 指向一个永不改变的蓝色常量）。做完必须成立，不成立就是子项目 A 没完成。

- [ ] **Step 5: 发布**

按 `hap-frontend-deploy-procedure` 记忆里的流程走：从生产播种预发 → `rsync -azc`（`--delete` 只对 `files/`，排除 `/dist` 和 `/50x.html`）→ `docker cp` 进 `script-app-1:/usr/local/MDPrivateDeployment/www` → 原子 `mv` 切换。**不重启服务。**

构建用 node（8G 堆是 webpack 需要的 V8 flag）：

```bash
node --max-old-space-size=8192 ./node_modules/.bin/webpack --config ./webpack.config.js
```

- [ ] **Step 6: 生产上再跑一遍清单**

**验的是真实现象，不是包换没换。** 上一轮发布踩过这个：只对包哈希不验页面，发现不了行为回归。

- [ ] **Step 7: 删掉测试应用**

- [ ] **Step 8: 提交清单并记录发布**

```bash
git add docs/superpowers/checklists/theme-visual-pages.md
git commit -m "docs(theme): 加逐页目视清单

六道门禁一道都测不到视觉回归，check:colors 棘轮只能抓
「写死的颜色变多了」，抓不到「颜色改错了」。生产不能用用户账号登录，
自动化截图比对拿不到会话 —— 这份清单是人工的，就是唯一的兜底。"
```

---

## 完成判据（四条全中才算子项目 A 完成）

1. **六道门禁 + `check:colors` 全绿。**
2. **可证伪的核心判据成立**：改测试应用的 `iconColor` → 应用区域主按钮/选中态/链接全跟随，平台外壳不变。（动工前不成立。）
3. **暗色不回归**：明暗两套下逐页对照，`window.themeMode` 切换行为不变。
4. **逐页目视清单在生产上跑完**，且是验真实现象。

## 明确不在子项目 A 内

- 排版、间距、圆角、密度的现代化 → 子项目 B
- 逐页重构 → 子项目 C
- 换 Rspack → 子项目 D（独立，可并行）
- `themeColor` React prop 的 382 处退役 → A 只要求「新旧两条路并存且结果一致」，退役是后续清理
- `/app/:appId/newrecord/...`、`/app/:appId/:worksheetId/:viewId/row/:rowId`、`/app/:appId/:worksheetId/row/:rowId`、`/app/:appId/workflowdetail/record/:id/:workId`、`/app/:appId/:worksheetId/:viewId/gunterExport` 这 5 条**不走 `Application` 的独立路由**：它们是记录/导出的独立页面，A 里保持平台色。要接的话，在各自组件里挂一个 `<AppThemeScope seed={...} />` 即可 —— `AppThemeScope` 就是照着「一行能加上」设计的。
