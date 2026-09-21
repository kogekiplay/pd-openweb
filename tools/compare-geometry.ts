/**
 * 对比两份几何快照（tools/geometry-probe.ts 采的），报出版面变化。
 *
 * 用法：
 *   node tools/compare-geometry.ts <before.json> <after.json>
 *   node tools/compare-geometry.ts <before.json> <after.json> --all   # 不截断，全列
 *
 * 退出码：有超阈值变化 = 1，没有 = 0。可以直接当门禁用。
 *
 * 【阈值不是一个数，是按维度分的】—— 这是这个工具的核心判断：
 * · 字号、行高：**0 容差**。14px 变 15px 就是改了，没有"差不多"。
 * · 内外边距：**0 容差**。同理。
 * · 宽高：容 1px。subpixel 布局 + 取整会产生 ±1 的抖动，报出来全是噪声。
 * · 坐标：容 2px。一个元素高度变 1px，它下面所有兄弟的 y 都会挪 ——
 *   **这类连锁位移是"结果"不是"原因"**，全报出来会把真正的改动淹掉。
 *   所以坐标阈值放宽，并且排序时把它排在最后。
 *
 * 【为什么要区分"新增/消失"和"变化"】
 * 两份快照之间元素集合本来就可能不同（异步内容、hover 态、列表条数）。
 * 把它们混进"变化"里会让人以为版面炸了。分开列，而且**新增/消失不计入退出码** ——
 * 它们几乎总是采集时机差异，不是改动造成的。真要看，用 --all。
 *
 * 【一个会让整份对比失效的前提】
 * 两份快照的 `视口`、`暗色`、`路由` 必须相同，`采集间漂移元素数` 必须都是 0。
 * 不满足就直接中止 —— 宁可不给结论，也不要给一个"看起来像结论"的噪声列表。
 * 视口差 1px 就能让整页 flex 布局重算，那种 diff 没有任何参考价值。
 *
 * 注意判据是**漂移元素数**，不是"运行中动画数"。后者试过，实测废掉：
 * 本应用每页常驻 8 个滚动条把手动画（只动 transform，不影响版面），
 * 拿它当判据会让每一页都误报中止。详见 geometry-probe.ts 的坑三。
 */
const fs = require('fs');
const path = require('path');

/** 各维度的容差，见文件头说明。 */
const TOLERANCE: Record<string, number> = {
  fs: 0,
  lh: 0,
  m: 0,
  p: 0,
  w: 1,
  h: 1,
  x: 2,
  y: 2,
};

/** 报告里的排序权重：越小越靠前。坐标位移多半是连锁结果，排最后。 */
const PRIORITY: Record<string, number> = { fs: 0, lh: 1, p: 2, m: 3, h: 4, w: 5, y: 6, x: 7 };

const FIELD_NAME: Record<string, string> = {
  fs: '字号',
  lh: '行高',
  m: '外边距',
  p: '内边距',
  w: '宽',
  h: '高',
  x: '横坐标',
  y: '纵坐标',
};

function load(file: string) {
  if (!fs.existsSync(file)) {
    console.error(`找不到 ${file}`);
    process.exit(2);
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!json || !Array.isArray(json.elements) || !json.meta) {
    console.error(`${file} 不是几何快照（缺 meta 或 elements）`);
    process.exit(2);
  }
  return json;
}

/** 数值维度差超阈值吗。字符串维度（m/p/lh 的 normal）只看相不相等。 */
function exceeds(field: string, a: any, b: any): boolean {
  if (a === b) return false;
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) > (TOLERANCE[field] ?? 0);
  }
  return true; // 类型不同或字符串不等，一律算变化
}

const argv: string[] = process.argv.slice(2);
const showAll = argv.includes('--all');
const files = argv.filter(a => !a.startsWith('--'));

if (files.length !== 2) {
  console.error('用法: node tools/compare-geometry.ts <before.json> <after.json> [--all]');
  process.exit(2);
}

const before = load(files[0]);
const after = load(files[1]);

/* ---------- 可比性前置检查（不满足就中止，见文件头）---------- */
const blockers: string[] = [];
if (before.meta.视口 !== after.meta.视口) {
  blockers.push(`视口不同：${before.meta.视口} vs ${after.meta.视口}`);
}
if (before.meta.暗色 !== after.meta.暗色) {
  blockers.push(`明暗主题不同：${before.meta.暗色 ? '暗' : '亮'} vs ${after.meta.暗色 ? '暗' : '亮'}`);
}
if (before.meta.路由 !== after.meta.路由) {
  blockers.push(`路由不同：${before.meta.路由} vs ${after.meta.路由}`);
}
for (const [label, snap] of [
  ['before', before],
  ['after', after],
] as Array<[string, any]>) {
  if (snap.meta.采集间漂移元素数 === undefined) {
    blockers.push(`${label} 是旧格式快照（没有 采集间漂移元素数），重采一次`);
  } else if (snap.meta.采集间漂移元素数 > 0) {
    blockers.push(`${label} 采集时页面还在动：${snap.meta.采集间漂移元素数} 个元素几何在漂移（等静止后重采）`);
  }
}

if (blockers.length) {
  console.error('两份快照不可比，中止：');
  for (const b of blockers) console.error('  · ' + b);
  console.error('\n宁可不给结论，也不要给一个看起来像结论的噪声列表。');
  process.exit(2);
}

/* ---------- 配对 ---------- */
const mapBefore = new Map<string, any>();
for (const e of before.elements) mapBefore.set(e.k, e);
const mapAfter = new Map<string, any>();
for (const e of after.elements) mapAfter.set(e.k, e);

interface Change {
  k: string;
  field: string;
  from: any;
  to: any;
}
const changes: Change[] = [];
for (const [k, b] of mapBefore) {
  const a = mapAfter.get(k);
  if (!a) continue;
  for (const field of Object.keys(TOLERANCE)) {
    if (exceeds(field, b[field], a[field])) changes.push({ k, field, from: b[field], to: a[field] });
  }
}

const vanished = [...mapBefore.keys()].filter(k => !mapAfter.has(k));
const appeared = [...mapAfter.keys()].filter(k => !mapBefore.has(k));

/* ---------- 报告 ---------- */
console.log(`路由 ${before.meta.路由}  视口 ${before.meta.视口}  ${before.meta.暗色 ? '暗色' : '亮色'}`);
console.log(`元素 ${before.elements.length} -> ${after.elements.length}\n`);

if (!changes.length) {
  console.log('版面几何无变化（按分维度阈值：字号/行高/内外边距 0 容差，宽高 1px，坐标 2px）。');
} else {
  changes.sort((c1, c2) => (PRIORITY[c1.field] ?? 9) - (PRIORITY[c2.field] ?? 9) || c1.k.localeCompare(c2.k));

  const tally: Record<string, number> = {};
  for (const c of changes) tally[c.field] = (tally[c.field] || 0) + 1;
  console.log('按维度计数：');
  for (const f of Object.keys(PRIORITY)) {
    if (tally[f]) console.log(`  ${String(tally[f]).padStart(5)}  ${FIELD_NAME[f]}`);
  }
  console.log('');

  const shown = showAll ? changes : changes.slice(0, 60);
  for (const c of shown) {
    // key 可能很长，只留末尾三段 —— 前面的祖先链对定位没什么帮助
    const short = c.k.split('>').slice(-3).join('>');
    console.log(`  ${FIELD_NAME[c.field]}: ${c.from} -> ${c.to}   ${short}`);
  }
  if (shown.length < changes.length) {
    console.log(`\n  …还有 ${changes.length - shown.length} 条，加 --all 全看。`);
  }
}

if (vanished.length || appeared.length) {
  console.log(`\n元素集合差异（不计入退出码，多半是采集时机）：消失 ${vanished.length}、新增 ${appeared.length}`);
  if (showAll) {
    for (const k of vanished.slice(0, 20)) console.log('  - ' + k.split('>').slice(-3).join('>'));
    for (const k of appeared.slice(0, 20)) console.log('  + ' + k.split('>').slice(-3).join('>'));
  }
}

process.exit(changes.length ? 1 : 0);
