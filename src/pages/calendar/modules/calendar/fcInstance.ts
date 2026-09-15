/**
 * 老「日程」页的 FullCalendar v7 实例层：把 v2 的 jQuery 插件式用法收在这里。
 *
 * 【背景】这个页面原来用的是 vendor 进仓的 FullCalendar **2.1.0**
 *（src/pages/calendar/modules/calendarControl/，49 个文件），用法是
 * `$('#calendar').fullCalendar({...})` 和 `$('#calendar').fullCalendar('refetchEvents')`。
 * v7 是 `new Calendar(el, options)` + 实例方法。两代之间隔着选项名、视图名、
 * 回调签名、日期类型四层差异，散在 calendar.ts 的 79 个触点里。
 * 全部摊开改风险太大，所以把阻抗收在这个模块，calendar.ts 只调这里的函数。
 *
 * 【v2 -> v7 的对照，逐条都是实测或查类型定义确认的】
 *   视图名   agendaDay/agendaWeek/month  ->  timeGridDay/timeGridWeek/dayGridMonth
 *   header                    -> headerToolbar
 *   defaultDate / defaultView -> initialDate / initialView
 *   slotMinutes               -> slotDuration（'00:30:00'）
 *   axisFormat                -> slotHeaderFormat
 *   columnFormat              -> dayHeaderFormat
 *   titleFormat（按视图给）   -> views: { <视图名>: { titleFormat } }
 *   eventLimit                -> dayMaxEventRows
 *   eventLimitClick           -> moreLinkClick
 *   selectHelper              -> selectMirror
 *   timezone                  -> timeZone
 *   events: {url, data}       -> events: (info, success, failure) => …
 *   eventAfterRender(e, el)   -> eventDidMount(info)   info.event / info.el
 *   eventMouseover/out        -> eventMouseEnter/Leave
 *   dayClick(date)            -> dateClick(info)       info.date / info.allDay
 *   select(start, end)        -> select(info)          info.start / info.end / info.allDay
 *   eventDrop(e, delta, revert, …) -> eventDrop(info)  info.event / info.delta / info.revert
 *
 * 【四个必须知道的行为差异】
 * 1. **日期类型变了**：v2 的回调收 moment 对象，v7 收原生 Date。
 *    老代码里 `date.format().length <= 10` 是拿"格式化后没有时间部分"当【全天判定】，
 *    这在 v7 下永远为假 —— v7 直接给 `info.allDay`，必须改用它，不能靠包一层 moment 蒙混。
 * 2. **不再需要手画当前时间线**：`nowIndicator: true` 就是那条红线。
 *    老页面在 util 里往 .fc-time-grid 塞 .rect div 并自己算位置，整段删掉。
 * 3. **"列表"视图是内置的**：老页面的列表是假的（destroy 掉日历、显示 #calendarList、
 *    单独发 getCalendarList2、套 tpl/list.html）。v7 有 listMonth。
 * 4. **locale 必须显式注册**：只设 locale 字符串的话日期名是中文（Intl 给的），
 *    但库自身文案（"All-day"、"+N more"）仍是英文。要 import locale 文件并传 locales。
 *
 * 类名兼容层复用 worksheet 那份（FC_CLASS_COMPAT）：v7 把内部类名全哈希化了，
 * 而这个页面的 fullcalendar.less 和若干 JS 查询都按语义类名写的。
 */

// 【为什么这里也走 @fullcalendar/react 而不是 vanilla 的 fullcalendar 包】
// 两个包各自带一份【结构相同但名义不同】的类型（各自的 chunk 模块），同一个程序里
// 混用会报出这种没法调和的错：
//   Type 'fullcalendar/chunks/996d27e3.aa' is not assignable to
//   type '@fullcalendar/react/chunks/bb8fd4ea.L'
//     Types of property 'datesSet' are incompatible … view.calendar.setOption 不兼容
// 而且 bundle 里会出现两份库。这个页面本身就是 React 组件（CalendarEntrypoint），
// 挂一个 React root 进 #calendar 即可，全仓只保留一个 FullCalendar。
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';
import interactionPlugin from '@fullcalendar/react/interaction';
import themePlugin from '@fullcalendar/react/themes/classic';
import zhCnLocale from '@fullcalendar/react/locales/zh-cn';
import zhTwLocale from '@fullcalendar/react/locales/zh-tw';
import jaLocale from '@fullcalendar/react/locales/ja';
import thLocale from '@fullcalendar/react/locales/th';
import msLocale from '@fullcalendar/react/locales/ms';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import { FC_CLASS_COMPAT } from 'src/pages/worksheet/views/CalendarView/fcClassCompat';

/** 老代码里到处在用的三个视图名，与 v7 的对应关系 */
export const VIEW_V2_TO_V7: Record<string, string> = {
  agendaDay: 'timeGridDay',
  agendaWeek: 'timeGridWeek',
  month: 'dayGridMonth',
  // 老页面的"列表"是自己拼的，迁移后用 v7 内置的 listMonth
  list: 'listMonth',
};

export const VIEW_V7_TO_V2: Record<string, string> = Object.entries(VIEW_V2_TO_V7).reduce(
  (acc, [v2, v7]) => {
    acc[v7] = v2;
    return acc;
  },
  {} as Record<string, string>,
);

/**
 * localStorage 里存的 lastView 是 v2 的名字（agendaDay / agendaWeek / month / list），
 * 老用户的浏览器里已经存了。【不能直接当 v7 视图名用】，也不该迁移时清掉 ——
 * 清掉等于所有人的视图偏好被重置。统一在这里翻译。
 */
export function toV7View(name: string | null | undefined): string {
  if (!name) return 'timeGridDay';
  return VIEW_V2_TO_V7[name] || (VIEW_V7_TO_V2[name] ? name : 'timeGridDay');
}

/** 反向：把 v7 视图名翻回 v2 的名字，写回 localStorage 用，保持与旧版本互相兼容 */
export function toV2View(name: string | null | undefined): string {
  if (!name) return 'agendaDay';
  return VIEW_V7_TO_V2[name] || (VIEW_V2_TO_V7[name] ? name : 'agendaDay');
}

/** FullCalendar 的命令式 API（component ref 的 getApi()），老代码按它驱动日历 */
type CalendarApi = ReturnType<NonNullable<React.ComponentRef<typeof FullCalendar>>['getApi']>;

let root: Root | null = null;
let api: CalendarApi | null = null;

/** 拿当前实例；没建过返回 null（老代码里有「有没有日历」的分支） */
export function getCalendar(): CalendarApi | null {
  return api;
}

/** 当前视图名，返回【v2 的名字】，这样 calendar.ts 里原有的比较不用改 */
export function getViewName(): string {
  return api ? toV2View(api.view.type) : '';
}

export function createCalendarInstance(el: HTMLElement, options: Record<string, any>): void {
  destroyCalendar();
  const ref = React.createRef<any>();
  root = createRoot(el);
  root.render(
    React.createElement(FullCalendar, {
      ref,
      ...FC_CLASS_COMPAT,
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, themePlugin],
      // 五种语言与老页面 index.tsx 里按 i18n_langtag 动态 import 的那批一一对应。
      // v7 的 locale 文件很小，一次性全注册比动态 import 简单，也避免时序问题 ——
      // 而且 locale 【必须显式注册】：只设 locale 字符串的话日期名是中文（Intl 给的），
      // 库自身文案（"All-day"、"+N more"）仍是英文。
      locales: [zhCnLocale, zhTwLocale, jaLocale, thLocale, msLocale],
      ...options,
    }),
  );
  // React 19 的 root.render 是同步提交的，ref 在这之后就已经填好
  api = ref.current ? ref.current.getApi() : null;
}

export function destroyCalendar(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  api = null;
}

/** 下面几个是 calendar.ts 里 `$('#calendar').fullCalendar('xxx')` 的等价物 */
export function refetchEvents(): void {
  api?.refetchEvents();
}

export function changeView(v2OrV7Name: string): void {
  api?.changeView(toV7View(v2OrV7Name));
}

export function getDate(): Date | null {
  return api ? api.getDate() : null;
}

/**
 * v2 有 `fullCalendar('render')`，用来在容器尺寸变化后重新测量布局。
 * 【v7 里没有等价物，也不需要】—— v7 的 CalendarApi 上根本没有 render/updateSize，
 * 它自己响应容器尺寸。保留这个空函数只是为了让 calendar.ts 的调用点读起来仍然成立；
 * 哪天确认所有调用点都可以去掉，这个函数和调用点一起删。
 */
export function renderCalendar(): void {
  // 有意为空，理由见上
}
