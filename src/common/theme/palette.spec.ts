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
 *
 * 【为什么能用普通 node spec 测一个"主题"】因为 antd 的
 * theme.getDesignToken() 是纯函数，不需要 React 环境。本仓没有
 * jsdom / vitest / jest，79 个 spec 全是 node + assert —— 把映射做成纯函数
 * 是这份设计唯一能有真测试的前提，不是风格偏好。
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');

type ThemeVars = Record<string, string>;
type PaletteModule = {
  buildThemeVars: (seed: string, mode?: 'light' | 'dark') => ThemeVars;
  themeVarsToCssText: (vars: ThemeVars) => string;
};

function loadPalette(): PaletteModule {
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'palette.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports as unknown as PaletteModule;
}

const { buildThemeVars, themeVarsToCssText } = loadPalette();
const { theme } = require('antd');
const { TinyColor } = require('@ctrl/tinycolor');

/** 故意挑一个离平台蓝很远的颜色：算错了一眼就能看出来。 */
const SEED = '#e91e63';

function rgbOf(hex: string): string {
  const { r, g, b } = new TinyColor(hex).toRgb();
  return `${r}, ${g}, ${b}`;
}

const light = buildThemeVars(SEED, 'light');
const dark = buildThemeVars(SEED, 'dark');
const antdLight = theme.getDesignToken({ token: { colorPrimary: SEED } });
const antdDark = theme.getDesignToken({ token: { colorPrimary: SEED }, algorithm: theme.darkAlgorithm });

// 1. 主色原样透出，不被二次加工
assert.strictEqual(light['--color-primary'], SEED);

// 2. 【核心】hover / active 必须等于 antd 自己算的值 —— 这条就是「不分叉」。
//    改成自己 lighten/darken 会让这一组当场红。
assert.strictEqual(light['--color-primary-light'], antdLight.colorPrimaryHover);
assert.strictEqual(light['--color-primary-dark'], antdLight.colorPrimaryActive);

// 3. 【核心】暗色走 darkAlgorithm，而不是亮色值
assert.strictEqual(dark['--color-primary'], antdDark.colorPrimary);
assert.notStrictEqual(dark['--color-primary'], light['--color-primary']);
assert.strictEqual(dark['--color-primary-light'], antdDark.colorPrimaryHover);
assert.strictEqual(dark['--color-primary-dark'], antdDark.colorPrimaryActive);

// 4. 透明档：明暗两套取值【不同】。
//    亮色 .4/.12/.06 抄自 theme-default.less，暗色 .5/.2/.12 抄自 theme-dark.less
//    （暗底上同样的 alpha 会看不见，原作者已经调过）。
assert.strictEqual(light['--color-primary-focus-outer'], `rgba(${rgbOf(SEED)}, 0.4)`);
assert.strictEqual(light['--color-primary-transparent'], `rgba(${rgbOf(SEED)}, 0.12)`);
assert.strictEqual(light['--color-primary-transparent-light'], `rgba(${rgbOf(SEED)}, 0.06)`);
assert.strictEqual(dark['--color-primary-focus-outer'], `rgba(${rgbOf(antdDark.colorPrimary)}, 0.5)`);
assert.strictEqual(dark['--color-primary-transparent'], `rgba(${rgbOf(antdDark.colorPrimary)}, 0.2)`);
assert.strictEqual(dark['--color-primary-transparent-light'], `rgba(${rgbOf(antdDark.colorPrimary)}, 0.12)`);

// 5. 聚焦环主色与主色同值（theme-default.less 原本就是这么写的）
assert.strictEqual(light['--color-primary-focus'], light['--color-primary']);

// 6. 应用色三兄弟跟主色同源（spec 要求 --color-app 系列并入主色）
assert.strictEqual(light['--color-app'], light['--color-primary']);
assert.strictEqual(light['--color-app-light'], light['--color-primary-light']);
assert.strictEqual(light['--color-app-dark'], light['--color-primary-dark']);
assert.strictEqual(light['--color-app-transparent'], light['--color-primary-transparent']);

// 7. 旧的 --app-primary-color 三兄弟也由同一套产出。
//    Task 6 才删它们；过渡期必须「两条路并存且结果一致」，这组就是那句话的判据。
assert.strictEqual(light['--app-primary-color'], light['--color-primary']);
assert.strictEqual(light['--app-primary-hover-color'], light['--color-primary-light']);
assert.strictEqual(light['--app-highlight-color'], `rgba(${rgbOf(SEED)}, 0.2)`);

// 8. mode 缺省 = light
assert.deepStrictEqual(buildThemeVars(SEED), light);

// 9. 非法种子色不能让整站没主题色：退回平台色，而不是抛、也不是产出一串 NaN 颜色。
//    （TinyColor 对乱字符串返回 isValid=false 不抛，但 antd 算法拿到它会算出
//     NaN 颜色，界面变成透明/黑块 —— 比抛错更难查。）
const bogus = buildThemeVars('not-a-color', 'light');
assert.strictEqual(bogus['--color-primary'], '#1677ff');
assert.deepStrictEqual(bogus, buildThemeVars('#1677ff', 'light'));

// 10. 空字符串同样走兜底（应用刚建出来时 iconColor 可能是空串）
assert.strictEqual(buildThemeVars('', 'light')['--color-primary'], '#1677ff');

// 11. themeVarsToCssText 产出可直接塞进 <style> 的声明串
assert.strictEqual(themeVarsToCssText({ '--a': '#fff', '--b': 'red' }), '--a:#fff;--b:red;');
assert.strictEqual(themeVarsToCssText({}), '');

// 12. 键集合稳定：三处消费者（inline style / 平台 <style> / 卸载时还原）靠同一份键。
//     明暗两套键不一致的话，从暗切回亮会残留几个删不掉的变量。
assert.deepStrictEqual(Object.keys(light).sort(), Object.keys(dark).sort());

console.log('palette.spec: 12 组断言全部通过');
