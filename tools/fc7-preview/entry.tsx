/**
 * FullCalendar v7 的独立预览页 —— 迁移老「日程」页时用来【看见】渲染结果。
 *
 * 【为什么需要它】src/pages/calendar 那份是 vendor 进来的 FullCalendar 2.1.0，
 * 配套的 fullcalendar.less 有 798 行，针对的是 v2 的【表格式 DOM】。
 * v7 是 flex/grid 结构，光把类名挂回去不够 —— 布局本身变了，CSS 必须重写。
 * 而重写布局 CSS 不能靠读代码，得看渲染结果。
 *
 * 【为什么不用 dev server 指向生产 API】那会让本地服务对着全公司在用的 OA 发请求，
 * 还要处理跨域的登录态。布局验证不需要真数据，假事件足够。
 *
 * 用法：
 *   node tools/fc7-preview/build.ts     # 产出 tools/fc7-preview/dist/
 *   然后用浏览器打开 tools/fc7-preview/dist/index.html
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';
import interactionPlugin from '@fullcalendar/react/interaction';
import themePlugin from '@fullcalendar/react/themes/classic';
// 【locale 要显式注册】只写 locale="zh-cn" 的话日期名会是中文（那是 Intl 给的），
// 但库自身的文案（All-day / +N more / 今天等按钮兜底）仍是英文。
import zhCnLocale from '@fullcalendar/react/locales/zh-cn';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';

import { FC_CLASS_COMPAT } from '../../src/pages/worksheet/views/CalendarView/fcClassCompat';

/** 假事件：覆盖老页面要处理的几种形态 */
const EVENTS = [
  { id: '1', title: '全天：项目评审', start: '2026-09-15', allDay: true },
  { id: '2', title: '跨天：出差', start: '2026-09-16', end: '2026-09-18', allDay: true },
  { id: '3', title: '09:30 晨会', start: '2026-09-15T09:30:00', end: '2026-09-15T10:00:00' },
  { id: '4', title: '14:00 客户沟通（较长标题用来看截断）', start: '2026-09-15T14:00:00', end: '2026-09-15T16:30:00' },
  { id: '5', title: '重叠 A', start: '2026-09-15T15:00:00', end: '2026-09-15T17:00:00' },
  { id: '6', title: '重叠 B', start: '2026-09-15T15:30:00', end: '2026-09-15T16:00:00' },
  // 同一天塞多条，用来看 "+N 更多" 和弹层
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `m${i}`,
    title: `月视图溢出 ${i + 1}`,
    start: '2026-09-17',
    allDay: true,
  })),
];

function Preview() {
  const [view, setView] = React.useState('timeGridDay');
  return (
    <div style={{ padding: 16, height: '100vh', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 8, fontFamily: 'system-ui', fontSize: 13, color: '#666' }}>
        当前视图：<b>{view}</b> —— 老页面的四个视图分别对应
        timeGridDay（日）/ timeGridWeek（周）/ dayGridMonth（月）/ listMonth（列表）
      </div>
      <div style={{ height: 'calc(100% - 30px)' }} id="fcPreviewHost">
        <FullCalendar
          {...FC_CLASS_COMPAT}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, themePlugin]}
          initialView="timeGridDay"
          initialDate="2026-09-15"
          locales={[zhCnLocale]}
          locale="zh-cn"
          height="100%"
          headerToolbar={{
            left: 'today prev,next title',
            center: 'timeGridDay,timeGridWeek,dayGridMonth,listMonth',
            right: '',
          }}
          buttons={{
            today: { text: '今天' },
            timeGridDay: { text: '日' },
            timeGridWeek: { text: '周' },
            dayGridMonth: { text: '月' },
            listMonth: { text: '列表' },
          }}
          // v7 内置，替掉老页面手工往 .fc-time-grid 塞 .rect 的那段
          nowIndicator={true}
          slotDuration="00:30:00"
          scrollTime="08:00:00"
          selectable={true}
          selectMirror={true}
          editable={true}
          dayMaxEventRows={3}
          moreLinkClick="popover"
          events={EVENTS}
          datesSet={info => setView(info.view.type)}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
