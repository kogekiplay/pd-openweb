import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import { Dialog, LoadDiv } from 'ming-ui';
import DocumentTitle from 'ming-ui/components/DocumentTitle';
import ErrorState from 'src/components/errorPage/errorState';
import { htmlDecodeReg, pathCompletion } from 'src/utils/common';
// v2 时代这里是 `$('#calendar').fullCalendar('refetchEvents')`。FullCalendar 7 不再是
// jQuery 插件，那个调用会直接抛 TypeError —— 迁移时漏改了这两处，靠给 `$` 标上真实
// 类型（types/global.d.ts）才暴露出来。refetchEvents() 在没有日历实例时安全空转。
import { refetchEvents } from '../calendar/fcInstance';
import { Config, getCalendarDetail, getParamsFromUrl } from './common';
import CalendarDetail from './root';

class Container extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      noAuth: false,
      data: null,
    };
  }
  dialogRef = React.createRef<React.ComponentRef<typeof Dialog>>();

  override componentDidMount() {
    this.fetchData(true);
    const { exitCallback, saveCallback, deleteCallback } = Config;
    const dialog = $('.calendarEdit')[0];

    if (dialog) {
      // dialogCenter func
      Config.dialogCenter = () => {};

      Config.exitCallback = function () {
        $('.calendarEdit').parent().remove();
        exitCallback();
      };

      Config.deleteCallback = function () {
        $('.calendarEdit').parent().remove();
        deleteCallback();
      };

      Config.saveCallback = function () {
        if (_.isFunction(saveCallback)) saveCallback();
      };

      Config.cancelCallback = Config.closeDialog = function () {
        $('.calendarEdit').parent().remove();
      };
    }
  }

  override componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.calendarId !== prevProps.calendarId || this.props.recurTime !== prevProps.recurTime) {
        this.fetchData(true, this.props);
      }
    }
  }

  fetchData(isShowLoading: boolean, props?) {
    const { calendarId, recurTime } = props || this.props;

    if (isShowLoading) {
      this.setState({
        isLoading: true,
        noAuth: false,
      });
    }

    getCalendarDetail(calendarId, recurTime)
      .then(({ data }) => {
        data.calendar.title = htmlDecodeReg(data.calendar.title);
        this.setState({
          isLoading: false,
          data,
        });
      })
      .catch(() => {
        this.setState({
          isLoading: false,
          noAuth: true,
        });
      });
  }

  renderContent() {
    const { isLoading, data, noAuth } = this.state;

    // 加载中
    if (isLoading) {
      return <LoadDiv className="pTop30 pBottom30" />;
    }

    // 无权限
    if (noAuth) {
      return <ErrorState text={_l('您的权限不足或此日程已被删除，无法查看')} className="h100 pTop30 pBottom30" />;
    }

    return <CalendarDetail data={data} reFetchData={this.fetchData.bind(this)} />;
  }

  override render() {
    const { data } = this.state;
    let title = _l('日程详情');

    if (data) {
      title = data.calendar.title;
    }

    if (Config.isDetailPage) {
      return <DocumentTitle title={title}>{this.renderContent()}</DocumentTitle>;
    } else {
      return (
        <Dialog
          visible
          dialogClasses="calendarEdit"
          width={800}
          showFooter={false}
          closable={false}
          overlayClosable={true}
          handleClose={() => {
            this.props.handleClose && this.props.handleClose();
            $('.calendarEdit').parent().remove();
          }}
          ref={this.dialogRef}
          type="fixed"
          onCancel={() => {
            this.props.handleClose && this.props.handleClose();
            $('.calendarEdit').parent().remove();
          }}
        >
          {this.renderContent()}
        </Dialog>
      );
    }
  }
}

export default function (options) {
  const defaults = {
    container: '',
    isDetailPage: false,

    calendarId: '',
    recurTime: '',

    exitCallback: null,
    deleteCallback: null,
    saveCallback: null,
  };

  Object.assign(Config, defaults, options);

  if (Config.isDetailPage && Config.container) {
    Object.assign(Config, getParamsFromUrl());
    Config.exitCallback = Config.deleteCallback = function () {
      window.location.href = pathCompletion('/apps/calendar/home');
    };
  } else {
    const { saveCallback } = Config;

    Config.exitCallback = function () {
      // 日程首页的一些操作
      if (location.href.indexOf('/apps/calendar/home') !== -1) {
        $('.showActiveTitleMessage').remove();
        refetchEvents();
        if (window.localStorage.getItem === 'list' && _.isFunction(saveCallback)) {
          saveCallback();
        }
      } else if (_.isFunction(saveCallback)) {
        saveCallback();
      }
    };

    Config.deleteCallback = function () {
      // 日程首页的一些操作
      if (location.href.indexOf('/apps/calendar/home') !== -1) {
        $('.showActiveTitleMessage').remove();
        refetchEvents();
        if (window.localStorage.getItem === 'list' && _.isFunction(saveCallback)) {
          saveCallback();
        }
      } else if (_.isFunction(saveCallback)) {
        saveCallback();
      }
    };
  }

  const { isDetailPage, container, calendarId, recurTime, handleClose } = Config;
  const root = createRoot(isDetailPage ? container : document.createElement('div'));

  root.render(<Container calendarId={calendarId} recurTime={recurTime} handleClose={handleClose} />);
}
