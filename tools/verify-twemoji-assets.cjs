/**
 * twemoji 2.5.1 → 14.0.2 的可行性判据：新版会不会生成【服务器上没有的】图片文件名。
 *
 * 关键约束：本仓的 twemoji 图片是【自托管】的 ——
 *   src/components/emotion/emotion.ts 里 twemoji.base = '/staticfiles/images/emotion/twemoji/'
 * 那个目录随 HAP 镜像走（容器内 www/staticfiles/…/72x72/，实测 2661 个 png），
 * 【不在本仓的构建产物里，我们加不了新图】。
 * 所以升级 twemoji 的真实风险不是 API 变了，而是：
 * 新版解析器给某些 emoji 算出不同的码点文件名 → src 指向不存在的文件 → 表情变裂图。
 * 这种故障不报错、不影响构建、tsc 也看不见，只有用户点开表情面板才发现。
 *
 * 所以这里逐个 emoji 比三件事：
 *   1. 两版 parse 出来的 <img src> 是否一致
 *   2. 新版产出的每个文件名是否都在服务器的资产清单里
 *   3. 老版本来就缺的（说明线上现在就是裂的）单独列出来，避免算到升级头上
 *
 * 资产清单的取法（容器内）：
 *   ssh … "docker exec script-app-1 sh -c 'ls .../twemoji/72x72/'" \
 *     | grep '\.png$' | sed 's/\.png$//' | sort > /tmp/twemoji_assets.txt
 *
 * 运行：
 *   mkdir -p /tmp/tw2 /tmp/tw14   # 各自 npm i twemoji@2.5.1 / @14.0.2
 *   node tools/verify-twemoji-assets.cjs
 */
const fs = require('fs');
const path = require('path');
const RW = path.resolve(__dirname, '..') + '/';

const ASSETS = process.env.TWEMOJI_ASSETS || '/tmp/twemoji_assets.txt';

if (!fs.existsSync(ASSETS)) {
  console.error(`找不到资产清单 ${ASSETS}，取法见本文件头。`);
  process.exit(2);
}

const assets = new Set(fs.readFileSync(ASSETS, 'utf8').split('\n').map(s => s.trim()).filter(Boolean));

if (assets.size < 1000) {
  console.error(`资产清单只有 ${assets.size} 条，明显不对；拒绝在残缺清单上下结论。`);
  process.exit(2);
}

// 从 data.ts 里抠出所有 emoji 字符 —— 直接用真实表情面板的内容，不自己编一份
const dataSrc = fs.readFileSync(RW + 'src/components/emotion/data.ts', 'utf8');
const emojis = [];

for (const m of dataSrc.matchAll(/^\s*'([^']+)',?\s*$/gm)) {
  const s = m[1];
  // 只取真的含 emoji 码点的行（跳过 'wx_thumb.gif' 这类默认表情文件名和中英文名）
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}]/u.test(s)) emojis.push(s);
}

const uniq = [...new Set(emojis)];

if (uniq.length < 200) {
  console.error(`只从 data.ts 解析出 ${uniq.length} 个 emoji，解析逻辑大概率坏了。`);
  process.exit(2);
}

function srcsOf(twemoji, str) {
  const html = twemoji.parse(str, { base: '/staticfiles/images/emotion/twemoji/', size: 72 });
  return [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
}

const tw2 = require(process.env.TW2 || '/tmp/tw2/node_modules/twemoji');
const tw14 = require(process.env.TW14 || '/tmp/tw14/node_modules/twemoji');

const nameOf = src => src.split('/').pop().replace(/\.png$/, '');

let same = 0;
const changed = [];
const newMissing = [];
const alreadyMissing = [];
let unparsed2 = 0;

for (const e of uniq) {
  const a = srcsOf(tw2, e);
  const b = srcsOf(tw14, e);

  if (!a.length) unparsed2++;

  if (JSON.stringify(a) !== JSON.stringify(b)) changed.push({ emoji: e, v2: a.map(nameOf), v14: b.map(nameOf) });
  else same++;

  for (const s of b) {
    const n = nameOf(s);

    if (assets.has(n)) continue;

    // 老版就已经指向缺失文件的，是【线上现状】，不算升级引入的
    (a.map(nameOf).includes(n) ? alreadyMissing : newMissing).push({ emoji: e, file: n });
  }
}

console.log(`\n  表情面板里的 emoji: ${uniq.length} 个     服务器资产: ${assets.size} 个`);
console.log(`  两版 src 完全一致: ${same}     不一致: ${changed.length}`);
console.log(`  2.5.1 就解析不出图的: ${unparsed2}`);

const show = (title, arr) => {
  if (!arr.length) return;

  console.log(`\n  ${title}（前 20 条）:`);
  arr.slice(0, 20).forEach(x => console.log('    ' + JSON.stringify(x)));

  if (arr.length > 20) console.log(`    …还有 ${arr.length - 20} 条`);
};

show('两版文件名不同', changed);
show('【升级会新引入的裂图】14 指向了服务器上没有的文件', newMissing);
show('（升级前就裂的，线上现状，不算这次的账）', alreadyMissing);

/* ── 第二半：面板之外的 emoji ────────────────────────────────────────────
 * emotion.ts:556 的 `twemoji.parse(str)` 是喂给【任意用户文本】的，不只是面板。
 * 而 twemoji 14 认识的 emoji 比 2.5.1 多得多 —— 那些「2.5.1 当普通文字放过、
 * 14 却要转成 <img>」的字符，一旦服务器上没有对应 png 就直接变裂图。
 * 也就是说升级会把「用户打了个新 emoji，显示成系统原生字形」
 * 变成「显示成一个裂掉的图片」。第一版判据只测了面板那 456 个，完全看不到这一半。
 * 这里把常见 emoji 码段整段扫一遍。
 */
const RANGES = [
  [0x2190, 0x21ff], [0x2300, 0x23ff], [0x2460, 0x24ff], [0x25a0, 0x27bf],
  [0x2b00, 0x2bff], [0x1f000, 0x1f0ff], [0x1f100, 0x1f1ff], [0x1f200, 0x1f2ff],
  [0x1f300, 0x1f5ff], [0x1f600, 0x1f64f], [0x1f680, 0x1f6ff], [0x1f700, 0x1f7ff],
  [0x1f900, 0x1f9ff], [0x1fa70, 0x1faff],
];

let scanned = 0;
const onlyIn14 = [];      // 2.5.1 不转、14 转
const onlyIn14Missing = []; // 且服务器没有对应图 —— 这些就是新裂图

for (const [lo, hi] of RANGES) {
  for (let cp = lo; cp <= hi; cp++) {
    const ch = String.fromCodePoint(cp);
    scanned++;
    const a = srcsOf(tw2, ch);
    const b = srcsOf(tw14, ch);

    if (a.length || !b.length) continue;

    onlyIn14.push(cp.toString(16));

    if (!b.every(s => assets.has(nameOf(s)))) onlyIn14Missing.push({ cp: 'U+' + cp.toString(16).toUpperCase(), ch, file: b.map(nameOf).join(',') });
  }
}

console.log(`\n  面板之外：扫了 ${scanned} 个码点`);
console.log(`  2.5.1 不转、14 要转的: ${onlyIn14.length} 个`);
console.log(`  其中服务器【没有】对应图片的: ${onlyIn14Missing.length} 个  ← 升级后用户打出来就是裂图`);
show('新裂图样例', onlyIn14Missing);

const blocking = newMissing.length + onlyIn14Missing.length;
console.log(
  `\n  → 升级${blocking ? `会新增 ${blocking} 处裂图（面板内 ${newMissing.length} + 面板外 ${onlyIn14Missing.length}）` : '不会新增裂图'}`,
);
process.exit(blocking ? 1 : 0);
