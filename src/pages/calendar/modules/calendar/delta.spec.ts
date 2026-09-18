/**
 * toTimeDelta 的行为 spec —— 守住「日程拖动/拉伸后发给后端的偏移量是对的」。
 *
 * 【被守的 bug】2026-09-18，FullCalendar 2.x -> 7 迁移遗留。
 * 原先 ajaxAfterDrop 里写的是
 *   var dayDelta = delta._days;
 *   var minuteDelta = delta._milliseconds / 60000;
 * `_days` / `_milliseconds` 是 **moment.Duration 的内部字段**。v2 的 FullCalendar
 * 用 moment duration，所以当年是对的；v7 换成了自己的
 * `{ years, months, days, milliseconds }`（@full-ui/headless-calendar 的 Duration）。
 *
 * 后果有两条，下面第 1、3 组分别钉住：
 *   · 拖动（eventDrop）：delta 在，但两个下划线字段都是 undefined，
 *     于是 dayDelta 发 undefined、minuteDelta 发 NaN。
 *   · 拉伸（eventResize）：v7 的 EventResizeDoneInfo 【根本没有 delta】，
 *     只有 startDelta / endDelta —— 旧代码 `delta._days` 直接抛 TypeError。
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');

type FcDuration = { years?: number; months?: number; days?: number; milliseconds?: number };
type ToTimeDelta = (d?: FcDuration | null) => { dayDelta: number; minuteDelta: number };

/** 载入真实模块。它只导出纯函数、不 import 任何东西，所以不需要替身。 */
function loadToTimeDelta(): ToTimeDelta {
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'delta.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports.toTimeDelta as ToTimeDelta;
}

const toTimeDelta = loadToTimeDelta();

// 1. 【核心】v7 的 Duration：days / milliseconds，不是 _days / _milliseconds
assert.deepStrictEqual(toTimeDelta({ years: 0, months: 0, days: 2, milliseconds: 0 }), {
  dayDelta: 2,
  minuteDelta: 0,
});
assert.deepStrictEqual(toTimeDelta({ years: 0, months: 0, days: 0, milliseconds: 30 * 60000 }), {
  dayDelta: 0,
  minuteDelta: 30,
});
assert.deepStrictEqual(toTimeDelta({ years: 0, months: 0, days: -1, milliseconds: -45 * 60000 }), {
  dayDelta: -1,
  minuteDelta: -45,
});

// 2. 【负对照】喂 moment.Duration 那套内部字段，只能得到 0 —— 这正是坏掉时的样子。
//    旧代码读的就是这两个名字，所以在 v7 上拿到的是 undefined / NaN。
assert.deepStrictEqual(toTimeDelta({ _days: 2, _milliseconds: 60000 } as FcDuration), {
  dayDelta: 0,
  minuteDelta: 0,
});

// 3. 【拉伸那条路】v7 的 EventResizeDoneInfo 没有 delta，传进来就是 undefined。
//    必须给 0 而不是抛异常或 NaN —— 后端按这两个数算新的起止时间。
assert.deepStrictEqual(toTimeDelta(undefined), { dayDelta: 0, minuteDelta: 0 });
assert.deepStrictEqual(toTimeDelta(null), { dayDelta: 0, minuteDelta: 0 });
assert.deepStrictEqual(toTimeDelta({}), { dayDelta: 0, minuteDelta: 0 });

// 4. 天与分钟同时有偏移（跨天拖动到不同时刻）
assert.deepStrictEqual(toTimeDelta({ days: 1, milliseconds: 90 * 60000 }), { dayDelta: 1, minuteDelta: 90 });

console.log('toTimeDelta spec: 8 条断言全部通过');
