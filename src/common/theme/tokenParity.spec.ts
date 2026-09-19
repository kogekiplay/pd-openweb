/**
 * 「两条路同源」的 spec —— 整个主题引擎压着的那条假设。
 *
 * 【假设是什么】我们给应用区域喂两样东西：
 *   · <ConfigProvider theme={{ token: { colorPrimary } }}>  -> antd 组件走它自己的 token
 *   · buildThemeVars(colorPrimary)                          -> 我们的 Less 走 CSS 变量
 * 前者内部用 theme.useToken()，后者用 theme.getDesignToken()。
 * **这两个必须算出完全一样的调色板**，否则 antd 按钮和我们的 Less 会是两种颜色 ——
 * 那正是这次重构要修的病，只不过换了个更隐蔽的形态。
 *
 * 【为什么值得单开一个 spec】这条等价关系是 antd 的内部实现细节，不是它承诺的 API。
 * 哪天 antd 升级把 useToken 的 seed 合并逻辑改了，代码照样编译、门禁照样全绿、
 * 页面照样出得来 —— 只是颜色悄悄分叉。没有这个 spec 就没人会发现。
 *
 * 【怎么在没有 jsdom 的情况下测 hook】用 react-dom/server 把一个只调
 * theme.useToken() 的探针组件渲染一遍。hooks 在 SSR 下正常工作，
 * 而 renderToStaticMarkup 不需要任何 DOM。
 */
const assert = require('assert');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { ConfigProvider, theme } = require('antd');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');

type AntdToken = Record<string, string>;
type ThemeVars = Record<string, string>;

function loadBuildThemeVars(): (seed: string, mode?: 'light' | 'dark') => ThemeVars {
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'palette.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports.buildThemeVars as (seed: string, mode?: 'light' | 'dark') => ThemeVars;
}

const buildThemeVars = loadBuildThemeVars();

/** 渲染一个只读 token 的探针，拿到 ConfigProvider 子树里 antd 组件真正会用的那套 token。 */
function tokenSeenByAntd(themeConfig: Record<string, unknown>): AntdToken {
  let captured: AntdToken | null = null;

  function Probe() {
    captured = theme.useToken().token;
    return null;
  }

  renderToStaticMarkup(
    React.createElement(ConfigProvider, { theme: themeConfig }, React.createElement(Probe)),
  );

  assert.ok(captured, '探针没跑起来 —— ConfigProvider 的渲染方式变了，这个 spec 需要重写');
  return captured as unknown as AntdToken;
}

/** antd 6.6.4 的 primary 系列共 10 个，见 antd/es/theme/interface/maps/colors.d.ts:131-194。 */
const PRIMARY_KEYS = [
  'colorPrimary',
  'colorPrimaryBg',
  'colorPrimaryBgHover',
  'colorPrimaryBorder',
  'colorPrimaryBorderHover',
  'colorPrimaryHover',
  'colorPrimaryActive',
  'colorPrimaryTextHover',
  'colorPrimaryText',
  'colorPrimaryTextActive',
];

/** 故意挑离平台蓝很远的颜色：分叉了一眼就能看出来。 */
const SEED = '#e91e63';

// 1. 【核心】亮色下，ConfigProvider 看到的 token == getDesignToken 算的 token
const viaProvider = tokenSeenByAntd({ token: { colorPrimary: SEED } });
const viaPure = theme.getDesignToken({ token: { colorPrimary: SEED } });
for (const key of PRIMARY_KEYS) {
  assert.ok(viaProvider[key], `ConfigProvider 的 token 里没有 ${key} —— antd 改了 token 名`);
  assert.strictEqual(viaProvider[key], viaPure[key], `${key} 分叉：ConfigProvider 与 getDesignToken 不一致`);
}

// 2. 【核心】暗色下同样成立
const darkCfg = { token: { colorPrimary: SEED }, algorithm: theme.darkAlgorithm };
const darkViaProvider = tokenSeenByAntd(darkCfg);
const darkViaPure = theme.getDesignToken(darkCfg);
for (const key of PRIMARY_KEYS) {
  assert.strictEqual(darkViaProvider[key], darkViaPure[key], `${key} 在暗色下分叉`);
}
// 暗色确实换了值，否则上面那组是在比两个相同的常量、等于没测
assert.notStrictEqual(darkViaPure.colorPrimaryHover, viaPure.colorPrimaryHover);

// 3. 【核心】我们写进 CSS 变量的值，就是 antd 组件用的那几个值
const vars = buildThemeVars(SEED, 'light');
assert.strictEqual(vars['--color-primary'], viaProvider.colorPrimary);
assert.strictEqual(vars['--color-primary-light'], viaProvider.colorPrimaryHover);
assert.strictEqual(vars['--color-primary-dark'], viaProvider.colorPrimaryActive);

const darkVars = buildThemeVars(SEED, 'dark');
assert.strictEqual(darkVars['--color-primary'], darkViaProvider.colorPrimary);
assert.strictEqual(darkVars['--color-primary-light'], darkViaProvider.colorPrimaryHover);
assert.strictEqual(darkVars['--color-primary-dark'], darkViaProvider.colorPrimaryActive);

// 4. 嵌套 ConfigProvider 不带 theme 时继承父级 —— 全仓 113 处局部 ConfigProvider
//    几乎全是 button={{ autoInsertSpace: false }} 这种不带 theme 的，
//    它们【不能】把应用色打回默认蓝。这条是那 113 处的安全依据。
let inner: AntdToken | null = null;
function InnerProbe() {
  inner = theme.useToken().token;
  return null;
}
renderToStaticMarkup(
  React.createElement(
    ConfigProvider,
    { theme: { token: { colorPrimary: SEED } } },
    React.createElement(ConfigProvider, { button: { autoInsertSpace: false } }, React.createElement(InnerProbe)),
  ),
);
assert.strictEqual((inner as unknown as AntdToken).colorPrimary, SEED, '嵌套的无 theme ConfigProvider 把主色打回去了');

console.log('tokenParity.spec: 4 组断言全部通过（ConfigProvider 与 getDesignToken 同源）');
