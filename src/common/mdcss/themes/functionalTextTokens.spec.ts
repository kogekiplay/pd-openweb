/**
 * 功能色「文字档」的对比度 spec。
 *
 * 【守的是什么】success / warning / error 三种功能色的主色是给填充和图标用的，
 * 当文字色一律不够：对白底分别只有 2.78 / 2.16 / 3.68，正文要 4.5。
 * 所以各配了一个 --color-*-text。这份 spec 直接读两个主题的 Less 源文件，
 * 把里面的字面值算一遍对比度 —— 它挡的是「有人觉得这个颜色太深、往回调一点」。
 *
 * 【为什么读文件而不是读运行期的值】这几档是写死在 Less 里的字面量，
 * 不经过 src/common/theme 的调色板函数（只有 --color-primary-text 是运行期算的，
 * 那一档由 palette.spec.ts 守）。要测就只能测源文件。
 *
 * 【判据从哪来】WCAG 2.1：正文 4.5，大字（>= 18.66px，或 >= 14px 且粗体）3。
 * 这几档全是给正文用的，所以一律按 4.5 判。背景取两个最坏情况：
 * 页面底色，以及「压在自家浅底上」（那种浅底 + 同色字的小标签全仓很多）。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** rgba(r, g, b, a) -> [r,g,b,a]；不是 rgba 就返回 null */
function parseRgba(value: string): [number, number, number, number] | null {
  const m = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const lin = [r, g, b].map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(fg: Rgb, bg: Rgb): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 半透明前景叠到不透明底色上，得到实际看到的颜色 */
function flatten(fg: [number, number, number, number], bg: Rgb): Rgb {
  return [0, 1, 2].map(i => Math.round(fg[i] * fg[3] + bg[i] * (1 - fg[3]))) as Rgb;
}

/** 从 Less 源文件里取一个 CSS 变量的字面值（注释已先剔掉，避免注释里的示例值被当成定义） */
function readVar(source: string, name: string): string {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = stripped.match(new RegExp(`(^|[\\s;{])${name}\\s*:\\s*([^;]+);`));
  assert.ok(m, `${name} 在主题文件里没有定义`);
  return m![2].trim();
}

const themesDir = __dirname;
const lightSrc = fs.readFileSync(path.join(themesDir, 'theme-default.less'), 'utf8');
const darkSrc = fs.readFileSync(path.join(themesDir, 'theme-dark.less'), 'utf8');

/** 正文判据。大字是 3，但这几档全是给正文用的，按严的来。 */
const AA_BODY = 4.5;

function check(label: string, fgHex: string, bg: Rgb, min = AA_BODY) {
  const ratio = contrast(parseHex(fgHex), bg);
  assert.ok(ratio >= min, `${label} 对比度只有 ${ratio.toFixed(2)}，要 >= ${min}（颜色 ${fgHex}）`);
  return ratio;
}

// 1. 三个文字档在【亮色】主题下，对页面底色够 4.5。
//    页面底 = --color-background-primary，实测就是纯白。
{
  const pageBg = parseHex(readVar(lightSrc, '--color-background-primary'));
  assert.deepStrictEqual(pageBg, [255, 255, 255], '亮色页面底色不再是白，下面几条的判据要重算');

  check('亮色 --color-success-text 对页面底', readVar(lightSrc, '--color-success-text'), pageBg);
  check('亮色 --color-warning-text 对页面底', readVar(lightSrc, '--color-warning-text'), pageBg);
  check('亮色 --color-error-text 对页面底', readVar(lightSrc, '--color-error-text'), pageBg);
}

// 2. 【最坏情况】文字档压在【自家浅底】上 —— 浅底 + 同色字的小标签全仓很多，
//    这比对白底更严，也是当初做这几档的直接原因。
{
  const pageBg = parseHex(readVar(lightSrc, '--color-background-primary'));
  for (const tone of ['success', 'warning', 'error'] as const) {
    const tint = parseRgba(readVar(lightSrc, `--color-${tone}-bg`));
    assert.ok(tint, `--color-${tone}-bg 不是 rgba()，判据要重写`);
    check(
      `亮色 --color-${tone}-text 对 --color-${tone}-bg`,
      readVar(lightSrc, `--color-${tone}-text`),
      flatten(tint!, pageBg),
    );
  }
}

// 3. 【反向断言】功能色主色本身当文字是【不够】的 —— 这正是这几档存在的理由。
//    有人若把主色调深到够用，这条会红，提醒他：该改的是用法，不是主色
//    （主色还要当填充和图标底，调深会把那边带坏）。
{
  const pageBg = parseHex(readVar(lightSrc, '--color-background-primary'));
  for (const tone of ['success', 'warning', 'error'] as const) {
    const ratio = contrast(parseHex(readVar(lightSrc, `--color-${tone}`)), pageBg);
    assert.ok(
      ratio < AA_BODY,
      `--color-${tone} 对白底已经有 ${ratio.toFixed(2)}，够当正文了 —— ` +
        `若确是有意调深，请连同 --color-${tone}-text 的存废一起考虑`,
    );
  }
}

// 4. 【暗色】三个文字档对三种底都够：页面底、卡片底、压在自家浅底上（叠在卡片底上算）。
//    三个都要测，少测一个就会漏：
//      - 照抄亮色的深色调 -> 页面底就当场不过（2.x）；
//      - 只测页面底 -> 漏掉卡片底。弹窗/菜单/面板全是卡片底，比页面底还常见，
//        2026-09-22 之前 --color-error-text 就是这么漏的（页面底 4.91 过，卡片底 4.32 不过）；
//      - 只测这两个 -> 漏掉「浅底 + 同色字」的小标签，那是最坏的一档。
{
  const pageBg = parseHex(readVar(darkSrc, '--color-background-primary'));
  const cardBg = parseHex(readVar(darkSrc, '--color-background-card'));
  for (const tone of ['success', 'warning', 'error'] as const) {
    const v = readVar(darkSrc, `--color-${tone}-text`);
    check(`暗色 --color-${tone}-text 对页面底`, v, pageBg);
    check(`暗色 --color-${tone}-text 对卡片底`, v, cardBg);

    const tint = parseRgba(readVar(darkSrc, `--color-${tone}-bg`));
    assert.ok(tint, `暗色 --color-${tone}-bg 不是 rgba()，判据要重写`);
    check(`暗色 --color-${tone}-text 对自家浅底（叠在卡片上）`, v, flatten(tint!, cardBg));
  }
}

// 5. hover 档在【暗色】里必须自己定义，不能漏用亮色的值。
//    theme-default.less 定义在 :root 上，暗色只覆盖一部分 —— 没覆盖的会原样漏下来。
//    2026-09-22 之前 success/error 的 hover 就是漏的：亮色那两档都是深色，
//    在暗底上只有 2.48 / 2.39，等于看不见，而全仓有 27 处在用。
{
  const pageBg = parseHex(readVar(darkSrc, '--color-background-primary'));
  const cardBg = parseHex(readVar(darkSrc, '--color-background-card'));
  for (const tone of ['success', 'error'] as const) {
    const name = `--color-${tone}-hover`;
    assert.ok(
      new RegExp(`(^|[\\s;{])${name}\\s*:`).test(darkSrc.replace(/\/\*[\s\S]*?\*\//g, '')),
      `${name} 暗色下没有定义，会漏用亮色的深色值（在暗底上看不见）`,
    );
    check(`暗色 ${name} 对页面底`, readVar(darkSrc, name), pageBg);
    check(`暗色 ${name} 对卡片底`, readVar(darkSrc, name), cardBg);
  }
}

// 5b. 【实心底 + 白字】success / warning 的主色扛不住白字：2.78 / 2.16，连 3 都不到。
//     所以各配了一个 -solid 档。判据是 3 而不是 4.5 —— 主按钮那次定过：彩底白字维持 >=3
//     （翻成黑字数字上更好看，但实测观感更差，见 --color-primary-solid 那一套）。
//     error(3.68) 和 info(4.10) 本来就过 3，【故意不配 solid 档】，所以这里也不测它们：
//     加一个值等于原色的别名就是造第二个真相源。
{
  const WHITE = '#ffffff';
  const AA_UI = 3;
  for (const tone of ['success', 'warning'] as const) {
    for (const [label, src] of [
      ['亮色', lightSrc],
      ['暗色', darkSrc],
    ] as const) {
      const solid = readVar(src, `--color-${tone}-solid`);
      check(`${label} 白字压 --color-${tone}-solid`, WHITE, parseHex(solid), AA_UI);
    }
    // 反向：主色本身【必须】扛不住白字 —— 否则这个 -solid 档就没有存在理由了
    const base = contrast(parseHex(readVar(lightSrc, `--color-${tone}`)), parseHex(WHITE));
    assert.ok(base < AA_UI, `--color-${tone} 压白字已经有 ${base.toFixed(2)} 了，--color-${tone}-solid 可以考虑退役`);
  }
  // 实心底明暗两套同值：它扛的是压在自己身上的白字，和页面底色无关
  for (const tone of ['success', 'warning'] as const) {
    assert.strictEqual(
      readVar(lightSrc, `--color-${tone}-solid`),
      readVar(darkSrc, `--color-${tone}-solid`),
      `--color-${tone}-solid 明暗两套取值应当相同`,
    );
  }
}

// 5c. 【文字灰阶要对每一层背景都成立，不能只对页面主底成立】
//     --color-text-tertiary 是本仓用得最多的弱化文字档（约 4000 处）。
//     它原先那个灰正好是"白底上 4.5 的临界值"，余量为 0，
//     于是只要底色稍微不是纯白就跌破：极浅底 4.35、区块/hover 底 4.17。
//     而这几层底色在页面上到处都是，浏览器探针扫出来的 4.3 上下的零星不达标
//     基本都是这一个原因。这条断言逼着它对每一层背景都留余量。
//
//     【禁用底不在名单里】那上面的文字本来就该用 disabled 档，WCAG 也豁免禁用控件。
{
  const LAYERS = [
    '--color-background-primary',
    '--color-background-secondary',
    '--color-background-tertiary',
    '--color-background-hover',
  ];
  for (const [label, src] of [
    ['亮色', lightSrc],
    ['暗色', darkSrc],
  ] as const) {
    const fg = readVar(src, '--color-text-tertiary');
    for (const layer of LAYERS) {
      const bg = readVar(src, layer);
      if (!/^#/.test(bg)) continue; // 半透明层不在这条的射程内
      check(`${label} --color-text-tertiary 对 ${layer}`, fg, parseHex(bg));
    }
  }
}

// 5d. 【反向断言 · 全仓扫描】-text 档不许当背景用。
//     这是 2026-09-22 真踩到的：徽标为了让 12px 白字够 4.5，把底色从 --color-error
//     改成了 --color-error-text，亮色下白字压深红 5.62、看着完全正常 ——
//     但**文字档亮色是深色、暗色是浅色，方向相反**，暗色下就成了白字压浅粉，只剩 2.15。
//     这种错在亮色下测不出来，只能靠静态断言拦。
//     要"够深的实心底"请用 --color-*-solid：那一档明暗同值，就是为这个场景配的。
{
  const { execSync } = require('child_process');
  const repoRoot = path.resolve(__dirname, '../../../..');
  const files: string[] = execSync(`git -C ${repoRoot} ls-files 'src/**'`, {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
    .split('\n')
    .filter((f: string) => /\.(less|css|ts|tsx)$/.test(f));

  const BAD = /background[-\w]*\s*:\s*[^;{}]*var\(--color-(?:primary|success|warning|error)-text\)/;
  const offenders: string[] = [];
  for (const f of files) {
    let src: string;
    try {
      src = fs.readFileSync(path.join(repoRoot, f), 'utf8');
    } catch {
      continue;
    }
    if (!/-text\)/.test(src)) continue;
    // 注释里提到不算数
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .forEach((line: string, i: number) => {
        if (/^\s*\/\//.test(line)) return;
        if (BAD.test(line)) offenders.push(`${f}:${i + 1}  ${line.trim().slice(0, 80)}`);
      });
  }
  assert.strictEqual(
    offenders.length,
    0,
    '把 --color-*-text 当背景用了（亮色看着对、暗色会反过来）。改用 --color-*-solid：\n  ' + offenders.join('\n  '),
  );
}

// 6. hover 档的方向：亮色下比主色【更深】，暗色下比主色【更亮】。
//    方向写反了肉眼不一定立刻看出来（两边都还是"变了一点"），但 hover 会往背景里塌。
{
  for (const tone of ['success', 'error'] as const) {
    const lightBase = relativeLuminance(parseHex(readVar(lightSrc, `--color-${tone}`)));
    const lightHover = relativeLuminance(parseHex(readVar(lightSrc, `--color-${tone}-hover`)));
    assert.ok(lightHover < lightBase, `亮色 --color-${tone}-hover 应该比主色更深`);

    const darkBase = relativeLuminance(parseHex(readVar(darkSrc, `--color-${tone}`)));
    const darkHover = relativeLuminance(parseHex(readVar(darkSrc, `--color-${tone}-hover`)));
    assert.ok(darkHover > darkBase, `暗色 --color-${tone}-hover 应该比主色更亮`);
  }
}

console.log('functionalTextTokens spec 通过');
