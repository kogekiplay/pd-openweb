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

// 3b.【核心】--color-primary-text 必须来自 antd 的 generate() 色阶，不是自算的 darken。
//     这一档存在的理由是：主题色直接当文字色，10 个真实主题里只有 6 个对白底够 4.5。
//     下标（亮色 7 / 暗色 8）是量出来的，改之前要把 10 个真实色重算对比度。
{
  const { generate } = require('@ant-design/colors');
  assert.strictEqual(light['--color-primary-text'], generate(SEED)[7]);
  assert.strictEqual(dark['--color-primary-text'], generate(SEED, { theme: 'dark', backgroundColor: '#161616' })[8]);
  assert.notStrictEqual(light['--color-primary-text'], dark['--color-primary-text']);

  // 真正要守的是【结果】：对各自的页面底都得够读。挑最难的两个真实主题色验。
  const lumOf = (h: string) => {
    const s = h.replace('#', '');
    const ch = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
    const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(ch[0]) + 0.7152 * f(ch[1]) + 0.0722 * f(ch[2]);
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lumOf(a), lumOf(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (const hard of ['#1fbcd5', '#455a65']) {
    assert.ok(
      ratio(generate(hard)[7], '#ffffff') >= 4.5,
      `亮色 ${hard} 的 primary-text 对白底不足 4.5：${ratio(generate(hard)[7], '#ffffff').toFixed(2)}`,
    );
    const d = generate(hard, { theme: 'dark', backgroundColor: '#161616' })[8];
    assert.ok(ratio(d, '#161616') >= 4.5, `暗色 ${hard} 的 primary-text 对暗底不足 4.5：${ratio(d, '#161616').toFixed(2)}`);
  }
}

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
assert.notStrictEqual(light['--color-text-secondary'], '#5d5d5d', '中性色没染上主题倾向');
assert.notStrictEqual(light['--color-text-secondary'], light['--color-primary'], '中性色被整个换成主色了');

// 14. 【核心 · 可读性】染色不能把次要文字压到 WCAG AA 以下。
//     次要文字对白底本来就不宽裕，暖色方向是瓶颈 —— 这条挡的就是
//     「把 TINT_TEXT 调大一点」这种看起来无害的改动。
// 染色保明度，所以对比度应当与【原始纯灰】几乎一致，而不只是「够用」。
// 这条比「>= 4.3」严得多：它挡住的是「把 TINT 调大」和「去掉保明度那一步」两种改动。
const BASE_CONTRAST = readability('#5d5d5d', '#ffffff'); // 6.58
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

/* 16. 【实心面 + 它上面的文字】主色太浅时，**换底色**（换成同色相的深色档），
   而不是把白字翻成黑字。

   这条是被张奇的反馈纠正过来的，两处都不能改回去：
     · 第一版做的是翻字色，按 WCAG 算橙底黑字 7.58 远高于白字 2.77，
       数字上大胜，但他一眼说「可见度变差了」——**他是对的**：
       WCAG 2.x 的公式不区分明暗极性，而且主按钮的"可见度"还包含
       它像不像一个主操作，彩底黑字读起来像警告标签。
     · 阈值仍是 3，且**只在不达标时才换底色**：达标的 9 个色实心面就是主色本身，
       一点不变。改成「一律用深色档」会让所有应用的按钮都比自己选的颜色深一号。 */
{
  const { solidPrimary, onSolidPrimary } = loadPalette() as unknown as {
    solidPrimary: (p: string, a: string) => string;
    onSolidPrimary: (c: string) => string;
  };

  // 生产上实测到的真实应用主题色（2026-09-21 从工作台抓的）
  const 太浅要换底色 = ['#1fbcd5', '#9ca4a6', '#d98936', '#4caf50'];
  const 够深不许动 = ['#2296f3', '#e91e63', '#0b64f6', '#3054eb', '#4051b6', '#732ed1', '#455a65', '#2d46c4', '#3a16af'];

  for (const c of 太浅要换底色) {
    const v = buildThemeVars(c, 'light');
    assert.notStrictEqual(v['--color-primary-solid'], c, `${c} 配白字不足 3:1，实心面必须换成深色档`);
    assert.ok(
      readability(v['--color-primary-solid'], v['--color-on-primary']) >= 3,
      `${c} 换完之后实心面上的文字仍然不够读 —— 深色档不够深，或者前景色选错了`,
    );
    assert.strictEqual(v['--color-on-primary'], '#ffffff', `${c} 换底色之后白字就够了，不该再翻黑 —— 翻黑正是被否掉的那个方案`);
  }
  for (const c of 够深不许动) {
    const v = buildThemeVars(c, 'light');
    assert.strictEqual(v['--color-primary-solid'], c, `${c} 配白字已经够 3:1，实心面必须【就是主色本身】`);
    assert.strictEqual(v['--color-on-primary'], '#ffffff', `${c} 该保持白字`);
  }

  // 悬停：常态是主色时加深；常态已经是深色档时回到主色（antd 没有更深的一档，
  // 而本模块不许自算 darken）
  const 浅 = buildThemeVars('#d98936', 'light');
  assert.strictEqual(浅['--color-primary-solid-hover'], '#d98936', '常态已是深色档时，悬停回到主色');
  const 深 = buildThemeVars('#3a16af', 'light');
  assert.notStrictEqual(深['--color-primary-solid-hover'], '#3a16af', '常态是主色时，悬停要加深');

  // 极端浅色：连深色档都撑不住白字，这时才允许翻墨色（兜底仍然有效）
  assert.strictEqual(buildThemeVars('#ffff00', 'light')['--color-on-primary'], '#000000', '纯黄这种极端浅色，兜底翻墨色');
}

console.log('palette.spec: 16 组断言全部通过');
