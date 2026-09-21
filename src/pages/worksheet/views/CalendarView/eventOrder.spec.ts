/**
 * buildEventOrder / compareCell 的行为 spec。
 *
 * 【被守的 bug】日历视图的设置抽屉里一直有「排序」那一栏，建视图时还会自动写一条
 * 默认排序（`moreSort: [{ controlId: 'ctime', isAsc: true }]`），但渲染时
 * `eventOrder` 被写死成 `'start'` —— 配了等于没配。
 *
 * 【为什么不能偷懒直接传字符串给 FullCalendar】库自带的 flexibleCompare 对字符串
 * 一律字典序，而 HAP 的单元格值**都是字符串**：数值列会排成 "10" < "9"。
 * 下面第 2 组就是钉这个的。
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');

type Rule = { controlId?: string; isAsc?: boolean };
type Ctl = { controlId?: string; type?: number; sourceControlType?: number };
type Obj = Record<string, any>;
type Mod = {
  buildEventOrder: (m?: Rule[], c?: Ctl[]) => Array<string | ((a: Obj, b: Obj) => number)>;
  compareCell: (a: unknown, b: unknown, kind: 'number' | 'date' | 'text') => number;
  cellKindOf: (c?: Ctl) => string;
};

/** 载入真实模块。它零 import、只导出纯函数，不需要替身。 */
function load(): Mod {
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'eventOrder.ts'), {
    babelrc: false,
    presets: [['@babel/preset-typescript', { allExtensions: true }]],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports as unknown as Mod;
}

const { buildEventOrder, compareCell, cellKindOf } = load();

/** 用生成的比较函数把一组对象排好，返回 name 顺序，方便断言 */
function sortNames(order: Array<string | ((a: Obj, b: Obj) => number)>, rows: Obj[]): string[] {
  const cmp = order[0] as (a: Obj, b: Obj) => number;
  return rows.slice().sort(cmp).map(r => r.name);
}

// 1. 没配排序时退回 ['start']，不要凭空造一个比较函数
assert.deepStrictEqual(buildEventOrder(undefined, []), ['start']);
assert.deepStrictEqual(buildEventOrder([], []), ['start']);
assert.deepStrictEqual(buildEventOrder([{ isAsc: true }], []), ['start'], '没有 controlId 的规则要被忽略');

// 2. 【核心】数值列按数值比，不是字典序 —— "9" 必须排在 "10" 后面（降序时在前）
const numCtl: Ctl[] = [{ controlId: 'c1', type: 6 }];
const numRows: Obj[] = [{ name: 'a', c1: '10' }, { name: 'b', c1: '9' }, { name: 'c', c1: '100' }];
assert.deepStrictEqual(
  sortNames(buildEventOrder([{ controlId: 'c1', isAsc: true }], numCtl), numRows),
  ['b', 'a', 'c'],
  '数值升序应为 9 < 10 < 100；按字典序会得到 10 < 100 < 9',
);
assert.deepStrictEqual(
  sortNames(buildEventOrder([{ controlId: 'c1', isAsc: false }], numCtl), numRows),
  ['c', 'a', 'b'],
);

// 3. 日期列按时间比。"2026-09-09" 和 "2026-09-10" 字典序碰巧也对，
//    所以用一组字典序会排错的：带时分的同一天
const dateCtl: Ctl[] = [{ controlId: 'd1', type: 16 }];
const dateRows: Obj[] = [
  { name: 'late', d1: '2026-09-21 09:05:00' },
  { name: 'early', d1: '2026-09-21 09:00:00' },
  { name: 'nextday', d1: '2026-09-22 08:00:00' },
];
assert.deepStrictEqual(
  sortNames(buildEventOrder([{ controlId: 'd1', isAsc: true }], dateCtl), dateRows),
  ['early', 'late', 'nextday'],
);

// 4. 他表字段(30) 要看 sourceControlType，不能按 30 本身判
assert.strictEqual(cellKindOf({ type: 30, sourceControlType: 6 }), 'number');
assert.strictEqual(cellKindOf({ type: 30, sourceControlType: 16 }), 'date');
assert.strictEqual(cellKindOf({ type: 30, sourceControlType: 2 }), 'text');
assert.strictEqual(cellKindOf(undefined), 'text', '找不到控件时按文本比，不能抛');

// 5. 空值恒排最后，**不跟着升降序翻面**
//    （升序时把一堆空值顶到最前面，是"排序坏了"的典型观感）
const emptyRows: Obj[] = [{ name: 'empty', c1: '' }, { name: 'two', c1: '2' }, { name: 'one', c1: '1' }];
assert.deepStrictEqual(
  sortNames(buildEventOrder([{ controlId: 'c1', isAsc: true }], numCtl), emptyRows),
  ['one', 'two', 'empty'],
);
assert.deepStrictEqual(
  sortNames(buildEventOrder([{ controlId: 'c1', isAsc: false }], numCtl), emptyRows),
  ['two', 'one', 'empty'],
  '降序时空值仍在最后',
);

// 6. 多级排序：第一级相同才看第二级
const multiCtl: Ctl[] = [{ controlId: 'g', type: 2 }, { controlId: 'n', type: 6 }];
const multiRows: Obj[] = [
  { name: 'b2', g: 'B', n: '2' },
  { name: 'a10', g: 'A', n: '10' },
  { name: 'a2', g: 'A', n: '2' },
];
assert.deepStrictEqual(
  sortNames(buildEventOrder([{ controlId: 'g', isAsc: true }, { controlId: 'n', isAsc: true }], multiCtl), multiRows),
  ['a2', 'a10', 'b2'],
);

// 7. 末尾垫 'start' 做同值兜底 —— 否则同分的几条顺序会随机漂，
//    每次重渲露在「+N 更多」外面的那条都不一样
const order = buildEventOrder([{ controlId: 'c1', isAsc: true }], numCtl);
assert.strictEqual(order.length, 2);
assert.strictEqual(typeof order[0], 'function');
assert.strictEqual(order[1], 'start');

// 8. 解析不出来的值退回文本比，绝不能返回 NaN
//    （Array.prototype.sort 拿到 NaN 的行为是未定义的）
assert.strictEqual(Number.isNaN(compareCell('abc', 'def', 'number')), false);
assert.strictEqual(compareCell('abc', 'abc', 'number'), 0);
assert.strictEqual(Number.isNaN(compareCell('不是日期', '也不是', 'date')), false);

console.log('eventOrder spec 通过');
