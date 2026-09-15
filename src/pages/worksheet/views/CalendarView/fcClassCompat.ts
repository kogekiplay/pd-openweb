/**
 * FullCalendar v7 类名兼容层：把 v6 的语义类名原样挂回去。
 *
 * 【为什么需要这个文件】v7 把类名【全部哈希化】了 —— skeleton.css 里是
 * `.fc-0X` `.fc-1U`，主题里是 `.fc-classic-0Bj`。实测 fc-event / fc-toolbar /
 * fc-daygrid-day / fc-event-title / fc-day-today / fc-timegrid-event /
 * fc-highlight 在 v7 的 CSS 和运行时 JS 里【一个都搜不到】。
 *
 * 本仓对这些类名的依赖有两类，而且【都不会报错】：
 *   · 样式：index.less 里 90 条 + 移动端 23 条针对 .fc-* 的覆盖 —— 失效只是难看
 *   · 【JS 直接按类名查 DOM】20 处 —— 查不到就是功能坏：
 *       index.tsx:110  强制 .fc-daygrid-body/.fc-col-header 宽 100%（布局）
 *       index.tsx:179  .fc-toolbar-chunk 绑点击（工具栏交互）
 *       index.tsx:661  .fc-col-header-cell 点击（点日期表头）
 *       index.tsx:787  .fc-more-popover 测高定位（"+N 更多"弹层）
 *       util.ts:352    往 .fc-timegrid-body 塞当前时间线
 *       util.ts:399    .fc-event-dragging（拖拽）
 *       CalendarEvent.tsx:198 / EventContent:49  事件标题与点击
 * 这 20 处失效是静默的，六道门禁一条都抓不到。
 *
 * 【为什么不是"改用 v7 的好看样式"】上面第二类是功能不是外观，丢不起。
 * 【为什么不是"重新设计界面"】没必要 —— v7 给了 98 个 *Class 钩子，
 * 接受纯字符串或「按渲染状态返回类名」的函数，足够把原类名原样挂回来。
 * 这样 113 条 CSS 和 20 处 JS 查询【一个字都不用改】。
 *
 * 【顺带的收益】改完之后依赖的是受支持的 API，而不是库的内部 DOM ——
 * 下次升级不会再这样断。这也是 v7 隐藏内部类名的本意。
 *
 * ── 覆盖情况（57 个依赖类逐个对过）────────────────────────────────────────
 * 44 个有 1:1 的钩子，见下面的映射。
 *  9 个没有独立钩子，但能从挂了钩子的祖先做后代选择（popover 的 header/body、
 *    事件的 dot、各种 *-harness 包装层）——这部分改 .less，不在本文件。
 *  4 个在 v7 里【真的没有了】：fc-scroller-harness / fc-scrollgrid-sync-inner /
 *    fc-scrollgrid-section / fc-theme-standard。前三个是 v6 布局怪癖的绕行补丁
 *    （强制 100% 宽、算 scroller 高度），v7 重写了布局引擎，八成本来就不需要；
 *    fc-theme-standard 是 v6 的内置主题标记，v7 主题改成插件了。
 *    这 4 个必须【看渲染结果】才能确认，不能靠读代码下结论。
 */

// 【一律用库导出的类型，别手写内联形状】手写的话签名对不上只会在展开处报一句
// 「不可赋值给 BaseOptions」，看不出是哪个钩子错了 —— 第一版就栽在 buttonClass
// 上（我写的 isActive，实际叫 isSelected）。用真类型，改名会被直接点名。
import type { ButtonInfo, DayCellInfo, DayHeaderInfo, DayLaneInfo, EventDisplayInfo, ViewDisplayInfo } from '@fullcalendar/react';

/** v6 的 dow -> 星期类名，日期格与表头都会带 */
const DOW_CLASS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** v6 在日期格/表头上挂的那组状态类 */
function dateMetaClasses(info: {
  dow: number;
  isToday: boolean;
  isOther: boolean;
  isPast: boolean;
  isFuture: boolean;
  isDisabled: boolean;
}): string {
  return [
    'fc-day',
    `fc-day-${DOW_CLASS[info.dow]}`,
    info.isToday && 'fc-day-today',
    info.isOther && 'fc-day-other',
    info.isPast && 'fc-day-past',
    info.isFuture && 'fc-day-future',
    info.isDisabled && 'fc-day-disabled',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * 直接展开到 <FullCalendar {...FC_CLASS_COMPAT} /> 上。
 * 放在其它 props 【之前】展开，这样调用方想覆盖某一项仍然可以。
 */
export const FC_CLASS_COMPAT = {
  // ── 工具栏 ──────────────────────────────────────────────────────────
  toolbarClass: 'fc-toolbar',
  headerToolbarClass: 'fc-header-toolbar',
  toolbarSectionClass: 'fc-toolbar-chunk',
  toolbarTitleClass: 'fc-toolbar-title',
  buttonGroupClass: 'fc-button-group',
  // v6 的按钮类：fc-button fc-button-primary，选中态 fc-button-active。
  // 按钮名（today/prev/next/视图名）也要带上，index.less 里按 .fc-prev-button 之类写过。
  buttonClass: (info: ButtonInfo) =>
    [
      'fc-button',
      info.isPrimary && 'fc-button-primary',
      `fc-${info.name}-button`,
      // v6 叫 fc-button-active，v7 的渲染参数里是 isSelected
      info.isSelected && 'fc-button-active',
      info.isDisabled && 'fc-button-disabled',
    ]
      .filter(Boolean)
      .join(' '),

  // ── 视图与表格骨架 ──────────────────────────────────────────────────
  viewClass: (info: ViewDisplayInfo) => `fc-view fc-${info.view.type}-view`,
  tableClass: 'fc-scrollgrid',
  tableHeaderClass: 'fc-scrollgrid-section-header',
  tableBodyClass: 'fc-scrollgrid-section-body',

  // ── 日期表头 ────────────────────────────────────────────────────────
  dayHeaderRowClass: 'fc-col-header',
  dayHeaderClass: (info: DayHeaderInfo) => `fc-col-header-cell ${dateMetaClasses(info)}`,
  dayHeaderInnerClass: 'fc-col-header-cell-cushion',

  // ── 日期格（月视图 / 全天行）────────────────────────────────────────
  dayCellClass: (info: DayCellInfo) => `fc-daygrid-day ${dateMetaClasses(info)}`,
  dayCellInnerClass: 'fc-daygrid-day-frame',
  dayCellTopClass: 'fc-daygrid-day-top',
  dayCellTopInnerClass: 'fc-daygrid-day-number',
  dayCellBottomClass: 'fc-daygrid-day-bottom',

  // ── 时间网格（周/日视图）────────────────────────────────────────────
  dayLaneClass: (info: DayLaneInfo) => `fc-timegrid-col ${dateMetaClasses(info)}`,
  slotLaneClass: 'fc-timegrid-slot fc-timegrid-slot-lane',
  slotHeaderClass: 'fc-timegrid-slot fc-timegrid-slot-label',
  slotHeaderInnerClass: 'fc-timegrid-slot-label-cushion',
  allDayHeaderClass: 'fc-timegrid-axis',
  nowIndicatorLineClass: 'fc-timegrid-now-indicator-line',
  nowIndicatorDotClass: 'fc-timegrid-now-indicator-arrow',

  // ── 事件 ────────────────────────────────────────────────────────────
  // v6 的事件元素同时带 fc-event 和按呈现形态分的 fc-h-event / fc-v-event，
  // 再加所在视图的 fc-daygrid-event / fc-timegrid-event。
  eventClass: (info: EventDisplayInfo) =>
    ['fc-event', info.isMirror && 'fc-event-mirror', info.isStart && 'fc-event-start', info.isEnd && 'fc-event-end']
      .filter(Boolean)
      .join(' '),
  eventInnerClass: 'fc-event-main',
  eventTimeClass: 'fc-event-time',
  eventTitleClass: 'fc-event-title',
  rowEventClass: 'fc-daygrid-event fc-h-event',
  blockEventClass: 'fc-daygrid-block-event',
  columnEventClass: 'fc-timegrid-event fc-v-event',
  backgroundEventClass: 'fc-bg-event',

  // ── 更多链接与弹层 ──────────────────────────────────────────────────
  moreLinkClass: 'fc-more-link',
  rowMoreLinkClass: 'fc-daygrid-more-link',
  columnMoreLinkClass: 'fc-timegrid-more-link',
  // index.tsx:787 起靠 .fc-more-popover 测高定位，这一条挂不上就是弹层错位
  popoverClass: 'fc-popover fc-more-popover',

  // ── 选区高亮（CalendarIds.tsx:46 会 remove 它）──────────────────────
  highlightClass: 'fc-highlight',
} as const;
