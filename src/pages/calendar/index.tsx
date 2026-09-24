import { Component, Fragment } from 'react';
import LoadDiv from 'ming-ui/components/LoadDiv';
import TaskDetail from 'src/pages/task/containers/taskDetail/taskDetail';
import toolBar from './modules/toolbar/toolbar';
import { destroyCalendar } from './modules/calendar/fcInstance';
import './modules/calendarControl/css/fullcalendar.less';
import './modules/css/share.less';

export interface CalendarEntrypointState {
  openTaskDetail: boolean;
  taskId: string;
}

export default class CalendarEntrypoint extends Component<any, CalendarEntrypointState> {
  constructor(props) {
    super(props);
    this.state = {
      openTaskDetail: false,
      taskId: '',
    };
    // v2 时代这里要先把 vendor 进来的 fullcalendar 注册成 jQuery 插件（fullCalendar()）。
    // v7 是正常的 npm 包，由 modules/calendar/fcInstance 负责创建实例，这里不用做任何事。
  }
  override componentDidMount() {
    $('html').addClass('AppCalendar');
    toolBar.bindEvent();

    // 语言包不再动态 import：v2 那 40 个 vendor 语言文件是靠副作用往插件上注册的，
    // v7 的 locale 由 modules/calendar/fcInstance 在建实例时一次性注册（体积很小），
    // 顺带消掉了"语言包还没加载完就 init"的时序问题。
    toolBar.init();

    const _this = this;
    $('#calendar').on('openTask', function (_event, taskId: string) {
      _this.setState({ openTaskDetail: true, taskId });
    });
  }
  override componentWillUnmount() {
    $('html').removeClass('AppCalendar');
    destroyCalendar();
  }
  override render() {
    const { openTaskDetail, taskId } = this.state;

    return (
      <Fragment>
        <div id="calendarMenu" className="calendarMenu bgPrimary flexColumn">
          <ul className="calendarMenuTop liThemeHover0">
            <li className="boxSizing relative hoverBgTertiary" id="calInvite">
              <i className="icon-calendar-confirmed textSecondary" />
              <span className="textPrimary">{_l('待确认日程')}</span>
              <span className="calendarNumber" id="calendarNumber" />
            </li>
            <li className="boxSizing hoverBgTertiary" id="synchronous">
              <i className="icon-calendar-synchro textSecondary" />
              <span className="textPrimary">{_l('同步日程到其他应用')}</span>
            </li>
          </ul>
          <div className="calendarType flex" id="calendarType">
            <div className="calendarTypeTitle boxSizing relative">
              <span className="textSecondary">{_l('分类日程')}</span>
              <i className="icon-edit pointer textSecondary addCalendarType" id="addCalendarType" />
            </div>
            <div className="calendarTypeList" id="calendarTypeList" />
            <div id="hideOneself" className="borderTertiary textSecondary">
              <span className="cbComplete icon-calendar-nocheck textTertiary" title={_l('隐藏自己')} />
              {_l('隐藏我的日程')}
              <span id="allOtherUserDel" className="textSecondary">
                {_l('清空全部')}
              </span>
            </div>
            <div id="tb_OtherUserCalendar" className="textSecondary" />
          </div>
          <div className="selectOther" id="others" title={_l('查看同事日程')}>
            <i className="icon-charger iconSelectOther textTertiary" />
            <span className="textSecondary">{_l('查看同事日程')}</span>
          </div>
        </div>
        <div className="calendarMain boxSizing">
          <div id="invitedMain">
            <span id="exitInvited" className="exitInvited bgColorPrimary">
              &lt; {_l('返回我的日程')}
            </span>
            <ul id="invitedCalendars" className="calendarInvite boxSizing" />
          </div>
          <div id="calendar" />
          <div id="calendarList" />
        </div>
        <div id="calendarLoading" className="boxSizing relative">
          <LoadDiv />
        </div>
        <TaskDetail
          visible={openTaskDetail}
          taskId={taskId}
          openType={3}
          closeCallback={() => this.setState({ openTaskDetail: false })}
        />
      </Fragment>
    );
  }
}
