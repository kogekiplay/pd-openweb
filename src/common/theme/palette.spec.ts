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
  onSolidPrimary: (primary: string) => string;
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

// 5b. 淡色档同样直接取自 antd token（不是我们自己调的近似值）——
//     它们服务于「选中态淡底 / 淡边框」那一类，用透明档代替会明显变虚。
assert.strictEqual(light['--color-primary-bg'], antdLight.colorPrimaryBg);
assert.strictEqual(light['--color-primary-border'], antdLight.colorPrimaryBorder);
assert.strictEqual(dark['--color-primary-bg'], antdDark.colorPrimaryBg);
assert.strictEqual(dark['--color-primary-border'], antdDark.colorPrimaryBorder);

// 6. 【反向断言】这里【不】产出 --app-primary-color / --app-primary-hover-color。
//    它们已经由 src/common/mdcss/basic.css:3-5 别名到语义变量上
//    （--color-primary / --color-link-hover），本来就跟着主色走；
//    在调色板里再定义一遍等于造第二个真相源，还会把 hover 那个从
//    --color-link-hover 悄悄改成 colorPrimaryHover。这条断言防止它们被「顺手补回来」。
for (const key of ['--app-primary-color', '--app-primary-hover-color']) {
  assert.ok(!(key in light), `${key} 不该由全局调色板产出 —— 见 palette.ts 里的说明`);
}

// 6b. 【这条断言 2026-09-19 反过来了】--app-highlight-color 现在【必须】产出。
//     原先不产出，是为了留住 MessageList 那处
//     var(--app-highlight-color, var(--color-mingo-transparent)) 的 Mingo 紫兜底。
//     张奇拍板「AI 助手跟随主题色」后，两个运行期注入器一并退役 ——
//     此时若不在这里产出，应用的 Chatbot 会掉回 Mingo 紫，等于把决定做反。
//     Mingo 全局助手不受影响：那处样式挂在 &.useAppThemeColor 类下，
//     只有应用的 Chatbot 挂这个类。
assert.ok('--app-highlight-color' in light, '--app-highlight-color 必须产出，否则应用 Chatbot 掉回 Mingo 紫');
assert.strictEqual(
  light['--app-highlight-color'],
  new TinyColor(SEED).setAlpha(0.2).toRgbString(),
  'alpha 必须是 0.2，跟退役掉的 setAppThemeColor 逐字一致，否则观感会变',
);

// 7. --color-app 系列同样不产出：它是真·死变量，引用点已改指 --color-primary
for (const key of ['--color-app', '--color-app-light', '--color-app-dark', '--color-app-transparent']) {
  assert.ok(!(key in light), `${key} 已退役，不该再出现`);
}

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

// 13. 中性色阶带主题倾向：不是纯灰，但也不是主色。
const { readability } = require('@ctrl/tinycolor');
assert.notStrictEqual(light['--color-text-secondary'], '#757575', '中性色没染上主题倾向');
assert.notStrictEqual(light['--color-text-secondary'], light['--color-primary'], '中性色被整个换成主色了');

// 14. 【核心 · 可读性】染色不能把次要文字压到 WCAG AA 以下。
//     #757575 对白底本来就只有 4.61，暖色方向是瓶颈 —— 这条挡的就是
//     「把 TINT_TEXT 调大一点」这种看起来无害的改动。
// 染色保明度，所以对比度应当与【原始纯灰】几乎一致，而不只是「够用」。
// 这条比「>= 4.3」严得多：它挡住的是「把 TINT 调大」和「去掉保明度那一步」两种改动。
const BASE_CONTRAST = readability('#757575', '#ffffff'); // 4.61
for (const seed of ['#e91e63', '#d98936', '#ff9800', '#1677ff', '#00b96b', '#722ed1']) {
  const v = buildThemeVars(seed, 'light');
  const r = readability(v['--color-text-secondary'], '#ffffff');
  assert.ok(
    r >= BASE_CONTRAST * 0.97,
    `次要文字对白底对比度 ${r.toFixed(2)}（种子 ${seed}），低于原始纯灰的 ${BASE_CONTRAST.toFixed(2)} 太多 —— ` +
      '多半是保明度那一步被去掉了',
  );
}

// 15. 主体表面与正文主文字【不】参与染色 —— 它们是「纸和墨」，染了整站会发闷
for (const key of [
  '--color-background-primary',
  '--color-background-card',
  '--color-background-input',
  '--color-text-primary',
]) {
  assert.ok(!(key in light), `${key} 不该由调色板产出（保持 Less 里的中性值）`);
}

/* 16. 【实心主色底上的前景色】白字够读就用白，不够才翻墨色。
   规则有两处是被实测逼出来的，写错了不会报错、只会让按钮上的字糊掉或者
   白白翻掉一批本来没问题的应用：
     · 阈值是 3（按钮文字基本是 14px 加粗，落在 WCAG large text 档），
       不是 4.5，也【不是】「谁对比高用谁」；
     · 判定和产出都用【纯黑白】，不能用 --color-on-app-* 那套混了 8% 主色的版本 ——
       实测蓝色 #2296f3 配纯白 3.12（够），混完就掉到 3 以下被误判成不达标。 */
{
  // 走和上面同一个 loadPalette（本模块不能直接 require —— 它是 ESM，
  // 要先经 babel 转 commonjs，见文件顶部那个 loader）
  const { onSolidPrimary } = loadPalette() as unknown as { onSolidPrimary: (c: string) => string };

  // 生产上实测到的 13 个真实应用主题色（2026-09-21 从工作台抓的）
  const 该翻墨色 = ['#1fbcd5', '#9ca4a6', '#d98936', '#4caf50'];
  const 该保持白 = ['#2296f3', '#e91e63', '#0b64f6', '#3054eb', '#4051b6', '#732ed1', '#455a65', '#2d46c4', '#3a16af'];

  for (const c of 该翻墨色) {
    assert.strictEqual(onSolidPrimary(c), '#000000', `${c} 配白字不足 3:1，必须翻成墨色`);
    assert.ok(readability(c, '#000000') >= 4.5, `${c} 翻成墨色之后反而不够读，阈值或产出色选错了`);
  }
  for (const c of 该保持白) {
    assert.strictEqual(onSolidPrimary(c), '#ffffff', `${c} 配白字已经够 3:1，不该翻 —— 多余的翻转正是「看着怪」的来源`);
  }

  // 产出到变量里
  assert.strictEqual(buildThemeVars('#d98936', 'light')['--color-on-primary'], '#000000');
  assert.strictEqual(buildThemeVars('#3a16af', 'light')['--color-on-primary'], '#ffffff');
}

console.log('palette.spec: 16 组断言全部通过');
