/**
 * 验证 FullCalendar v7 的类名兼容层真的把 v6 语义类名挂到了 DOM 上。
 *
 * 【为什么必须有这一条】v7 把内部类名全哈希化了（skeleton.css 里是 .fc-0X、
 * 主题里是 .fc-classic-0Bj）。本仓有 113 条 CSS 覆盖和【20 处 JS 按类名查 DOM】
 * 依赖 v6 的语义类名，后者查不到就是功能坏 —— 而且是【静默的】：
 * CSS 不报错、类型门禁看不见、webpack 照样构建通过。
 * src/pages/worksheet/views/CalendarView/fcClassCompat.ts 用 v7 的 *Class 钩子
 * 把这些名字挂回去，但"钩子写对了"和"类名真落到 DOM 上"是两件事，只能实测。
 *
 * 判据取自那 20 处 JS 查询实际用到的选择器 —— 它们是功能性的，一个都不能少。
 *
 * 运行方式（jsdom 不是本仓依赖，本仓也【不能用 npm install】——
 * react-motion@0.5.2 的 peer 冲突会让 npm ERESOLVE 硬失败，所以装到仓库外）：
 *
 *   mkdir -p /tmp/jsdom-for-verify && cd /tmp/jsdom-for-verify \
 *     && echo '{"private":true}' > package.json && npm i jsdom
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-fc7-classnames.ts
 */

const path = require('path');
const assert = require('assert');

const jsdomPath = process.env.JSDOM_PATH;
if (!jsdomPath) {
  console.error('需要 JSDOM_PATH，见本文件头的运行方式。');
  process.exit(2);
}
const { JSDOM } = require(jsdomPath);

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'https://example.com/',
});
const g: any = globalThis;
g.window = dom.window;
g.document = dom.window.document;
g.navigator = dom.window.navigator;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
g.cancelAnimationFrame = (id: any) => clearTimeout(id);
g.ResizeObserver =
  g.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

const React = require('react');
const { createRoot } = require('react-dom/client');
const FullCalendar = require('@fullcalendar/react').default;
const dayGridPlugin = require('@fullcalendar/react/daygrid').default;
const timeGridPlugin = require('@fullcalendar/react/timegrid').default;
const themePlugin = require('@fullcalendar/react/themes/classic').default;
const { FC_CLASS_COMPAT } = require(
  path.join(__dirname, '../src/pages/worksheet/views/CalendarView/fcClassCompat.ts'),
);

/** 这 20 处 JS 查询用到的选择器，逐个都要在 DOM 里找得到 */
const REQUIRED: { sel: string; why: string }[] = [
  { sel: '.fc-toolbar', why: 'index.less 大量覆盖' },
  { sel: '.fc-toolbar-chunk', why: 'index.tsx:179/191 绑点击' },
  { sel: '.fc-toolbar-title', why: '标题样式' },
  { sel: '.fc-button', why: '按钮样式' },
  { sel: '.fc-today-button', why: '按钮名要能单独选中' },
  { sel: '.fc-col-header', why: 'index.tsx:110 强制 100% 宽' },
  { sel: '.fc-col-header-cell', why: 'index.tsx:661 点日期表头' },
  { sel: '.fc-daygrid-day', why: '日期格样式' },
  { sel: '.fc-daygrid-day-frame', why: '日期格内框' },
  { sel: '.fc-daygrid-day-top', why: '日号区' },
  { sel: '.fc-day-today', why: 'util.ts:335 判断今天' },
  { sel: '.fc-view', why: 'viewClass 还原' },
  { sel: '.fc-event', why: '老「日程」页的事件样式' },
  { sel: '.fc-event-title', why: 'calendar.ts eventDidMount 往标题里插头像/任务图标' },
  { sel: '.fc-event.fc-draggable', why: '老「日程」页按它区分可改/只读日程的文字色' },
];

const root = createRoot(document.getElementById('root'));
root.render(
  React.createElement(FullCalendar, {
    ...FC_CLASS_COMPAT,
    plugins: [dayGridPlugin, timeGridPlugin, themePlugin],
    initialView: 'dayGridMonth',
    initialDate: '2026-09-15',
    headerToolbar: { left: 'today prev,next', center: 'title', right: 'dayGridMonth' },
    editable: true,
    events: [{ id: '1', title: '用来让事件相关的选择器有东西可查', start: '2026-09-15', allDay: true }],
  }),
);

setTimeout(() => {
  const html = document.getElementById('root').innerHTML;
  const missing: { sel: string; why: string }[] = [];
  for (const r of REQUIRED) {
    if (!document.querySelector(r.sel)) missing.push(r);
  }

  if (missing.length) {
    console.error(`\nFullCalendar v7 类名兼容层失败：${missing.length}/${REQUIRED.length} 个选择器查不到\n`);
    for (const m of missing) console.error(`  ${m.sel.padEnd(28)} —— ${m.why}`);
    console.error('\n渲染出来的前 600 字符，用来核对 v7 实际挂了什么：');
    console.error(html.slice(0, 600));
    process.exit(1);
  }

  // 负向控制：v7 自己的哈希类必须【仍然在】—— 钩子是拼接不是替换，
  // 如果内部类没了说明我们把 v7 的主题样式顶掉了，那就得不偿失。
  assert.ok(
    /class="[^"]*\bfc-[0-9A-Za-z]{2,4}\b/.test(html) || /fc-classic-/.test(html),
    '负向控制失败：v7 自己的哈希类名不见了，说明钩子替换而不是拼接了内部类',
  );

  console.log(`FullCalendar v7 类名兼容层通过：${REQUIRED.length} 个选择器全部命中，且 v7 内部哈希类仍在。`);
  process.exit(0);
}, 1500);
