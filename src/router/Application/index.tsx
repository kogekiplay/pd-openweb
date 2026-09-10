import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Routes } from 'react-router';
import _ from 'lodash';
import { navigateTo } from 'router/navigateTo';
import { LoadDiv } from 'ming-ui';
import ajaxRequest from 'src/api/homeApp';
import FixedContent from 'src/components/FixedContent';
import UnusualContent from 'src/components/UnusualContent';
import UpgradeContent from 'src/components/UpgradeContent';
import { canEditApp } from 'src/pages/worksheet/redux/actions/util';
import { setAppStatus } from '../../pages/PageHeader/redux/action';
import { getIds } from '../../pages/PageHeader/util';
import genRouteComponent from '../genRouteComponent';
import { PORTAL_ROUTE_CONFIG, ROUTE_CONFIG } from './config';

let Application = class Application extends Component<any, any> {
  constructor(props) {
    super(props);
    this.genRouteComponent = genRouteComponent();
    this.state = {
      status: 0, // 0: 加载中 1:正常 2:关闭 3:删除 4:不是应用成员 5:是应用成员但未分配视图
    };
  }

  componentDidMount() {
    let { appId, worksheetId } = this.props.match.params;

    if (md.global.Account.isPortal) {
      appId = md.global.Account.appId;
    }

    if (appId) {
      this.checkApp(appId);
    } // 老路由 先补齐参数

    if (worksheetId) {
      this.compatibleWorksheetRoute(worksheetId);
    }
  }

  /**
   * 检测应用有效性
   */

  componentDidUpdate(prevProps) {
    if (prevProps !== this.props) {
      if (
        this.props.match.params.appId !== prevProps.match.params.appId ||
        (window.redirected && location.href.indexOf('from=system') > -1)
      ) {
        this.checkApp(this.props.match.params.appId);
      }
    }
  }
  /**
   * 检测应用有效性
   */

  checkApp(appId) {
    if (md.global.Account.isPortal) {
      appId = md.global.Account.appId;
    }

    // globals 脚本未就绪时 mdyAPI 会同步抛出，转为 Promise 使 .catch() 可统一捕获
    Promise.resolve()
      .then(() => ajaxRequest.checkApp({ appId }, { silent: true }))
      .then(status => {
        localStorage.removeItem('accessPolicyStatus');

        if ([4].includes(status) && ['/role', '/workflow'].some(path => this.props.location.pathname.includes(path))) {
          navigateTo(`/app/${appId}`);
        }

        this.setState({
          status,
        });
        this.props.setAppStatus(status);
      })
      .catch(err => {
        this.setState({
          status: err.errorCode === 300016 ? err.errorCode : 3,
        });
        this.props.setAppStatus({
          status: err.errorCode === 300016 ? err.errorCode : 3,
        });

        if (err.errorCode === 300016) {
          localStorage.setItem('accessPolicyStatus', err.errorCode);
        }
      });
  }
  /**
   * 兼容老路由补齐参数
   */

  compatibleWorksheetRoute(worksheetId) {
    ajaxRequest
      .getAppSimpleInfo(
        {
          workSheetId: worksheetId,
        },
        {
          silent: true,
        },
      )
      .then(result => {
        const { appId, appSectionId } = result;

        if (!appId || !appSectionId) {
          this.setState({
            status: 3,
          });
        }
      })
      .catch(() => {
        this.setState({
          status: 6,
        });
      });
  }

  render() {
    let { status } = this.state;
    const {
      location: { pathname },
      appPkg,
    } = this.props;
    let { appId } = getIds(this.props);

    if (md.global.Account.isPortal) {
      appId = md.global.Account.appId;
    }

    const { permissionType, fixed, pcDisplay, appStatus } = appPkg;
    const isAuthorityApp = canEditApp(permissionType);

    if (status === 0) {
      return <LoadDiv />;
    }

    if (_.includes([10, 11, 12], appStatus)) {
      return <UpgradeContent appPkg={appPkg} />;
    }

    if (_.includes([20], appStatus)) {
      return <UnusualContent appPkg={appPkg} status={appStatus} appId={appId} />;
    }

    if ((pcDisplay || fixed) && !isAuthorityApp && !_.includes(pathname, 'role')) {
      return <FixedContent appPkg={appPkg} isNoPublish={pcDisplay} />;
    }

    if (_.includes([1], status) || (status === 5 && _.includes(pathname, 'role'))) {
      // 只有从 /app/:appId 这条挂载点进来时才渲染内层路由。
      // 本组件还挂在 /worksheet/:worksheetId 下（老路由，componentDidMount 里
      // 会 compatibleWorksheetRoute 补齐参数后跳走）。v4 时代内层路径是绝对的
      // （/app/:appId/...），天然匹配不到 /worksheet/... 所以那条挂载点下内层
      // 什么都不渲染；v7 的嵌套 Routes 改成相对路径后，全可选的
      // ':groupId?/:worksheetId?/:viewId?' 会匹配到空的剩余段，凭空渲染出应用页。
      // 用 appId 有无来还原 v4 的行为。
      if (!appId) return null;

      return <Routes>{this.genRouteComponent(md.global.Account.isPortal ? PORTAL_ROUTE_CONFIG : ROUTE_CONFIG)}</Routes>;
    }

    return <UnusualContent appPkg={appPkg} status={status} appId={appId} />;
  }
};
Application = connect(
  state => ({
    appPkg: state.appPkg,
  }),
  dispatch => ({
    setAppStatus: status => dispatch(setAppStatus(status)),
  }),
)(Application);
export default Application;
