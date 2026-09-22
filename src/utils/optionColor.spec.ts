/**
 * getOptionChipStyle 的行为 spec。
 *
 * 【守的是什么】选项色是用户自己选的业务数据，代码没法挑颜色，只能挑**怎么配**。
 * 这份 spec 拿产品内置的 20 色色板逐个算，钉死两件事：
 *   1. 明暗两套主题下，20 色的标签文字对标签底色都够 4.5；
 *   2. 近中性色不去造色相 —— 灰色的 HSL 色相是 0（红），
 *      把灰直接喂给 antd 的 generate() 会得到一条红色阶，灰标签配深红字。
 *
 * 还有一条反向断言：**原来那套「实心原色底 + 黑或白字」做不到同样的事**。
 * 这条防的是「觉得浅底太素、改回实心底」—— 实测 20 色里有 5 色黑白两种字色
 * 都够不着 4.5，只要底是原色就无解，不是调一调字色能救的。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');

type ThemeMode = 'light' | 'dark';
type OptionChipStyle = { background: string; color: string };
type Mod = {
  getOptionChipStyle: (color: string, mode?: ThemeMode) => OptionChipStyle;
  flattenedChipBackground: (color: string, mode?: ThemeMode) => string;
  __internal: { contrast: (a: string, b: string) => number; saturatedSeed: (c: string) => string | null };
};

function load(): Mod {
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'optionColor.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports as unknown as Mod;
}

const { getOptionChipStyle, flattenedChipBackground, __internal } = load();
const { contrast } = __internal;
const { TinyColor } = require('@ctrl/tinycolor');

/** 产品内置的选项色板 —— 从源文件读，色板改了这份 spec 自动跟着测新色 */
const configSrc = fs.readFileSync(path.join(__dirname, '../pages/widgetConfig/config/index.ts'), 'utf8');
const PALETTE: string[] = JSON.parse(
  '[' + configSrc.split('OPTION_COLORS_LIST = [')[1].split(']')[0].replace(/'/g, '"').replace(/,\s*$/, '') + ']',
);
assert.ok(PALETTE.length >= 20, `色板只解析出 ${PALETTE.length} 色，解析逻辑该修了`);

/** 两套主题的文字档字面值，从 Less 源文件读 —— 近中性色走的就是这一档 */
function readVar(file: string, name: string): string {
  const src = fs
    .readFileSync(path.join(__dirname, '../common/mdcss/themes', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const m = src.match(new RegExp(`(^|[\\s;{])${name}\\s*:\\s*([^;]+);`));
  assert.ok(m, `${name} 在 ${file} 里没有定义`);
  return m![2].trim();
}
const TITLE = {
  light: readVar('theme-default.less', '--color-text-title'),
  dark: readVar('theme-dark.less', '--color-text-title'),
};

/** 把 style 里的文字色解析成实际颜色（可能是 CSS 变量名） */
function resolveText(style: OptionChipStyle, mode: ThemeMode): string {
  if (style.color === 'var(--color-text-title)') return TITLE[mode];
  return style.color;
}

// 1. 【核心】20 色 × 明暗两套，标签文字对标签底色都够 4.5。
for (const mode of ['light', 'dark'] as ThemeMode[]) {
  for (const color of PALETTE) {
    const style = getOptionChipStyle(color, mode);
    const bg = flattenedChipBackground(color, mode);
    const ratio = contrast(resolveText(style, mode), bg);
    assert.ok(
      ratio >= 4.5,
      `${mode} 模式下选项色 ${color} 的标签只有 ${ratio.toFixed(2)}（字 ${style.color} / 底 ${bg}）`,
    );
  }
}

// 2. 【反向断言】老做法（实心原色底 + 黑或白字）救不回来 —— 这条防「改回实心底」。
//    20 色里必须确实存在若干色：黑白两种字色对原色底都够不着 4.5。
{
  const hopeless = PALETTE.filter(c => {
    const white = contrast('#ffffff', c);
    const dark = contrast(TITLE.light, c);
    return Math.max(white, dark) < 4.5;
  });
  assert.ok(
    hopeless.length > 0,
    '色板里已经没有"黑白都不够"的颜色了 —— 若确是色板改过，这条反向断言可以删；' +
      '但在那之前，它挡的是"把标签改回实心原色底"这种回退',
  );
}

// 3. 近中性色不造色相：灰色必须走中性文字档，不能得到一条红色阶。
//    （TinyColor 对灰给出的 HSL 色相是 0，也就是红 —— 直接喂 generate() 就是灰标签配深红字。）
for (const grey of ['#d3d3d3', '#484848', '#ffffff', '#000000', '#7f7f7f']) {
  assert.strictEqual(__internal.saturatedSeed(grey), null, `${grey} 被当成有色相了，会造出一条假色阶`);
  assert.strictEqual(getOptionChipStyle(grey, 'light').color, 'var(--color-text-title)');
}

// 4. 底色用 color-mix 而不是算好的实色 —— 明暗两套主题、以及标签放在卡片还是页面上，
//    都靠浏览器按当前表面去叠。写成实色就会在暗色下变成一块浅斑。
{
  const style = getOptionChipStyle('#1677ff', 'light');
  assert.ok(
    /^color-mix\(in srgb, #1677ff \d+%, transparent\)$/.test(style.background),
    `底色应该是 color-mix 的形式，实际是 ${style.background}`,
  );
  assert.strictEqual(
    getOptionChipStyle('#1677ff', 'dark').background,
    style.background,
    '底色的写法明暗两套应当相同（差异交给 color-mix 在运行期解决）',
  );
}

// 5. 文字色明暗两套必须【不同方向】：亮色下比原色深，暗色下比原色亮。
//    写反了是这类改动最容易犯的错，而且暗色下不一定第一眼看出来。
for (const color of ['#1677ff', '#00C345', '#FF9300']) {
  const base = new TinyColor(color).getLuminance();
  const lightText = new TinyColor(getOptionChipStyle(color, 'light').color).getLuminance();
  const darkText = new TinyColor(getOptionChipStyle(color, 'dark').color).getLuminance();
  assert.ok(lightText < base, `亮色下 ${color} 的标签文字应该比原色更深`);
  assert.ok(darkText > base, `暗色下 ${color} 的标签文字应该比原色更亮`);
}

// 6. 非法颜色不能产出 NaN 颜色（那会让标签变透明块，比报错更难查）。
for (const bad of ['', 'not-a-color', 'undefined']) {
  const style = getOptionChipStyle(bad, 'light');
  assert.ok(!/NaN/.test(style.background + style.color), `${JSON.stringify(bad)} 产出了 NaN：${JSON.stringify(style)}`);
  assert.strictEqual(style.color, 'var(--color-text-title)');
}

console.log(`optionColor spec 通过（色板 ${PALETTE.length} 色 × 明暗两套）`);
