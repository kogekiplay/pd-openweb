import React, { Component, useMemo } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import FullCalendar from '@fullcalendar/react';
// v7 删掉了 @fullcalendar/daygrid 这类独立包，改成 connector 的子路径入口。
// 它们的 dist-tags.latest 永远停在 6.1.21，看 npm 会误判成「官方没发 stable 7」。
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import listPlugin from '@fullcalendar/react/list';
import '@fullcalendar/react/skeleton.css';
// v7 起样式必须显式引入：骨架 + 一个主题。classic 最接近 v6 外观。
import themePlugin from '@fullcalendar/react/themes/classic';
import '@fullcalendar/react/themes/classic/palette.css';
import '@fullcalendar/react/themes/classic/theme.css';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import cx from 'classnames';
import _ from 'lodash';
import LunarCalendar from 'lunar-calendar';
import moment from 'moment';
import { Icon, LoadDiv } from 'ming-ui';
import autoSize from 'ming-ui/components/AutoSize';
import worksheetAjax from 'src/api/worksheet';
import useButtonStatusOfRows from 'worksheet/hooks/useButtonStatusOfRows';
import { permitList } from 'src/pages/FormSet/config';
import { isOpenPermit } from 'src/pages/FormSet/util';
import { SYS_CONTROLS_WORKFLOW } from 'src/pages/widgetConfig/config/widget.js';
import RecordInfoWrapper from 'src/pages/worksheet/common/recordInfo/RecordInfoWrapper';
import { saveView, updateWorksheetControls } from 'src/pages/worksheet/redux/actions';
import * as Actions from 'src/pages/worksheet/redux/actions/calendarview';
import type { RootState } from 'src/redux/types';
import { getAdvanceSetting, isTimeStyle } from 'src/utils/control';
import type { FormControl } from 'src/utils/controlTypes';
import { addBehaviorLog } from 'src/utils/project';
import { handleRecordClick } from 'src/utils/record';
import {
  filterButtonBySheetSwitchPermit,
  getSheetOperateButtonIds,
  getSheetOperatesButtons,
} from 'src/utils/worksheet';
import SelectField from '../components/SelectField';
import SelectFieldForStartOrEnd from '../components/SelectFieldForStartOrEnd';
import { eventDidMount } from './CalendarEvent';
import CalendarIds from './CalendarIds';
import { CALENDAR_BUTTONS, CALENDAR_VIEW_FORMATS, TAB_LIST } from './constants';
import { buildEventOrder } from './eventOrder';
import External from './External';
import { FC_CLASS_COMPAT } from './fcClassCompat';
import { FC_LOCALES, toFcLocale } from './fcLocale';
import { Wrap, WrapNum } from './styles';
import { getCalendartypeData, getRows, getShowExternalData, isIllegalFormat } from './util';
import {
  changeEndStr,
  formatTimeForSave,
  getCanCreateRecord,
  getCurrentView,
  getTimeControls,
  readInitType,
  renderLine,
  resetFcEventDraggingPoint,
  setShowTip,
} from './util';
import './index.less';

let time;
let clickData = null;

/* 【为什么要这一层 memo】考勤日历这种表一屏 3000 条事件，实测点一次刷新
   CalendarView 会 render 5 次、主线程被切成三段秒级长任务（dev 下 4128/2342/1287ms，
   生产 685ms），而这期间【events 的内容根本没变】—— getFormatData 一次都没跑、
   isEqual 只花 6ms。也就是说 FullCalendar 拿着完全相同的 3000 条事件白渲染了三遍。

   根因：refresh() 会 fan-out 成三次取数（主数据 + 两次 getEventScheduledData），
   后两次只喂侧边「排期」面板，但它们和日历事件同在 calendarview 这个 slice 里，
   一更新就把整个 CalendarView 连同 FullCalendar 带着重渲染。

   这里把 FullCalendar 单独关进 memo，依赖只列【真正影响日历渲染】的值；
   侧边面板的数据（calenderEventList）不在其中，那两次外部取数便不再触发重渲。

   【为什么回调可以原样留在里面】它们读的是 owner.props / owner.state / owner.xxx()，
   都是通过实例在【调用时】取值，不是闭包快照，不会陈旧。
   唯独两处原先闭包了 render 作用域高频变量的，改成调用时实时算：
     - eventData（侧边面板数据，每次外部取数都变）-> getLiveEventData(owner)
     - eventClick（闭包了 currentView / calendarview / worksheetId）-> liveEventClick(owner, info) */
const getLiveEventData = owner => {
  const { calendarview = {} } = owner.props;
  const { calenderEventList = {} } = calendarview;
  return calenderEventList[`${readInitType()}Dt`] || [];
};

const liveEventClick = (owner, eventInfo) => {
  const { calendarview = {}, base = {} } = owner.props;
  const currentView = getCurrentView(owner.props);
  const { extendedProps } = eventInfo.event._def;
  handleRecordClick(currentView, extendedProps, () => {
    owner.setState({
      recordId: extendedProps.rowid,
      recordInfoVisible: true,
      rows: getRows(eventInfo.event.start, eventInfo.event.start, calendarview),
      showPrevNext: true,
    });
    addBehaviorLog('worksheetRecord', base.worksheetId, { rowId: extendedProps.rowid }); // 埋点
  });
};

const MemoFullCalendar = React.memo(
  function MemoFullCalendar({
    owner,
    fullCalendarKey,
    height,
    initialView,
    btnList,
    calendarFormatData,
    weekbegin,
    showall,
    unweekday,
    others,
    currentView,
    appId,
    unselectAuto,
    hour24,
  }: any) {
    /* 【设置里的「排序」在这里才真正接上】此前 eventOrder 写死 'start'，抽屉里那一栏
       配了等于没配。controls 从 owner 上取而不是加成 props —— 它只用来判断字段类型
       （数值/日期/文本），一个会话里基本不变，加进 props 反而会让 memo 比较器多一项。 */
    const eventOrder = React.useMemo(
      () => buildEventOrder(currentView.moreSort, owner.props.controls),
      [currentView.moreSort, owner.props.controls],
    );
    return (
      <FullCalendar
        key={fullCalendarKey}
        dragScroll={true}
        // v7 移除了 themeSystem：主题改成插件了，见文件头的 themePlugin
        // 把 v6 的语义类名挂回来，放在最前面展开，后面的 props 仍可覆盖
        {...FC_CLASS_COMPAT}
        height={height}
        ref={owner.calendarComponentRef}
        initialView={initialView} // 选中的日历模式
        headerToolbar={{
          right: btnList,
          center: 'title',
          left: '',
        }}
        eventDragStart={() => {
          owner.setState({ isMove: true });
          resetFcEventDraggingPoint();
        }}
        eventDragStop={() => owner.setState({ isMove: false })}
        views={CALENDAR_VIEW_FORMATS}
        // v7 把 dayCellContent 拆细了，日号所在的顶部区叫 dayCellTopContent
        dayCellTopContent={item => {
          return (
            <React.Fragment>
              {item.view.type === 'dayGridMonth' && owner.getLunar(item)}
              <WrapNum className={cx('num Hand', { canAdd: owner.state.canNew })}>
                <span className="txt">{item.dayNumberText.replace('日', '')}</span>
                {!['timeGridDay', 'timeGridWeek'].includes(item.view.type) && owner.renderCalendarItem(item)}
              </WrapNum>
            </React.Fragment>
          );
        }}
        dayCellDidMount={item => {
          if (!owner.state.canNew) {
            return;
          }

          $(item.el).on({
            mousemove: event => {
              if ($('.fc-more-popover').length > 0) return;
              owner.showTip(event, true);
            },
            mouseout: () => {
              owner.showTip(null, false);
            },
          });
          $(item.el)
            .find('.fc-daygrid-day-events')
            .on({
              mousemove: event => {
                owner.showTip(event, false);
                event.stopPropagation();
              },
            });
        }}
        dayHeaderContent={item => {
          const date = new Date(item.date);
          const day = date.getDate();
          const weekday =
            item.view.type === 'dayGridMonth'
              ? item.text
              : date.toLocaleDateString(window.getCurrentLang() || 'zh-cn', { weekday: 'short' });
          return (
            <React.Fragment>
              {item.view.type !== 'dayGridMonth' && owner.getLunar(item)}
              <div className="num">
                {item.view.type !== 'dayGridMonth' ? `${day} ${weekday}` : weekday}
                {['timeGridDay', 'timeGridWeek'].includes(item.view.type) && owner.renderCalendarItem(item)}
              </div>
            </React.Fragment>
          );
        }}
        dayHeaderDidMount={() => {
          $('.fc-col-header-cell').on('click', () => {
            clickData = null;
          });
        }}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, themePlugin]}
        locales={FC_LOCALES}
        locale={toFcLocale(window.getCurrentLang())}
        buttons={CALENDAR_BUTTONS}
        allDayText={_l('全天')}
        hiddenDays={
          unweekday.length >= 7
            ? ''
            : unweekday
                .replace('7', '0')
                .split('')
                .map(o => {
                  return +o;
                })
        } // 隐藏周几
        editable={true}
        firstDay={weekbegin ? Number(weekbegin) % 7 : 1} // 周一至周六为1～6，周日为0
        slotHeaderFormat={{
          hour: '2-digit',
          minute: '2-digit',
          meridiem: false,
          hour12: false,
        }}
        timeZone="local"
        defaultTimedEventDuration={'00:00:01'}
        events={calendarFormatData}
        viewDidMount={() => {
          owner.calendarActionFn();
          owner.getEventsFn();
        }}
        viewWillUnmount={owner.calendarActionOff}
        // 合成而不是覆盖：FC_CLASS_COMPAT.viewClass 负责还原 fc-view / fc-{type}-view
        viewClass={info => `${FC_CLASS_COMPAT.viewClass(info)} worksheetFullCalendar`}
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
          omitZeroMinute: true,
          hour12: hour24 === '0',
        }} // 任务的时间
        eventOrder={eventOrder} // 由「视图设置 -> 排序」生成，没配排序时退回 ['start']
        displayEventEnd={false} // 让月视图的任务既显示开始时间又显示结束时间
        eventClick={info => liveEventClick(owner, info)}
        eventDidMount={info =>
          eventDidMount(
            info,
            currentView,
            owner.props.controls,
            owner.props.worksheetInfo,
            owner.props.base,
            owner.props.sheetSwitchPermit,
            owner.props.isCharge,
            owner.props,
            () => liveEventClick(owner, info),
            owner.state.isMove,
            () => owner.props.buttonsCheckStatus,
          )
        }
        eventDrop={info => {
          let endData = _.get(info, ['event', 'extendedProps', 'endData']) || {};
          let startData = _.get(info, ['event', 'extendedProps', 'startData']) || {};
          // 日历上 记录的拖拽
          let control = [
            {
              controlId: startData.controlId,
              controlName: startData.controlName,
              type: startData.type,
              value: formatTimeForSave(info.event.start, startData, appId),
            },
          ];
          //日历视图推拽bugfix，结束时间不从组件返回内容取，需要根据开始时间+时间差来处理
          const item = (info?.event?.extendedProps?.timeList || [])?.[0];
          const rowStart = item?.row?.[startData?.controlId];
          const rowEnd = item?.row?.[endData?.controlId];
          const needEnd = !!endData?.controlId && !!rowStart && !!rowEnd && !moment(rowEnd).isBefore(moment(rowStart));

          if (item && needEnd) {
            const endTime = moment(info.event.start)
              .add(moment(rowEnd).diff(moment(rowStart)), 'ms')
              .toDate();
            control.push({
              controlId: endData.controlId,
              controlName: endData.controlName,
              type: endData.type,
              value: formatTimeForSave(endTime, endData, appId),
            });
          }

          owner.updateData(control, info.event.extendedProps.rowid, data => {
            owner.props.updateEventData(info.event._def.extendedProps.rowid, data, info.event.start);
          });
        }}
        eventResize={info => {
          let endData = _.get(info, ['event', 'extendedProps', 'endData']) || {};

          if (!endData.controlId) {
            alert(_l('请配置结束控件'), 3);
            owner.getEventsFn();
            return;
          }

          owner.updateData(
            [
              {
                controlId: endData.controlId,
                controlName: endData.controlName,
                type: endData.type,
                value: formatTimeForSave(
                  new Date(changeEndStr(info.event.end, info.event.allDay, owner.props.calendarview)),
                  endData,
                  appId,
                ),
              },
            ],
            info.event.extendedProps.rowid,
          );
        }}
        dayMaxEventRows={showall === '0'}
        /* 【周/日视图里并发事件太多会退化成一堵竖线墙】考勤这类表一天能有几十条同一时刻
           的打卡记录。FullCalendar 默认把同一时段的事件平分列宽，25 条并发 + 165px 的
           列宽 = 每条 6px，标题一个字也看不见，签到时刻还都是零时长（高度只有 2px）。
           默认的 eventMinWidth:30 在这种堆叠里不起作用（实测量到 2.4px）。
           限定最多并排 3 条，其余收进「+N」链接（点开是弹层，能看全）；
           少于 3 条并发的普通日历完全不受影响。 */
        eventMaxStack={3}
        moreLinkContent={info => {
          // 【带上「更多」两个字】光一个 "+38" 看不出是能点的；样式那边同时把它做成了胶囊。
          // 去掉了原来的 w100 —— 撑满整格反而让它看起来像一行说明文字而不是一个控件。
          return <div title={_l('查看其他%0个', info.num)}>{`+${info.num} ${_l('更多')}`}</div>;
        }}
        moreLinkClick={() => {
          const setMorePoper = () => {
            if ($('.fc-more-popover').length > 0) {
              let h = $('.fc-more-popover').height();
              let top = $('.fc-more-popover').position().top;
              /* 【原先量的是 .fc-scroller-harness-liquid】那是 v6 的滚动容器类名，
               v7 哈希化之后【整页 0 个元素】，jQuery 拿到的是 undefined，
               于是下面 `h + top > undefined` 恒为 false（NaN 比较），
               「+N 更多」弹层超出下边界时【永远不会】翻到上方去 —— 静默失效。
               这里改量我们自己的 .calendarCon（就是日历的可视区容器），
               语义一致且不依赖库的内部类名。 */
              let mH = $(owner.getCalendarBox()).find('.calendarCon').height() || $('.calendarCon').height();

              if (h + top > mH) {
                $('.fc-more-popover').css({ bottom: 10, top: 'initial' });
              }

              $('.fc-more-popover').addClass('show');
            }
          };

          if ($('.fc-more-popover').length > 0) {
            setMorePoper();
          } else {
            setTimeout(() => {
              setMorePoper();
            }, 500);
          }
        }}
        unselectAuto={owner.state.unselectAuto}
        selectable={true}
        // selectHelper={true}
        select={info => {
          if (!owner.state.canNew) {
            return;
          }

          // isSafari 且 双击
          if (window.isSafari && owner.dbClickFn()) {
            owner.selectFn({ ...info });
            return;
          }

          clickData = info;
          // 全天事件
          if (info.allDay) {
            // 且 多天 即非一格
            if (moment(info.end).diff(moment(info.start), 'day') > 1) {
              // 全天事件 框选多天
              owner.selectFn(info);
            }
          } else {
            // 30分钟以上 即非一格
            if (moment(info.end).diff(moment(info.start), 'minute') > 30) {
              owner.selectFn(info);
            }
          }
        }}
        // droppable={true} //true 会造成所有的拖动都走drop
        drop={info => {
          // 排期列表 =>拖拽到日历
          let rowId = $(info.draggedEl).attr('rowid');

          if (!rowId) {
            return;
          }

          let keyId = $(info.draggedEl).attr('keyId');
          // 侧边面板数据，每次外部取数都会变；必须在【调用时】取，不能闭包也不能做依赖
          const eventScheduled = _.get(owner.props, 'calendarview.calenderEventList.eventScheduled') || [];
          let data = eventScheduled.filter(o => o.keyIds === keyId);

          if (data.length && data.length === 1) {
            const hasEnd = !!data[0].end;
            const calendarEnd = !hasEnd
              ? ''
              : !data[0].allDay
                ? data[0].end
                : `${moment(data[0].end).subtract(1, 'day').format('YYYY-MM-DD')} 23:59:59`;
            owner.changeEventFn({
              ...info,
              calendar: {
                start: data[0].start,
                end: calendarEnd,
              },
              data: {
                ...data[0],
              },
              rowId,
            });
          } else {
            owner.setState(
              {
                selectTimeInfo: info,
                changeData: getLiveEventData(owner).find(o => o.rowid === rowId) || {},
              },
              () => {
                owner.showChooseTrigger(info.dateStr, info.view.type);
              },
            );
          }
        }}
        eventMouseEnter={() => {
          owner.showTip(null, false);
        }}
        {...others}
      />
    );
  },
  /* 默认的浅比较在这里不够用：实测每次刷新有两个 prop 的【引用】必变，而【值】没变 ——
     others      : render 里是 `let others = {}` 再按需塞 slotMinTime/slotMaxTime，每次都是新字面量
     currentView : 来自 find(views, …)，而 redux 每次更新会重建 views 里的视图对象
   只要这两个参与浅比较，memo 就永远命中不了（实测：4 次比较全部报
   "others,currentView" 变化，三段秒级重渲一次没省掉）。
   所以这两项按【值】比：others 只有两个字段直接比；currentView 是单个视图对象，
   _.isEqual 实测只要几毫秒，相对一次 1~3 秒的重渲完全值得。 */
  (prev, next) => {
    const keys = Object.keys(next);

    for (const k of keys) {
      if (k === 'others' || k === 'currentView') continue;

      if (prev[k] !== next[k]) return false;
    }

    const po = prev.others || {};
    const no = next.others || {};

    if (po.slotMinTime !== no.slotMinTime || po.slotMaxTime !== no.slotMaxTime) return false;

    return _.isEqual(prev.currentView, next.currentView);
  },
);

class RecordCalendarBase extends Component<any, any> {
  constructor(props) {
    super(props);
    this.calendarComponentRef = React.createRef();
    this.state = {
      showExternal: false,
      recordInfoVisible: false,
      scrollType: null,
      unselectAuto: false,
      isSearch: false,
      isLoading: false,
      height: props.height,
      canNew: getCanCreateRecord(props),
      calendarFormatData: [],
      showChoose: false,
      selectTimeInfo: {},
      changeData: null,
      popupVisible: '',
      addDataList: [],
      random: parseInt(Math.random() * 1000000000000),
      fullCalendarKey: JSON.stringify(Math.random()),
      isMove: false,
    };
  }
  componentDidMount() {
    this.setState({
      canNew: getCanCreateRecord(this.props),
    });
    this.getFormatData(this.props);
    this.props.getCalendarData();
    this.props.fetchExternal();
    this.getEventsFn();
  }

  componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const { base, calendarview = {}, height, sheetSwitchPermit } = this.props;

      if (
        !_.isEqual(sheetSwitchPermit, prevProps.sheetSwitchPermit) ||
        _.get(this.props, 'worksheetInfo.allowAdd') !== _.get(prevProps, 'worksheetInfo.allowAdd')
      ) {
        this.setState({
          canNew: getCanCreateRecord(this.props),
        });
      }

      const { calendarData = {}, calendarFormatData } = calendarview;
      const { viewId } = base;
      const currentView = getCurrentView(this.props);
      const preView = getCurrentView(prevProps);
      const { initialView } = calendarData;

      if (this.props.height !== prevProps.height) {
        /* 【这里原先有一句强制 100% 宽，已整行删掉】原文是
             $('.boxCalendar,.calendarCon,.fc-daygrid-body,.fc-scrollgrid-sync-table,.fc-col-header ').width('100%')
           那是绕 v6 表格布局怪癖的补丁。v7 把类名哈希化之后 .fc-daygrid-body 和
           .fc-scrollgrid-sync-table 在页面上一个元素都没有，只剩 .fc-col-header 还活着
           （dayHeaderRowClass 钩子）—— 而恰恰是它有害：v7 的表头是 flex 布局，
           .fc-col-header 是 flex 子项，给它写死 width:100% 会让它【塌成 0 宽】，
           七个日期表头格跟着变成 0~1px，周/日视图的「14 周一 15 周二 …」整排文字消失。
           这一句在 height 变化时才跑，所以表现为「窗口一缩放表头就没了」。

           生产上一行一行验过：跑这句之后 .fc-col-header 宽 1011 -> 0、表头格 138 -> 0~1；
           把行内 width 清掉，表头立刻恢复成 137~138px。
           v7 自己管布局，这一整句不需要了。 */
        this.setState({
          height,
        });
      }

      if (!_.isEqual(calendarFormatData, (prevProps.calendarview || {}).calendarFormatData)) {
        this.getFormatData(this.props);
      }

      if (viewId !== prevProps.base.viewId || !_.isEqual(currentView, preView)) {
        this.props.getCalendarData();
        this.calendarComponentRef.current && this.calendarComponentRef.current.getApi().changeView(initialView); // 更改视图类型

        this.props.fetchExternal();
        this.getEventsFn();

        /* 【换 key 只留给「切到另一个视图」，不再给「改设置」用】
           换 key = 让 React 把整个 FullCalendar 卸载重挂，1000 条事件从零渲染一遍。
           原先它挂在整个分支上，而分支条件是 !isEqual(currentView, preView) ——
           【改任何一项视图设置】都会命中。生产实测改一次设置约 890ms 卡顿
           （579/220/94ms 三段），其中光重挂载就占 ~700ms（三次采样 737/716/692），
           占了八成。用户报的「随便改啥设置都会卡」就是这个。

           同一个视图改设置根本不需要重挂：这些选项 FullCalendar 支持运行时更新，
           而且现在全部作为 props 走 MemoFullCalendar 的比较器，变了自然会重渲染 ——
             firstDay(weekbegin)、hiddenDays(unweekday)、dayMaxEventRows(showall)、
             eventTimeFormat.hour12(hour24)、slotMinTime/slotMaxTime(showtime)。
           唯一“只在挂载时读一次”的 initialView，上面那行 changeView() 已经在管。
           颜色/标题/开始结束字段只影响事件内容，走 getEventsFn() -> calendarFormatData。
           以上每一项都逐个实测过（改完再还原，观测值都回到原样，全程 key 不变）。

           切到【另一个】日历视图的情况保留重挂：views/index.tsx 渲染
           <Component {...viewProps} /> 时没有 key，两个日历视图之间切换会复用同一个
           实例，而那条路径这个表里没有第二个日历视图、验不了。它本来就要重新取数、
           很少发生，留着这层保险不亏。 */
        if (viewId !== prevProps.base.viewId) {
          this.setState({
            fullCalendarKey: JSON.stringify(Math.random()),
          });
        }
      }

      if (
        viewId !== prevProps.base.viewId ||
        getAdvanceSetting(currentView).begindate !== getAdvanceSetting(preView).begindate ||
        getAdvanceSetting(currentView).colorid !== getAdvanceSetting(preView).colorid ||
        getAdvanceSetting(currentView).colortype !== getAdvanceSetting(preView).colortype ||
        getAdvanceSetting(currentView).calendarcids !== getAdvanceSetting(preView).calendarcids ||
        getAdvanceSetting(currentView).viewtitle !== getAdvanceSetting(preView).viewtitle
      ) {
        // 切换视图，或更改开始时间字段 重新更新排期数据
        this.props.refreshEventList();
        this.props.fetchExternal();
        this.setState({
          isSearch: false,
        });
      }

      if (
        !_.isEqual(initialView, prevProps.calendarview.calendarData.initialView) &&
        this.calendarComponentRef.current
      ) {
        this.calendarComponentRef.current.getApi().changeView(initialView); // 更改视图类型
      }
    }

    if (this.calendarComponentRef.current) {
      const { base } = this.props;
      const { viewId, worksheetId } = base;
      let view = this.calendarComponentRef.current.getApi().view;
      let data = getCalendartypeData();
      data[`${worksheetId}-${viewId}`] = view.type;
      safeLocalStorageSetItem('CalendarViewType', JSON.stringify(data));
    }
  }

  dbClickDay = () => {
    if (clickData) {
      this.selectFn(clickData);
    }
  };

  /* 【FullCalendar 7 把类名哈希化了，.fc-view-harness-active 根本不存在】
     实测 v7 渲染出来的是 fc-classic-yth / fc-O6 这种哈希名，整页 348 个 fc- 元素里
     一个 fc-view-harness 都没有；只有 fc-toolbar / fc-toolbar-chunk / fc-header-toolbar
     这几个保持了原名（所以下面那段 toolbar 的 jQuery 仍然有效）。

     后果有两层：
     1）calendarActionFn 里那句 querySelector(...) 返回 null，紧接着 .addEventListener
        直接抛 "Cannot read properties of null (reading 'addEventListener')"，
        <ContentContainer> 被 ErrorBoundary 接管 —— 整个日历视图打不开。
     2）就算不抛，双击日期新建记录这个功能也早就失效了（监听器压根没挂上）。

     改挂到 .boxCalendar_${random} 这个【我们自己的】容器类上：它不受 FC 哈希影响。
     dbClickDay 只读模块级的 clickData（由 FC 的 select 回调写入）、不看事件目标，
     所以挂在容器上与挂在视图区语义一致。 */
  getCalendarBox = () => document.querySelector(`.boxCalendar_${this.state.random}`);

  calendarActionOff = () => {
    const { random } = this.state;
    const $el = this.getCalendarBox();

    if ($el) {
      $el.removeEventListener('dblclick', this.dbClickDay, true);
    }

    $(`.boxCalendar_${random} .fc-toolbar-chunk`).off('click');
  };

  calendarActionFn = () => {
    const { random } = this.state;

    if (!window.isSafari) {
      const $el = this.getCalendarBox();

      if ($el) {
        $el.addEventListener('dblclick', this.dbClickDay, true);
      }
    }

    $(`.boxCalendar_${random} .fc-toolbar-chunk`)
      .last()
      .on('click', () => {
        this.getEventsFn();
      });
  };

  getEventsFn = () => {
    setTimeout(() => {
      if (!this.calendarComponentRef.current) {
        return;
      }

      const { filters } = this.props;
      let view = this.calendarComponentRef.current.getApi().view;
      let beginTime = moment(view.activeStart).format('YYYY-MM-DD HH:mm');
      let endTime = moment(view.activeEnd).format('YYYY-MM-DD HH:mm');
      let searchData = {
        beginTime,
        endTime,
      };
      this.props.changeCalendarTime(beginTime, endTime);
      this.props.fetch(Object.assign({}, filters, searchData));
      renderLine(this.state.random, getCurrentView(this.props));
    }, 200);
  };

  getFormatData = nextProps => {
    const { calendarview = {}, base = {} } = nextProps;
    const { calendarFormatData = [] } = calendarview;
    const { worksheetId, viewId } = base;
    this.setState({
      showExternal: (getShowExternalData() || []).includes(`${worksheetId}-${viewId}`),
      calendarFormatData,
    });
  };

  updateData = (newOldControl, rowId: string, cb?) => {
    const { base, updataEditable } = this.props;
    const { appId, worksheetId, viewId } = base;
    updataEditable(false);
    worksheetAjax
      .updateWorksheetRow({
        rowId,
        appId,
        worksheetId,
        viewId,
        newOldControl,
      })
      .then(({ data, resultCode }) => {
        if (data && resultCode === 1) {
          this.getEventsFn();
          if (cb) {
            cb(data);
          }

          clickData = null;
          this.setState({
            changeData: null,
          });
        }
      });
  };

  // 显示农历
  getLunar = item => {
    const { unlunar } = getAdvanceSetting(getCurrentView(this.props)); // 默认显示农历

    if (unlunar !== '0') {
      return '';
    }

    let data = LunarCalendar.solarToLunar(item.date.getFullYear(), item.date.getMonth() + 1, item.date.getDate());
    return (
      <React.Fragment>
        {(item.view.type === 'timeGridWeek' ||
          item.view.type === 'dayGridWeek' ||
          item.view.type === 'dayGridMonth') && <span className="lunar">{data.lunarDayName}</span>}
        {(item.view.type === 'timeGridDay' || item.view.type === 'dayGridDay') && (
          <span className="lunar">{`${data.GanZhiYear}${data.lunarMonthName}${data.lunarDayName}`}</span>
        )}
      </React.Fragment>
    );
  };

  changeEventFn = info => {
    const { base } = this.props;
    const { appId } = base;
    let endData = _.get(info, ['data', 'endData']);
    let startData = _.get(info, ['data', 'startData']) || {};
    let dateStr = info.dateStr;
    let startTime;
    const { rowId, calendar = {} } = info;

    if (info.allDay) {
      // YYYY-MM-DD
      let str = calendar.start
        ? `${dateStr} ${moment(calendar.start).format('YYYY-MM-DD HH:mm').substring(11)}`
        : `${dateStr} 08:00`;
      startTime = isTimeStyle(startData) ? str : dateStr;
    } else {
      // 'YYYY-MM-DD HH:mm'
      startTime = moment(dateStr).format(_.get(info, ['data', 'startFormat']));
    }

    let control = [
      {
        controlId: startData.controlId,
        controlName: startData.controlName,
        type: startData.type,
        value: formatTimeForSave(new Date(startTime), startData, appId),
      },
    ];

    if (endData && calendar.end) {
      // 开始时间与拖拽时间的时间差
      let l = moment(startTime).valueOf() - moment(calendar.start).valueOf();
      const endTime = moment(moment(calendar.end).valueOf() + l).format(_.get(info, ['data', 'endFormat']));
      control.push({
        controlId: endData.controlId,
        controlName: endData.controlName,
        type: endData.type,
        value: formatTimeForSave(new Date(endTime), endData, appId),
      });
    }

    this.updateData(control, rowId, data => {
      this.props.updateEventData(rowId, data, startTime);
    });
  };

  showTip = (event, flag: boolean) => {
    setShowTip(event, flag, this.state.canNew);
  };

  selectFn = info => {
    this.setState(
      {
        selectTimeInfo: info,
      },
      () => {
        let endDivStr = info.endStr;

        if (!info.allDay) {
          endDivStr = moment(info.endStr).format('YYYY-MM-DD');
        } else {
          endDivStr = moment(endDivStr).subtract(1, 'day').format('YYYY-MM-DD');
        }

        this.showChooseTrigger(endDivStr, info.view.type);
      },
    );
  };

  // 兼容Safari
  dbClickFn = () => {
    // 需要手动实现双击事件
    let date = +new Date();

    if (!time) {
      time = date;
    } else {
      if (date - time <= 500) {
        time = '';
        return true;
      } else {
        time = date;
      }
    }

    return false;
  };

  showChooseTrigger = data => {
    setTimeout(() => {
      const { random, canNew } = this.state;

      if (!canNew) {
        return;
      }

      let date = moment(data).format('YYYY-MM-DD');
      $(`span[data-date=${date}-${random}]`)[0]?.click();
    }, 500);
  };

  renderCalendarItem = item => {
    const { base, calendarview = {}, updateCalendarEventIsAdd } = this.props;
    const { calendarData = {} } = calendarview;
    const { calendarInfo = [] } = calendarData;
    return (
      <CalendarIds
        item={item}
        calendarInfo={calendarInfo}
        {..._.cloneDeep(this.state)}
        isHide={true}
        calendarview={calendarview}
        changeEventFn={this.changeEventFn}
        onChangeState={state => this.setState({ ...state })}
        base={base}
        getEventsFn={this.getEventsFn}
        updateCalendarEventIsAdd={updateCalendarEventIsAdd}
        clickData={clickData}
        onChangeClickData={data => {
          clickData = data;
        }}
      />
    );
  };

  refreshCalendarData = () => {
    this.getEventsFn();
    this.props.refreshEventList();
    this.props.fetchExternal();
  };

  render() {
    const {
      toCustomWidget,
      worksheetInfo,
      sheetSwitchPermit,
      isCharge,
      controls = [],
      base,
      calendarview = {},
      setViewConfigVisible,
    } = this.props;
    const { calendarData = {}, calenderEventList = {} } = calendarview;
    const { eventScheduled = [] } = calenderEventList;
    const { appId, worksheetId, viewId } = base;
    const currentView = getCurrentView(this.props);
    let {
      begindate = '',
      enddate = '',
      colorid = '',
      hour24 = '0',
      calendarcids = '[]',
      weekbegin,
      showall = '0',
    } = getAdvanceSetting(currentView);

    try {
      calendarcids = JSON.parse(calendarcids);
    } catch (error) {
      calendarcids = [];
      console.log(error);
    }

    if (!Array.isArray(calendarcids) || calendarcids.length <= 0 || !calendarcids[0]) {
      calendarcids = [{ begin: begindate, end: enddate }]; //兼容老数据
    }

    const { recordInfoVisible, recordId, isLoading, rows = [], showPrevNext = false, random } = this.state;
    const typeEvent = readInitType();
    const { calendarInfo = [], unweekday = '', btnList, initialView } = calendarData;
    const { height, calendarFormatData } = this.state;
    let isDelete =
      calendarcids[0].begin &&
      calendarInfo.length > 0 &&
      (!calendarInfo[0].startData || !calendarInfo[0].startData.controlId);

    if (
      !isOpenPermit(permitList.sysControlSwitch, sheetSwitchPermit) &&
      SYS_CONTROLS_WORKFLOW.includes(_.get(calendarInfo[0], 'startData.controlId'))
    ) {
      isDelete = true;
    }

    let isHaveSelectControl = !calendarcids[0].begin || isDelete; // 是否选中了开始时间 //开始时间字段已删除

    if (isHaveSelectControl || isIllegalFormat(calendarInfo)) {
      return (
        <Wrap>
          <SelectField
            sheetSwitchPermit={sheetSwitchPermit}
            isCharge={isCharge}
            context={
              <SelectFieldForStartOrEnd
                {...this.props}
                isCalendarcids
                saveView={(data, viewNew) => {
                  let viewData = {};
                  const { moreSort } = currentView;

                  // 第一次创建Calendar时，配置排序数据
                  if (!moreSort) {
                    viewData = {
                      editAttrs: ['moreSort', 'sortType', 'advancedSetting'],
                      moreSort: [{ controlId: 'ctime', isAsc: true }],
                      sortType: 2,
                    };
                  }

                  this.props.saveView(data, { ...viewNew, ...viewData });
                  setViewConfigVisible(true);
                }}
                view={currentView}
                isDelete={isDelete}
                timeControls={getTimeControls(controls)}
                begindateOrFirst
              />
            }
            viewType={4}
            toCustomWidget={toCustomWidget}
          />
        </Wrap>
      );
    }

    // FullCalendar 的时间轴上下界，形如 '08:00:00'

    let others: { slotMinTime?: string; slotMaxTime?: string } = {};

    if (_.get(currentView, 'advancedSetting.showtime')) {
      const times = _.get(currentView, 'advancedSetting.showtime').split('-');
      others.slotMinTime = times[0];
      others.slotMaxTime = times[1];
    }

    return (
      <div className={`boxCalendar boxCalendar_${random}`}>
        {this.state.showExternal && (
          <External
            currentView={currentView}
            showExternal={this.state.showExternal}
            recordInfoVisible={this.state.recordInfoVisible}
            showRecordInfo={(rowid: string, data, eventData) => {
              handleRecordClick(currentView, data.extendedProps, () => {
                this.setState({
                  recordId: rowid,
                  recordInfoVisible: true,
                  showPrevNext: !!data.start,
                  rows: data.start
                    ? eventData
                        .filter(
                          o =>
                            (!!o.start &&
                              moment(o.start).isSameOrBefore(data.start, 'day') &&
                              moment(o.end).isSameOrAfter(data.end, 'day')) ||
                            moment(o.start).isSame(data.start, 'day'),
                        )
                        .map(o => {
                          return { ...o.extendedProps };
                        })
                    : [],
                });
              });
            }}
            tabList={TAB_LIST}
          />
        )}
        <div
          className={cx('calendarCon', {
            boldEvent: _.get(currentView, 'advancedSetting.rowHeight') === '1',
          })}
        >
          <div
            className={cx('scheduleBtn Hand', { show: this.state.showExternal })}
            onClick={() => {
              let showExternalData = getShowExternalData() || [];

              if (!this.state.showExternal) {
                showExternalData.push(`${worksheetId}-${viewId}`);
              } else {
                showExternalData = showExternalData.filter(o => o !== `${worksheetId}-${viewId}`);
              }

              safeLocalStorageSetItem('CalendarShowExternal', JSON.stringify(showExternalData));
              this.setState(
                {
                  showExternal: !this.state.showExternal,
                },
                () => {
                  this.props.fetchExternal();
                },
              );
            }}
          >
            <Icon className="Font16 Hand" icon="abstract" />
            <span className="mLeft7 Bold">{_l('排期')}</span>
            {/* 未排期数量 */}
            {!this.state.showExternal && calenderEventList.eventNoScheduledCount > 0 && (
              <span className="num mLeft7">{`( ${_l('%0未排期', calenderEventList.eventNoScheduledCount)} )`}</span>
            )}
            {this.state.showExternal && <Icon className="Font16 mLeft7 Hand" icon="close" />}
          </div>
          {!isLoading ? (
            <MemoFullCalendar
              owner={this}
              fullCalendarKey={this.state.fullCalendarKey}
              height={height}
              initialView={initialView}
              btnList={btnList}
              calendarFormatData={calendarFormatData}
              weekbegin={weekbegin}
              showall={showall}
              unweekday={unweekday}
              others={others}
              currentView={currentView}
              appId={appId}
              unselectAuto={this.state.unselectAuto}
              hour24={hour24}
            />
          ) : (
            <LoadDiv />
          )}
        </div>
        {/* 表单信息 */}
        {recordInfoVisible && (
          <RecordInfoWrapper
            enablePayment={worksheetInfo.enablePayment}
            showPrevNext={showPrevNext}
            projectId={worksheetInfo.projectId}
            currentSheetRows={rows}
            allowAdd={worksheetInfo.allowAdd}
            sheetSwitchPermit={sheetSwitchPermit} // 表单权限
            visible
            appId={appId}
            viewId={viewId}
            from={1}
            view={currentView}
            hideRecordInfo={() => {
              this.setState({ recordInfoVisible: false });
            }}
            recordId={recordId}
            worksheetId={worksheetId}
            rules={worksheetInfo.rules}
            updateSuccess={(ids, updated) => {
              let attribute = controls.find((o: FormControl) => o.attribute === 1);

              // 更改了 开始时间/结束时间/标题字段/颜色 =>更新日历视图数据
              if (
                updated[begindate] ||
                (colorid && updated[colorid]) ||
                (enddate && updated[enddate]) ||
                (attribute && updated[attribute.controlId])
              ) {
                this.refreshCalendarData();
              }
            }}
            onDeleteSuccess={() => {
              // 删除行数据后重新加载页面
              this.refreshCalendarData();
              this.setState({
                rows: [],
                showPrevNext: false,
                recordInfoVisible: false,
              });
            }}
            hideRows={() => {
              this.refreshCalendarData();
              this.setState({
                rows: [],
                showPrevNext: false,
              });
            }}
            handleAddSheetRow={() => {
              this.refreshCalendarData();
              this.setState({ recordInfoVisible: false });
            }}
          />
        )}
        {this.state.canNew && <div id="mytips">{_l('双击创建记录')}</div>}
      </div>
    );
  }
}

const RecordCalendar = autoSize(RecordCalendarBase);

// 包装组件，用于在日历视图中获取记录卡片按钮状态
const RecordCalendarWrapper = props => {
  const { base = {}, views = [], calendarview = {}, sheetButtons, printList, sheetSwitchPermit } = props;
  const { viewId, worksheetId } = base;
  const currentView = views.find(o => o.viewId === viewId) || {};
  const { calendarFormatData = [] } = calendarview;

  // 获取所有记录 ID
  const allRecordIds = useMemo(
    () => calendarFormatData.map(item => _.get(item, 'extendedProps.rowid')).filter(Boolean),
    [calendarFormatData],
  );

  // 获取操作按钮
  const operateButtons = useMemo(() => {
    let buttons = getSheetOperatesButtons(currentView, { buttons: sheetButtons, printList });
    buttons = filterButtonBySheetSwitchPermit(buttons, sheetSwitchPermit, viewId);
    return buttons;
  }, [currentView, sheetButtons, printList, sheetSwitchPermit, viewId]);

  // 获取按钮 ID
  const btnIds = useMemo(() => getSheetOperateButtonIds(operateButtons), [operateButtons]);

  // 获取按钮状态
  const { buttonsCheckStatus } = useButtonStatusOfRows(worksheetId, allRecordIds, btnIds);

  return <RecordCalendar {...props} buttonsCheckStatus={buttonsCheckStatus} />;
};

export default connect(
  (state: RootState) => ({
    ...state.sheet,
    sheetSwitchPermit: state.sheet.sheetSwitchPermit || [],
    worksheetInfo: state.sheet.worksheetInfo,
    sheetButtons: state.sheet.sheetButtons,
    printList: state.sheet.printList,
  }),
  dispatch => bindActionCreators({ ...Actions, saveView, updateWorksheetControls }, dispatch),
)(RecordCalendarWrapper);
