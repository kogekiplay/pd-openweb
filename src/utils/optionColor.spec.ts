/**
 * getOptionChipStyle 的行为 spec。
 *
 * 【守的是什么】选项色是用户自己选的业务数据。2026-09-23 用户定了「底色 = 选的颜色」，
 * 代码只负责挑字色。这份 spec 拿产品内置的 20 色色板逐个算，钉死：
 *   1. 底色就是选的颜色，实色、不随主题变 —— 防有人为了对比度把底再调淡（那是被用户否掉的方案）；
 *   2. 字色是实色、不是主题变量 —— 底色不随主题变，字色要是跟着主题翻，暗色下浅底会配上浅字；
 *   3. 能到 4.5 的颜色都到 4.5；到不了的只允许是已知的那 3 色，而且给白字；
 *   4. 近中性色不去造色相 —— 灰色的 HSL 色相是 0（红），直接喂 generate() 会得到灰底配深红字。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');

type OptionChipStyle = { background: string; color: string };
type Mod = {
  getOptionChipStyle: (color: string) => OptionChipStyle;
  __internal: {
    contrast: (a: string, b: string) => number;
    saturatedSeed: (c: string) => string | null;
    AA_BODY: number;
    NEAR_BLACK: string;
    WHITE: string;
  };
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

const { getOptionChipStyle, __internal } = load();
const { contrast, AA_BODY, NEAR_BLACK, WHITE } = __internal;
const { TinyColor } = require('@ctrl/tinycolor');

/** 产品内置的选项色板 —— 从源文件读，色板改了这份 spec 自动跟着测新色 */
const configSrc = fs.readFileSync(path.join(__dirname, '../pages/widgetConfig/config/index.ts'), 'utf8');
const PALETTE: string[] = JSON.parse(
  '[' + configSrc.split('OPTION_COLORS_LIST = [')[1].split(']')[0].replace(/'/g, '"').replace(/,\s*$/, '') + ']',
);
assert.ok(PALETTE.length >= 20, `色板只解析出 ${PALETTE.length} 色，解析逻辑该修了`);

const isLiteral = (c: string) => new TinyColor(c).isValid && !/var\(|color-mix/.test(c);

// 1. 底色 = 选的颜色：实色、与输入同一个颜色。ColorPicker 存的是 8 位 hex，也要认。
for (const color of PALETTE) {
  const { background } = getOptionChipStyle(color);
  assert.ok(isLiteral(background), `${color} 的底色不是实色：${background}`);
  assert.strictEqual(background, new TinyColor(color).toHexString(), `${color} 的底色被改过了：${background}`);
  assert.strictEqual(getOptionChipStyle(color.toLowerCase() + 'ff').background, background, '8 位 hex 不认');
}

// 2. 字色必须是实色，不能是主题变量（底色不随主题变，字色也不能变）。
for (const color of PALETTE) {
  const { color: text } = getOptionChipStyle(color);
  assert.ok(isLiteral(text), `${color} 的字色用了 ${text} —— 暗色主题下会翻成浅字`);
}

// 3. 对比度。黑白两种字都到不了 4.5 的颜色只能是这 3 个（亮度落在两者之间那一窄条），给白字，
//    理由见 optionColor.ts 的 pickText。色板改了、或者有人换了 NEAR_BLACK 让这个名单变长，这里会报。
const HOPELESS = ['#1677ff', '#F52222', '#EB2F96'];
{
  const hopeless = PALETTE.filter(c => Math.max(contrast(WHITE, c), contrast(NEAR_BLACK, c)) < AA_BODY);
  assert.deepStrictEqual(hopeless, HOPELESS, `黑白都到不了 4.5 的颜色变了：${hopeless.join(', ')}`);
  for (const color of PALETTE) {
    const style = getOptionChipStyle(color);
    const ratio = contrast(style.color, style.background);
    if (HOPELESS.includes(color)) {
      assert.strictEqual(style.color, WHITE, `${color} 应当给白字（与原版一致，APCA 下也是白字清楚）`);
    } else {
      assert.ok(ratio >= AA_BODY, `选项色 ${color} 的标签只有 ${ratio.toFixed(2)}（字 ${style.color}）`);
    }
  }
}

// 4. 有色相的颜色，同色深字够得着时用的是同色字，不是黑白（黄底配棕字，而不是黄底配黑字）。
for (const color of ['#C9E6FC', '#FEF6C6', '#FAD714', '#FF9300', '#00C345']) {
  const { color: text } = getOptionChipStyle(color);
  assert.ok(text !== NEAR_BLACK && text !== WHITE, `${color} 应当配同色深字，实际是 ${text}`);
  const dh = Math.abs(new TinyColor(text).toHsl().h - new TinyColor(color).toHsl().h);
  assert.ok(Math.min(dh, 360 - dh) < 30, `${color} 配的 ${text} 色相差了 ${dh.toFixed(0)}°`);
}

// 5. 近中性色不造色相：灰色只能配近黑或白，不能得到一条红色阶。
for (const grey of ['#d3d3d3', '#484848', '#ffffff', '#000000', '#7f7f7f']) {
  assert.strictEqual(__internal.saturatedSeed(grey), null, `${grey} 被当成有色相了，会造出一条假色阶`);
  const { color: text } = getOptionChipStyle(grey);
  assert.ok(text === NEAR_BLACK || text === WHITE, `${grey} 配了 ${text}`);
}

// 6. 半透明的选项色照原样半透明（底 = 选的颜色），字色按叠在白底上挑。
{
  const style = getOptionChipStyle('#1677ff33');
  assert.strictEqual(style.background, 'rgba(22, 119, 255, 0.2)');
  assert.ok(contrast(style.color, '#d0e4ff') >= AA_BODY, `半透明蓝的字色 ${style.color} 不够`);
}

// 7. 非法颜色不能产出 NaN 颜色（那会让标签变透明块，比报错更难查）。
for (const bad of ['', 'not-a-color', 'undefined']) {
  const style = getOptionChipStyle(bad);
  assert.ok(!/NaN/.test(style.background + style.color), `${JSON.stringify(bad)} 产出了 NaN：${JSON.stringify(style)}`);
  assert.strictEqual(style.color, 'var(--color-text-title)');
}

console.log(`optionColor spec 通过（色板 ${PALETTE.length} 色，其中 ${HOPELESS.length} 色到不了 4.5、按原版给白字）`);
