/**
 * 把 FullCalendar 的时长（Duration）换算成后端 editCalendarTime 要的
 * { dayDelta, minuteDelta }。
 *
 * 【2026-09-18 修的一个 v2 -> v7 迁移遗留 bug】原先 ajaxAfterDrop 里写的是
 *   var dayDelta = delta._days;
 *   var minuteDelta = delta._milliseconds / 60000;
 * `_days` / `_milliseconds` 是 **moment.Duration 的内部字段** —— FullCalendar 2.x
 * 用的是 moment duration，所以那样写在 v2 时代是对的。
 *
 * v7 换成了自己的 Duration：`{ years, months, days, milliseconds }`
 *（定义在 @full-ui/headless-calendar）。于是：
 *   · 拖动（eventDrop）：delta 在，但 `._days` / `._milliseconds` 都是 undefined，
 *     发给后端的成了 dayDelta: undefined、minuteDelta: NaN。
 *   · 拉伸（eventResize）：v7 的 EventResizeDoneInfo 【根本没有 delta】，
 *     只有 startDelta / endDelta —— `delta._days` 直接抛 TypeError。
 *
 * 单独成模块是为了能脱开整个日历页单独测，见同目录的 delta.spec.ts。
 */

/** FullCalendar v7 的时长。字段见 @full-ui/headless-calendar 的 Duration。 */
export interface FcDuration {
  years?: number;
  months?: number;
  days?: number;
  milliseconds?: number;
}

/** 后端 editCalendarTime 要的偏移量 */
export interface TimeDelta {
  dayDelta: number;
  minuteDelta: number;
}

/**
 * 【取不到时给 0 而不是 undefined/NaN】后端按这两个数算新的起止时间，
 * 传 undefined 或 NaN 过去比"没有偏移"更糟。
 * years / months 不参与：拖拽产生的偏移 FullCalendar 一律表达成 days + milliseconds，
 * 只有显式构造的 Duration 才会有年月。
 */
export function toTimeDelta(duration?: FcDuration | null): TimeDelta {
  const days = duration && typeof duration.days === 'number' ? duration.days : 0;
  const ms = duration && typeof duration.milliseconds === 'number' ? duration.milliseconds : 0;
  return { dayDelta: days, minuteDelta: ms / 60000 };
}
