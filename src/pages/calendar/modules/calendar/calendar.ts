import type {
  DateClickInfo,
  DateSelectInfo,
  DatesSetInfo,
  EventClickInfo,
  EventDisplayInfo,
  EventDropInfo,
  EventHoveringInfo,
  EventInput,
  EventResizeDoneInfo,
  EventSourceFuncInfo,
  MountInfo,
} from '@fullcalendar/react';
import moment from 'moment';
import calendarAjax from 'src/api/calendar';
import createCalendar from 'src/components/createCalendar/load';
import calendarEdit from '../calendarDetail';
import afterRefreshOp from '../calendarDetail/lib/afterRefreshOp';
import recurCalendarUpdate from '../calendarDetail/lib/recurCalendarUpdateDialog';
import Comm from '../comm/comm';
import { toTimeDelta } from './delta';
import {
  createCalendarInstance,
  destroyCalendar,
  changeView as fcChangeView,
  getDate as fcGetDate,
  getViewName as fcGetViewName,
  refetchEvents as fcRefetchEvents,
  renderCalendar as fcRender,
  getCalendar,
  toV2View,
  toV7View,
} from './fcInstance';
import listHtml from './tpl/list.html';
import './calendar.less';

/**
 * v7 的事件对象是 EventApi，自定义字段收在 extendedProps 里；
 * 老回调体是直接 `event.isTask` / `event.head` 这样读的。把形状摊平回去，
 * 这样回调体不用逐行改，改动集中在签名上。
 */
function v2Event(e: any): FcEvent {
  return { ...(e.extendedProps || {}), id: e.id, title: e.title, start: e.start, end: e.end };
}

/** fullcalendar v3 的事件对象 */
interface FcEvent {
  id?: string;
  title?: string;
  start?: any;
  end?: any;
  [key: string]: any;
}

/** v3 回调里的 element 是 jQuery 包装对象；本仓没装 @types/jquery，写出用到的那几个方法 */
interface JQueryLike {
  find(selector: string): JQueryLike;
  addClass(cls: string): JQueryLike;
  removeClass(cls: string): JQueryLike;
  attr(...args: any[]): any;
  [key: string]: any;
}

/**
 * 「先建空对象、再一条条往上挂」的老写法，TS 只能推出 {}，
 * 于是每一处 Calendar.xxx 都报属性不存在（单这一条 95 处）。
 * 挂上去的几块各自形状差别很大，用索引签名兜住。
 */
interface CalendarModule {
  Comm: any;
  Event: any;
  Export: any;
  Method: any;
  settings: Record<string, any>;
  [key: string]: any;
}

// 紧接着下面就把各块挂上了，断言不是空头支票
var Calendar = {} as CalendarModule;

Calendar.Comm = Comm;

var CurrentDate;

const eventLimitNum = () => {
  const height = $(window).height();

  if (height >= 940) {
    return 5;
  } else if (height >= 810) {
    return 4;
  } else if (height >= 680) {
    return 3;
  } else if (height >= 550) {
    return 2;
  }

  return 1;
};

Calendar.settings = {
  isRange: 0, // 记录点击次数
  isRangeTime: [], // 记录点击事件
  isRangeTimeOut: null,
  lastDate: new Date(), // 上次选择的日期
  lastDateKey: 0, // 上次选择日期的时间戳，双击判定用（v2 比的是 moment.toString()）
  selectedTime: {
    Start: null,
    End: null,
  },
  isFirstData: null,
  lastTime: null,
  isAllDay: null,
  isResize: false,
  recurTime: null, // 复发时间
};

Calendar.Method = {
  loadFullCalendar: function (parameter: Record<string, any>) {
    createCalendarInstance(document.getElementById('calendar'), {
      headerToolbar: {
        left: 'today prev,next title',
        center: '',
        // v2 的 agendaDay/agendaWeek/month 改成 v7 的名字；"列表"不再靠往工具栏
        // 注入一个假按钮再 destroy 掉日历，直接用 v7 内置的 listMonth 视图。
        // 放 right 而不是 center：v7 的工具栏是 space-between 的三块，放 center
        // 时这组按钮会停在偏左的位置，右边空一大片（1440 宽下右侧空约 360px）。
        right: 'timeGridDay,timeGridWeek,dayGridMonth,listMonth',
      },
      // v7：buttonText 被移除，改成 buttons 映射的 .text，且 key 必须是精确视图名
      buttons: {
        today: { text: _l('今天') },
        timeGridDay: { text: _l('日') },
        timeGridWeek: { text: _l('周') },
        dayGridMonth: { text: _l('月') },
        listMonth: { text: _l('列表') },
      },
      timeZone: 'local',
      locale: getCookie('i18n_langtag') || window.getDefaultLangKey(),
      initialDate: parameter.date,
      firstDay: 0, // 第一列显示周几  0：周日
      initialView: toV7View(parameter.currentView),
      slotDuration: '00:30:00',
      scrollTime: parameter.scrollTime,
      // 【删掉了 height 与 handleWindowResize 两个选项】两者都是死配置，删掉与现状等价：
      //
      // height 原来写的是
      //   $(window).height() - $('.fc-day-grid').height() - $('#topBarContainer').height() - 15
      // 但 .fc-day-grid 在【构造日历的这一刻还没渲染出来】，jQuery 取不到元素，
      // .height() 返回 undefined，整个表达式恒为 NaN。浏览器丢弃非法的 inline height，
      // 所以 FullCalendar 一直在用它自己的默认高度 —— 这行从来没生效过
      //（迁移前后逐字相同，不是 v7 引入的）。留着只会每次渲染刷一条
      //   `NaN` is an invalid value for the `height` css style property
      //
      // handleWindowResize 是 v2/v3 的选项，v7 已移除；传进去只会得到
      //   FullCalendar: Unknown option `handleWindowResize`
      // v7 自己用 ResizeObserver 处理尺寸变化，没有关掉它的开关。
      selectable: true,
      selectMirror: true,
      editable: true,
      dayMaxEventRows: eventLimitNum(),
      moreLinkClick: 'popover',
      // v7 内置的当前时间红线 —— 取代原来往 .fc-time-grid 手工塞 .rect div 的那段
      nowIndicator: true,
      // v2 的 axisFormat
      slotHeaderFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      // v2 的 timeFormat
      eventTimeFormat: { hour: 'numeric', minute: '2-digit', hour12: false },
      // v2 的 titleFormat / columnFormat 是「一个对象里按视图分」，v7 要拆进 views
      views: {
        dayGridMonth: { titleFormat: { year: 'numeric', month: 'long' }, dayHeaderFormat: { weekday: 'short' } },
        timeGridWeek: {
          titleFormat: { year: 'numeric', month: 'long', day: 'numeric' },
          dayHeaderFormat: { day: '2-digit', weekday: 'short' },
        },
        timeGridDay: {
          titleFormat: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
        },
      },
      // v2 是 events: { url, data }，由库自己发请求并按 startParam/endParam 传时间范围。
      // v7 用函数式事件源：范围由 info.start / info.end 给出，我们自己发请求。
      events: function (
        info: EventSourceFuncInfo,
        success: (events: EventInput[]) => void,
        failure: (err: Error) => void,
      ) {
        calendarAjax
          .getCalendars({
            startDate: moment(info.start).format('YYYY-MM-DD HH:mm:ss'),
            endDate: moment(info.end).format('YYYY-MM-DD HH:mm:ss'),
            isWorkCalendar: Calendar.Comm.settings.isWorkCalendar,
            isTaskCalendar: Calendar.Comm.settings.isTaskCalendar,
            filterTaskType: Calendar.Comm.settings.filterTaskType,
            categoryIDs: Calendar.Method.getCategoryIDsFun(),
            memberIDs: Calendar.Comm.settings.otherUsers.join(','),
          })
          .then((res: { data?: { calendars?: EventInput[] } } | EventInput[]) => {
            // 【接口返回的是信封，不是数组】2026-09-16 在生产上抓到的原始响应：
            //   {"data":{"code":1,"msg":"操作成功","data":{"restCalCount":0,"calendars":[]}},"state":1}
            // mdyAPI 会剥掉最外层，所以这里拿到的是 { code, msg, data: { restCalCount, calendars } }。
            // 【这里曾经直接 (list || []).map(...)】—— 对着一个对象调 map，
            // 事件源当场抛 "(list || []).map is not a function"，FullCalendar 把整个
            // 事件源标记为失败，于是【日程页一条事件都渲染不出来】。
            // 页面本身照常显示（网格、视图切换都在），所以只看界面看不出坏了。
            // 兼容数组是为了以后接口万一改回来也不会再炸一次。
            const list: (EventInput & { isTask?: boolean })[] = Array.isArray(res)
              ? res
              : (res && res.data && res.data.calendars) || [];

            success(
              // 任务不允许拉伸时长。v2 是渲染完把 .fc-resizer 这个 DOM 删掉，
              // v7 有正经的逐事件开关，在数据侧标注更稳，也不依赖库的 DOM 结构。
              list.map(e => (e.isTask ? { ...e, durationEditable: false } : e)),
            );
          })
          .catch(failure);
      },
      eventClick: function (info: EventClickInfo) {
        // v7：事件对象是 EventApi，自定义字段在 extendedProps 里；jsEvent 在 info 上
        const events = v2Event(info.event);
        const jsEvent = info.jsEvent;

        // 点击 日程时 事件
        if (events.isTask) {
          $('.calendarEdit,.showActiveTitleMessage').remove();
          $('#calendar').trigger('openTask', events.eventID);
        } else {
          Calendar.settings.recurTime = events.recurTime;

          // 成员，日程未锁定 双击时会先进dayclick事件、进行数据重置处理
          Calendar.settings.isRange = 0;
          clearTimeout(Calendar.settings.isRangeTimeOut);

          if (!events.canLook) {
            alert(_l('该日程为他人的私密日程，无法查看'), 3);
            return;
          }

          var pageX = jsEvent.clientX;
          var gapRight = $(window).width() - pageX; // 离右边距离
          var calhoverWidth = 360;

          if (gapRight < calhoverWidth) {
            pageX = pageX - calhoverWidth;
          }

          calendarEdit({
            calendarId: events.id,
            recurTime: events.recurTime ? moment(events.recurTime).toISOString() : '',
            saveCallback: function () {
              Calendar.Method.rememberClick();
            },
          });

          $('.hoverContentColor').removeClass('hoverContentColor');
          // v2 的回调里 this 是事件元素；v7 给的是 info.el
          $(info.el).addClass('hoverContentColor');
        }
      },
      // v2 的 eventAfterRender
      eventDidMount: function (info: MountInfo<EventDisplayInfo>) {
        const event = v2Event(info.event);
        // 事件呈现后触发,可用来做头像显示。类名用 v6 那套（兼容层挂的就是这套）
        var $fcTitle = $(info.el).find('.fc-event-title');
        if (!event.isTask) {
          if (
            Calendar.Comm.settings.otherUsers.length > 1 ||
            (Calendar.Comm.settings.otherUsers.length == 1 &&
              Calendar.Comm.settings.otherUsers[0] != md.global.Account.accountId)
          ) {
            $fcTitle.prepend(
              '<img src="' +
                event.head +
                '" style="width:14px;margin-top: 1px; height:14px;margin-bottom:-2px;padding-right: 3px;"/>',
            );
          }
        } else {
          $fcTitle.prepend(
            '<span class="icon-calendartask" data-endtime="' +
              // v2 给的是 moment，这里读的是它的内部字段 _i；v7 给原生 Date，直接格式化
              moment(event.end).format('HH:mm') +
              '" style="width:14px;display: inline-block;height:14px;margin: 1px 3px -2px 0;font-size: var(--font-lg);vertical-align: top;"> </span>',
          );
          // 任务不允许拉伸：v2 是把 .fc-resizer 这个 DOM 删掉，v7 有正经开关，
          // 在事件源里给任务加 durationEditable: false（见上面的 events 函数）。
        }
      },
      // 视图/日期范围变化后触发。取代了原来挂在头部按钮上的那段点击劫持：
      // 记住当前视图（仍按 v2 的名字写回 localStorage，与旧版本互相兼容），
      // 再做一次视图相关的样式调整。
      datesSet: function (info: DatesSetInfo) {
        safeLocalStorageSetItem('lastView', toV2View(info.view.type));
        Calendar.Method.editViewStyle();
      },
      loading: function (isLoading: boolean) {
        if (isLoading) {
          $('#calendarLoading').show();
          $('#calInvite').removeClass('bgColorPrimary');
          $('#calendar').css('visibility', 'hidden');
        } else {
          $('#calendarLoading').hide();
          $('#calendar').css('visibility', 'visible');
          // 样式调整
          Calendar.Method.editViewStyle();
        }
      },
      select: function (info: DateSelectInfo) {
        // 【多选判定改成算时间跨度，不再嗅探 DOM】
        // v2 靠 $('.fc-highlight').attr('colspan') 猜是不是多选，那是拿库的内部 DOM 当 API。
        // v7 直接给了 allDay 和 start/end，按跨度算既更准也不会随库的 DOM 变化而失效。
        const start = info.start;
        const end = info.end;
        const isAllDay = !!info.allDay;

        Calendar.settings.selectedTime.Start = moment(start).format();
        Calendar.settings.selectedTime.End = moment(end).format();
        var settings = {
          Start: Calendar.settings.selectedTime.Start,
          End: Calendar.settings.selectedTime.End,
          AllDay: '',
        };

        var rangeSeconds = (moment(end).valueOf() - moment(start).valueOf()) / 1000;
        // 全天行：跨度超过一天才算多选（单格选中正好是 1 天）
        var multiSelectDay = isAllDay && rangeSeconds > 24 * 60 * 60;
        // 时间网格：跨度超过一格（30 分钟）才算多选
        var multiSelect = isAllDay ? multiSelectDay : rangeSeconds > 30 * 60;

        if (multiSelectDay) {
          // 全天事件多选 日期处理：结束日期是排他的，回退一天给业务用
          settings.End = moment(settings.End).add(-1, 'day').format();
          settings.AllDay = true;
        }

        if (multiSelect) {
          // 多选创建日程
          createCalendar(settings);
        }
      },
      // v2 的 eventMouseover / eventMouseout
      eventMouseEnter: function (info: EventHoveringInfo) {
        Calendar.Method.changeEventColor(v2Event(info.event), info.jsEvent, 0);
      },
      eventMouseLeave: function (info: EventHoveringInfo) {
        Calendar.Method.changeEventColor(v2Event(info.event), info.jsEvent, 1);
      },
      eventDrop: function (info: EventDropInfo) {
        Calendar.settings.isResize = false;
        Calendar.Method.dropResize(v2Event(info.event), info.delta, info.revert, info.jsEvent, null, info.view);
      },
      eventResize: function (info: EventResizeDoneInfo) {
        Calendar.settings.isResize = true;
        // 【v7 的 EventResizeDoneInfo 没有 delta】只有 startDelta / endDelta。
        // 拉伸改的是结束时间，所以取 endDelta；从顶部拉时 startDelta 非零，一并算进去。
        Calendar.Method.dropResize(
          v2Event(info.event),
          info.endDelta || info.startDelta,
          info.revert,
          info.jsEvent,
          null,
          info.view,
        );
      },
      // v2 的 dayClick
      dateClick: function (info: DateClickInfo) {
        // 【全天判定改用 info.allDay】v2 靠 `date.format().length <= 10`——
        // 即"格式化后没有时间部分"——来判全天。v7 给的是原生 Date，
        // moment(date).format() 永远带时间，那个判据【恒为假】，必须换成 info.allDay。
        const date = moment(info.date);
        const isAllDay = !!info.allDay;
        const dateKey = date.valueOf();

        // 操作方法
        var calendarClickFun = function () {
          if (Calendar.settings.isRange >= 2) {
            // 双击
            clearTimeout(Calendar.settings.isRangeTimeOut);
            if (Calendar.settings.isRangeTime[1] - Calendar.settings.isRangeTime[0] < 300) {
              var settings = {
                Start: '',
                End: '',
                AllDay: '',
              };
              if (isAllDay) {
                // 全天事件
                if (date.format('YYYY-MM-DD') !== moment(new Date()).format('YYYY-MM-DD')) {
                  // 非当天
                  settings.Start = date.clone().set('hour', 10).format('YYYY-MM-DD HH:mm:ss');
                  settings.End = date.clone().set('hour', 11).format('YYYY-MM-DD HH:mm:ss');
                  settings.AllDay = true;
                }
              } else {
                // 非全天事件
                settings.Start = date.format();
                settings.End = date.clone().add(30, 'm').format();
              }

              createCalendar(settings);
            }

            Calendar.settings.lastDate = '';
            Calendar.settings.isRangeTime = [];
            Calendar.settings.isRange = 0;
          } else if (Calendar.settings.isRange == 1) {
            // 单击
            Calendar.settings.isFirstData = info.date;
            Calendar.settings.isRangeTimeOut = setTimeout(function () {
              Calendar.settings.lastDate = '';
              Calendar.settings.isRangeTime = [];
              Calendar.settings.isRange = 0;
            }, 300);
          }
        };

        // 双击判定：v2 比的是 moment 的 toString()，这里用时间戳，等价且不依赖格式
        if (dateKey !== Calendar.settings.lastDateKey) {
          Calendar.settings.isRange = 0;
          Calendar.settings.isRangeTime = [];
          Calendar.settings.isRangeTime[0] = +new Date();
        } else {
          Calendar.settings.isRangeTime[1] = +new Date();
        }

        Calendar.settings.lastDateKey = dateKey;
        Calendar.settings.lastDate = info.date;
        Calendar.settings.isRange++;

        calendarClickFun(); // 操作方法
      },
    });

    // 【按钮劫持整段删除】v2 时代这里把 FullCalendar 自己的头部按钮 .off() 掉，
    // 再手工 changeView、手工加 fc-state-active。v7 里那些是真的视图按钮，
    // 点击原生切换视图，选中态由类名兼容层的 buttonClass 负责。
    // 需要跟着视图切换做的两件事（记住视图、调整样式）挪到了 datesSet 回调里。
    //
    // 【"列表"按钮的注入也一并删除】v2 时代这里往 .fc-center .fc-button-group 里
    // append 一个 .fc-list-button，再给它 bind('refreshList') 去调 calendarList()
    // 重新拉一遍数据 —— 因为那时的"列表"是假视图。v7 的 listMonth 是内置真视图，
    // 按钮由 headerToolbar 的 center 直接给出（见 loadFullCalendar 的配置）。
    //
    // 这段在 v7 下【已经完全不生效】：选择器 .fc-center 是 v2/v3 的工具栏类名，
    // v7 用的是 .fc-toolbar-chunk，$('.fc-center') 是空集合，按钮从来没被插进去过。
    // 留着只会让人以为列表按钮是这里来的。

    // 添加新建日程按钮
    var fcToolbar = $('.fc-toolbar');
    if (fcToolbar.children('.addNewCalendarBox').length == 0) {
      fcToolbar.prepend(
        '<div class="addNewCalendarBox bgColorPrimary hoverBgColorPrimaryDark" id="addNewCalendar"><i class="icon-plus"></i>' +
          _l('新日程') +
          '</div>',
      );
    }

    var $container = $('#container');
    var hoverTitleTimer;

    // 鼠标经过提示双击创建
    $container.on(
      {
        mousemove: function (event) {
          clearTimeout(hoverTitleTimer);
          $('.hoverTitleMessage,.showActiveTitleMessage').hide();
          if (
            Calendar.Method.detectLeftButton(event) ||
            $(event.target).hasClass('fc-axis') ||
            $(event.target).closest('.fc-axis').length
          ) {
            return;
          }

          var pointX = event.clientX;
          var pointY = event.clientY;

          hoverTitleTimer = setTimeout(function () {
            if (!$('.hoverTitleMessage').length) {
              $('body').append('<div class="hoverTitleMessage">' + _l('双击创建日程') + '</div>');
            }

            var $hoverTitleMessage = $('.hoverTitleMessage');
            if ($hoverTitleMessage.width() + pointX + 15 > $(window).width()) {
              pointX = pointX - $hoverTitleMessage.width() - 15;
            }

            $hoverTitleMessage.css({ left: pointX + 15, top: pointY + $(window).scrollTop() + 15 }).show();
          }, 250);
        },
        mouseleave: function () {
          clearTimeout(hoverTitleTimer);
          $('.hoverTitleMessage,.showActiveTitleMessage').hide();
        },
      },
      '.fc-view tbody:first',
    );

    // 鼠标经过title显示title内容
    $container.on('mousemove', '.showActiveTitle', function (this: HTMLElement, event) {
      var $this = $(this);
      var pointX = event.clientX;
      var pointY = event.clientY;
      clearTimeout(hoverTitleTimer);
      if (Calendar.Method.detectLeftButton(event)) {
        $('.hoverTitleMessage,.showActiveTitleMessage').hide();
        return;
      }

      $('.showActiveTitleMessage,.hoverTitleMessage').hide();
      hoverTitleTimer = setTimeout(function () {
        var title = $this.find('.fc-title').html();
        if (title) {
          if (!(
            title.indexOf(_l('全天')) > 0 ||
            (!$this.find('.fc-time').length && title.indexOf('icon-calendartask') < 0)
          )) {
            if (title.indexOf('icon-calendartask') > 0) {
              // 任务
              title = $this.find('.icon-calendartask').attr('data-endtime') + ' ' + title.split('</span>')[1];
            } else {
              // 非任务
              var fcTime = $this.find('.fc-time');
              var time = fcTime.attr('data-start') + ' - ' + fcTime.attr('data-end') + ' ';
              if (title.indexOf('</span>') > 0) {
                title = time + title.split('</span>')[1];
              } else {
                title = time + title;
              }
            }
          }

          if (!$('.showActiveTitleMessage').length) {
            $('body').append('<div class="showActiveTitleMessage">' + title + '</div>');
          }

          var $showActiveTitleMessage = $('.showActiveTitleMessage').html(title);
          if ($showActiveTitleMessage.width() + pointX + 15 > $(window).width()) {
            pointX = pointX - $showActiveTitleMessage.width() - 15;
          }

          $showActiveTitleMessage
            .css({
              left: pointX + 15,
              top: pointY + $(window).scrollTop() + 15,
            })
            .show();
          $('.hoverTitleMessage').hide();
        }
      }, 250);
      event.stopPropagation();
    });

    // 非全天日程经过加背景色
    $container.on(
      {
        mouseover: function () {
          $(this).css('background', $(this).attr('data-hoverBgColor').split(':')[1]);
        },
        mouseout: function () {
          $(this).css('background', 'none');
        },
      },
      '.notAllDayOver',
    );

    // 创建日程
    $('#addNewCalendar').on('click', function () {
      createCalendar();
    });

    $('.fc-button-group button').addClass('colorPrimary borderColorPrimary');
    $('.fc-prev-button,.fc-next-button,.fc-today-button').hover(
      function (this: HTMLElement) {
        $(this).addClass('bgColorPrimary');
      },
      function (this: HTMLElement) {
        $(this).removeClass('bgColorPrimary');
      },
    );
    $('.fc-today-button').on('click', function (this: HTMLElement) {
      $(this).removeClass('bgColorPrimary');
    });
  },

  // 日程初始化
  init: function () {
    var lastView = window.localStorage.getItem('lastView');
    var scrollTime = moment(CurrentDate.getTime() - 170 * 60 * 1000).format('HH:mm:ss'); // 时间轴居中差不多差170分钟
    var parameter = {
      date: CurrentDate,
      scrollTime: scrollTime,
    };

    if (Calendar.Comm.settings.date) {
      parameter.date = Calendar.Comm.settings.date;
      Calendar.Comm.settings.date = '';
    }

    if (Calendar.settings.lastTime) {
      parameter.date = Calendar.settings.lastTime;
    }

    if (lastView == 'list') {
      parameter.currentView = 'agendaDay';
      Calendar.Method.calendarList(
        moment().format('YYYY-MM-DD HH:mm:ss'),
        moment().add('2', 'months').format('YYYY-MM-01'),
        true,
      ); // 添加列表数据
      destroyCalendar();
      Calendar.Method.loadFullCalendar(parameter);

      $('#calendar').find('.fc-view-container,.fc-left').hide();
      $('#calendarList').css('display', 'block');
      // v2 时代靠给 view.name 赋值伪装成 list 视图；v7 有内置 listMonth，直接切过去
      fcChangeView('list');
    } else {
      if (['agendaDay', 'agendaWeek', 'month'].indexOf(lastView) == -1) {
        lastView = 'agendaDay';
        safeLocalStorageSetItem('lastView', 'agendaDay');
      }

      parameter.currentView = lastView;
      Calendar.Method.loadFullCalendar(parameter);
    }
  },

  // 视图样式调整
  editViewStyle: function () {
    if (/Safari/.test(navigator.userAgent) && window.localStorage.getItem('lastView') === 'month') {
      $('.fc-month-view').css('position', 'static');
    } else {
      $('.fc-month-view').css('position', 'relative');
    }

    var viewName = Calendar.Method.getViewName();

    if (viewName == 'agendaWeek') {
      $('.fc-state-highlight').css({
        background: 'var(--color-error-bg)',
        'border-top-width': '1px',
        'border-top-color': '#ff0',
      });
      $('.fewWeeks').remove();

      $('.fc-toolbar .fc-left h2').append(
        ' <span class="fewWeeks">' + _l('第%0周', moment(fcGetDate()).week()) + '</span>',
      );
    }

    if (viewName == 'agendaDay' || viewName == 'agendaWeek') {
      $('.fc-axis').css('width', '31px');

      // 如果是天 视图 时间轴
      // 只在当天出现
      var agendaActiveDay = moment(fcGetDate()).format('YYYY-MM-DD'); // 日视图当前时间
      var isToday = false;

      if (viewName == 'agendaDay') {
        if (agendaActiveDay == moment(CurrentDate).format('YYYY-MM-DD')) {
          isToday = true;
        }
      }

      if (viewName == 'agendaWeek') {
        $('.fc-day-header').each(function (this: HTMLElement) {
          if ($(this).css('border-bottom-color').indexOf('rgb(255, 153, 153)') >= 0) {
            isToday = true;
          }
        });

        isToday = true;
      }

      if ($('.fc-time-grid').find('.rect').length == 0 && isToday) {
        var data = CurrentDate;
        var time = data.getHours() + parseFloat((data.getMinutes() / 60).toFixed(2));
        var h = time * 40.5 - 3.5 + 'px';

        var div = '<div style="text-align:right;width: 100%;top:' + h + ';position: absolute;z-index: 8;left:54px;">';
        div += '<div class="rect"></div><div class="rectLine"></div>';
        div += '</div>';
        $('.fc-time-grid-container .fc-time-grid').append(div);
      }

      // 时间轴位置调整
      $('.fc-slats')
        .find('.fc-axis')
        .each(function (this: HTMLElement) {
          var timeVal = ($(this).text() || '').trim();
          if (timeVal != '') {
            var top = timeVal == '00:00' ? '-5px' : '-10px';
            $(this).html('<span style="position: relative;left: 0;top: ' + top + '">' + timeVal + '</span>');
          }
        });

      setTimeout(() => {
        $('.fc-time-grid-container.fc-scroller').scrollTop(
          (moment().hour() + 2) * 40 - $('.fc-time-grid-container.fc-scroller').height() / 2,
        );
      }, 100);
    }

    if (viewName == 'month') {
      $('.fcOld td.fc-today').css('border-style', 'solid');
      $('.fc-state-highlight').css({
        'border-top-width': '2px',
        'border-top-color': 'var(--color-calendar)',
      });
      $('.fc-row.fc-widget-header').css({
        'border-right-width': 0,
      });
    }

    // 【删掉的是手工维护"列表"按钮选中态】原来：viewName == 'list' 时给注入的
    // .fc-list-button 加 v2 的 .fc-state-active、并清掉兄弟节点的。
    // v7 里"列表"是内置视图按钮，选中态由类名兼容层的 buttonClass 按 info.isSelected
    // 输出 fc-button-active，不需要也不该手工维护。
    // （那个按钮本身也早就不存在了，见 loadFullCalendar 里删注入时的说明。）

    // 日周视图滚动条处理
    $('.fc-scroller').on('scroll', function (this: HTMLElement, event) {
      var height = $(this).height();
      var scrollTop = $(this)[0].scrollTop;
      var scrollHeight = $(this)[0].scrollHeight;

      if (height + scrollTop >= scrollHeight) {
        $(this).scrollTop(scrollHeight - height - 1);
        event.stopPropagation();
        return false;
      } else if (scrollTop <= 0) {
        $(this).scrollTop(1);
        event.stopPropagation();
        return false;
      }
    });
  },

  dropResize: function (event, delta, revertFunc /* , jsEvent, ui, view*/) {
    $('.showActiveTitleMessage,.hoverTitleMessage').hide();
    if (event.isTask) {
      alert(_l('任务不可更改'), 3);
      revertFunc();
      return;
    }

    if (event.hasMember) {
      // Calendar.Method.afterRefreshOp(event, delta, revertFunc);
      afterRefreshOp(function (...args) {
        Calendar.Method.ajaxAfterDrop(event, delta, revertFunc, args[0], args[1]);
      }, revertFunc);
    } else {
      Calendar.Method.ajaxAfterDrop(event, delta, revertFunc, false, false);
    }
  },

  /**
   * 编辑日程时间
   * @param  {Object} event  拖拽事件
   * @param  {Object} delta  变化时间
   * @param  {Function} reverFunc 还原日程位置
   * @param  {Boolean} reType 是否发送邀请
   * @param  {Boolean} directRun 非重复日发送邀请则无需继续弹框确认
   * @return {[type]}        [description]
   */
  ajaxAfterDrop: function (event, delta, revertFunc, reType, directRun) {
    var editCalendaTimeFun = function (isAllCalendar) {
      var calendarID = event.id;
      var recurTime = event.recurTime; // 复发时间
      var starDate = moment(event.start).format('YYYY-MM-DD HH:mm');
      var endDate = moment(event.end).format('YYYY-MM-DD HH:mm');
      var isAllDay = event.isAllDay;
      // 【不要写 delta._days / ._milliseconds】那是 moment.Duration 的内部字段，
      // FullCalendar v7 换成了自己的 { years, months, days, milliseconds }，见 ./delta.ts
      const { dayDelta, minuteDelta } = toTimeDelta(delta);

      if (isAllCalendar) {
        starDate = event.oldStartTime;
        endDate = event.oldEndTime;
      }

      if (isAllDay) {
        starDate = starDate.split(' ')[0];
        endDate = moment(event.end).day(-1).format('YYYY-MM-DD');
      }

      calendarAjax
        .editCalendarTime({
          calendarID: calendarID,
          start: moment(starDate).toISOString(),
          end: moment(endDate).toISOString(),
          dayDelta: dayDelta,
          minuteDelta: minuteDelta,
          isAll: isAllDay,
          isResize: Calendar.settings.isResize,
          reType: reType,
          recurTime: recurTime ? moment(recurTime).toISOString() : '',
          isAllCalendar: isAllCalendar,
        })
        .then(function (resource) {
          if (resource.code == 1) {
            alert(_l('操作成功'));
            Calendar.Method.rememberClick(); // 刷新日程
          } else {
            alert(_l('操作失败'), 3);
          }
        });
    };

    recurCalendarUpdate(
      {
        operatorTitle: _l('您确定更改日程信息吗?'),
        recurTitle: _l('您确定编辑重复日程吗?'),
        recurCalendarUpdateFun: editCalendaTimeFun,
      },
      { originRecur: event.isRecur, isChildCalendar: event.isChildCalendar },
      { directRun, callback: revertFunc },
    );
  },

  // 返回当前视图的名称
  getViewName: function () {
    return fcGetViewName();
  },

  getCategoryIDsFun: function () {
    var ctegoryIDs = '';
    if (Calendar.Comm.settings.categorys.length) {
      ctegoryIDs = Calendar.Comm.settings.categorys.join(',');
    } else if (window.localStorage.getItem('categorys') != '') {
      ctegoryIDs = 'All';
    }

    return ctegoryIDs;
  },

  // 经过颜色
  changeEventColorHover: function (rgbColor) {
    if (rgbColor) {
      if (rgbColor.indexOf('rgb(239, 154, 154)') >= 0) {
        // 红色
        return '#F44336';
      }

      if (rgbColor.indexOf('rgb(206, 147, 216)') >= 0) {
        // 紫色
        return '#9C27B0';
      }

      if (rgbColor.indexOf('rgb(188, 170, 164)') >= 0) {
        // 褐色
        return '#795548';
      }

      if (rgbColor.indexOf('rgb(255, 204, 128)') >= 0) {
        // 橙色
        return '#FF9800';
      }

      if (rgbColor.indexOf('rgb(144, 202, 249)') >= 0) {
        // 蓝色
        return '#1E88E5';
      }

      if (rgbColor.indexOf('rgb(165, 214, 167)') >= 0) {
        // 绿色
        return '#4CAF50';
      }

      if (rgbColor.indexOf('rgb(255, 245, 157)') >= 0) {
        // 黄色
        return '#FFEB3B';
      }

      if (rgbColor.indexOf('rgb(230, 230, 230)') >= 0) {
        // 灰色
        return '#DADADA';
      }
    }
  },

  // 离开颜色
  changeEventColorLeave: function (rgbColor) {
    if (rgbColor) {
      if (rgbColor.indexOf('rgb(244, 67, 54)') >= 0) {
        // 红色
        return '#EF9A9A';
      }

      if (rgbColor.indexOf('rgb(156, 39, 176)') >= 0) {
        // 紫色
        return '#CE93D8';
      }

      if (rgbColor.indexOf('rgb(121, 85, 72)') >= 0) {
        // 褐色
        return '#BCAAA4';
      }

      if (rgbColor.indexOf('rgb(255, 152, 0)') >= 0) {
        // 橙色
        return '#FFCC80';
      }

      if (rgbColor.indexOf('rgb(30, 136, 229)') >= 0) {
        // 蓝色
        return '#90CAF9';
      }

      if (rgbColor.indexOf('rgb(76, 175, 80)') >= 0) {
        // 绿色
        return '#A5D6A7';
      }

      if (rgbColor.indexOf('rgb(255, 235, 59)') >= 0) {
        // 黄色
        return '#FFF59D';
      }

      if (rgbColor.indexOf('rgb(218, 218, 218)') >= 0) {
        // 灰色
        return '#E6E6E6';
      }
    }
  },

  // 0 选中状态 1 离开状态
  changeEventColor: function (event, jsEvent, type) {
    if (jsEvent.currentTarget == document) return;
    if (!$(jsEvent.currentTarget).hasClass('notAllDayOver')) {
      var rgbColor = $(jsEvent.currentTarget).css('background-color');
      if (type == 0) {
        $(jsEvent.currentTarget)
          .css('background-color', Calendar.Method.changeEventColorHover(rgbColor))
          .addClass('hoverContentColor');
      } else {
        $(jsEvent.currentTarget)
          .css('background-color', Calendar.Method.changeEventColorLeave(rgbColor))
          .removeClass('hoverContentColor');
      }
    } else {
      if (type == 0) {
        $(jsEvent.currentTarget).addClass('hoverContentColor');
      } else {
        $(jsEvent.currentTarget).removeClass('hoverContentColor');
      }
    }
  },

  // 检测左键是否按下
  detectLeftButton: function (evt) {
    evt = evt || window.event;
    var button = evt.which || evt.button;

    // 处理ie 11经过的时候which是1的bug
    if (evt.type === 'mousemove') {
      button = 0;
    }

    return button == 1;
  },

  // 记住点击  周 天 月 列表
  rememberClick: function () {
    var $calendar = $('#calendar');
    if ($calendar.length > 0) {
      // 原来按视图名分四支：日/周/月都是 fcRefetchEvents()，只有"列表"因为是【假视图】
      //（destroy 掉日历、另发 getCalendarList2、套 tpl/list.html）才要去 trigger
      // 自定义的 refreshList 事件。v7 的 listMonth 是内置真视图，refetchEvents 一并刷新，
      // 四支合成一支。
      //
      // 而且那一支现在【本来就失效了】：refreshList 绑在 .fc-list-button 上，那个按钮
      // 是往 v2 的 .fc-center 里注入的，v7 的工具栏没有 .fc-center，按钮从来没被插进去，
      // trigger 落在空集合上静默无事 —— 结果是列表视图下这次刷新根本不发生。
      fcRefetchEvents();
    }
  },

  rememberClickRefresh: function () {
    $('#calendar').show();
    if (Calendar.Method.getViewName == 'list') {
      $('#calendarList').show();
    }

    $('#invitedMain').hide();

    Calendar.settings.lastTime = fcGetDate();
    destroyCalendar();
    Calendar.Method.init();
    fcRefetchEvents();
  },

  // 日程列表加载
  calendarList: function (startDate2, endDate2, isFirst, scrollTop) {
    calendarAjax
      .getCalendarList2({
        memberIDs: Calendar.Comm.settings.otherUsers.join(','),
        isPrivateCalendar: Calendar.Comm.settings.isPrivateCalendar,
        isTaskCalendar: Calendar.Comm.settings.isTaskCalendar,
        filterTaskType: Calendar.Comm.settings.filterTaskType,
        isWorkCalendar: Calendar.Comm.settings.isWorkCalendar,
        categoryIDs: Calendar.Method.getCategoryIDsFun(),
        startDate: startDate2,
        endDate: endDate2,
      })
      .then(function (resource) {
        if (resource.msg == '操作成功') {
          var data = resource.data;
          data.isFirst = isFirst;
          data.colorClass = Calendar.Method.colorClass;
          var queryend = moment(endDate2).add(1, 'M').format('YYYY-MM-DD');
          if (isFirst) {
            data.queryEnd = queryend;
            var nowDate = CurrentDate;
            data.dateTime = ' ' + _l('%0年%1月%2日', nowDate.getFullYear(), nowDate.getMonth() + 1, nowDate.getDate());
            var days = [0, 1, 2, 3, 4, 5, 6].map(function (item) {
              return moment().day(item).format('dddd');
            });
            data.dateWeek = days[nowDate.getDay()];
            $('#calendar')
              .find('.fc-center h2')
              .html(data.dateTime + ' ' + data.dateWeek);
            var listHeihgt = $(window).height() - $('.nativeHeaderWrap').height() - 118;
            $('#calendarList')
              .html(Calendar.Comm.doT.template(listHtml)(Object.assign({}, data, { moment })))
              .find('.calendarList')
              .css('height', listHeihgt); // 往页面添加列表元素
            $('#calendarList .calendarNoList').css('height', listHeihgt + 45);
            $('.calendarList').scrollTop(scrollTop);
          } else if (!isFirst) {
            $('#calendarListMore').attr({ queryend: queryend, restCalCount: data.restCalCount });
            if (parseInt(data.restCalCount, 10) == 0) {
              $('.calendarListMore').hide();
            }

            $('#calendarListMoreData').html(queryend);
            if (data.calendars) {
              $('#calendarList .calendarListMore').before(
                Calendar.Comm.doT.template(listHtml)(Object.assign({}, data, { moment })),
              );
            }
          }
        }
      });
  },

  colorClass: function (val) {
    switch (val) {
      case '#EF9A9A':
        return 'calendarListColorRed'; // 红色
      case '#CE93D8':
        return 'calendarListColorViolet'; // 紫色
      case '#BCAAA4':
        return 'calendarListColorBrown'; // 褐色
      case '#FFCC80':
        return 'calendarListColorOrange'; // 橙色
      case '#90CAF9':
        return 'calendarListColorBlue'; // 蓝色
      case '#A5D6A7':
        return 'calendarListColorGreen'; // 绿色
      case '#FFF59D':
        return 'calendarListColorYellow'; // 黄色
      case '#E6E6E6':
        return 'calendarListColorGrey'; // 灰色
      default:
        break;
    }
  },
};

Calendar.Event = function () {
  window.onresize = function () {
    Calendar.Method.editViewStyle();
  };

  // 列表空白点击创建日程 or 详情 or加载更多
  $('#calendarList')
    .on('click', '.calendarNoListBtn', function () {
      createCalendar();
    })
    .on('click', '.calendarListModel li', function (this: HTMLElement, event) {
      var $el = $(this);
      var pageX = event.clientX;
      var gapRight = $(window).width() - pageX; // 离右边距离
      var calhoverWidth = 360;
      var isTask = $el.data('istask');

      if (isTask) {
        $('#calendar').trigger('openTask', $el.attr('data-id'));
        return false;
      }

      if (gapRight < calhoverWidth) {
        pageX = pageX - calhoverWidth;
      }

      calendarEdit({
        calendarId: $el.attr('data-id'),
        recurTime: $el.attr('data-recurtime'),
        saveCallback: function () {
          Calendar.Method.calendarList(
            moment().format('YYYY-MM-DD HH:mm:ss'),
            moment($('.calendarListMore a').attr('queryend')).format('YYYY-MM-DD'),
            true,
            $('.calendarList').scrollTop(),
          );
        },
      });
    })
    .on('click', '#calendarListMore', function (this: HTMLElement) {
      var startDate2 = $(this).attr('queryend');
      var restCalCount = $(this).attr('restCalCount');

      if (parseInt(restCalCount, 10) > 0) {
        Calendar.Method.calendarList(moment(startDate2).add('month', -1).format('YYYY-MM-DD'), startDate2, false);
      }
    });

  $(document).on('click', function (event) {
    var $target = $(event.target);

    // 隐藏自定义title
    if (!$target.closest('.showActiveTitle').length) {
      $('.hoverContentColor').removeClass('hoverContentColor');
    }
  });
};

Calendar.Export = {
  init: function () {
    CurrentDate = new Date(moment().format());
    Calendar.Method.init();
    Calendar.Event();

    setInterval(function () {
      CurrentDate = new Date(moment().format());
    }, 6000);
  },
  rememberClickRefresh: Calendar.Method.rememberClickRefresh,
};

export default Calendar.Export;
