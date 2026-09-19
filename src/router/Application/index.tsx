import React, { Component } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import { Routes } from 'react-router';
import { ConfigProvider } from 'antd';
import _ from 'lodash';
import { AppThemeScope } from 'src/common/theme';
import { navigateTo } from 'router/navigateTo';
import { LoadDiv } from 'ming-ui';
import ajaxRequest from 'src/api/homeApp';
import FixedContent from 'src/components/FixedContent';
import UnusualContent from 'src/components/UnusualContent';
import UpgradeContent from 'src/components/UpgradeContent';
import { canEditApp } from 'src/pages/worksheet/redux/actions/util';
import type { RootState } from 'src/redux/types';
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

    this.syncAppScopeClass();
  }

  componentWillUnmount() {
    document.body.classList.remove('inAppScope');
  }

  /**
   * 从 localStorage 的 appCache-{appId} 里取应用色。
   *
   * 【为什么需要兜底】取应用详情的是应用顶栏组件（AppPkgHeader/AppDetail），
   * 而工作流页 / 用户页【不渲染顶栏】。直接刷新这两个页面时 appPkg 一直是
   * defaultState，整站就停在平台蓝 —— 张奇实测到的「刷新主题就消失」。
   *
   * 这份缓存是产品自己维护的（AppDetail 读它做首屏预填），不是我们新造的存储。
   * 它可能过期，但只在「真详情拿不到」时才用；下次经过带顶栏的页面就会刷新。
   *
   * 按 appId 记一次，避免每次 render 都读 localStorage。
   */
  cachedIconColorCache: { appId?: string; color?: string } = {};

  cachedIconColor(): string | undefined {
    let { appId } = getIds(this.props);

    if (md.global.Account.isPortal) {
      appId = md.global.Account.appId;
    }

    if (!appId) return undefined;

    if (this.cachedIconColorCache.appId !== appId) {
      const cached = window.safeParse(localStorage.getItem(`appCache-${appId}`));
      this.cachedIconColorCache = { appId, color: _.get(cached, 'iconColor') };
    }

    return this.cachedIconColorCache.color;
  }

  /**
   * 应用区域的内容面板样式靠 body 上这个类挂（样式在 src/router/index.less）。
   *
   * 【为什么不能无条件加】本组件还挂在 /worksheet/:worksheetId 这条老路由上，
   * 那时没有 appId、render 返回 null —— 页面其实是别的东西，不该套应用面板。
   * 判断口径和 renderContent 里那段保持一致（含 isPortal 的特殊取法）。
   */
  syncAppScopeClass() {
    let { appId } = getIds(this.props);

    if (md.global.Account.isPortal) {
      appId = md.global.Account.appId;
    }

    document.body.classList.toggle('inAppScope', !!appId);
  }

  /**
   * 检测应用有效性
   */

  componentDidUpdate(prevProps) {
    this.syncAppScopeClass();

    if (!shallowEqual(prevProps, this.props)) {
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

  checkApp(appId: string) {
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

  compatibleWorksheetRoute(worksheetId: string) {
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
    // 【应用主题色的唯一注入点】一处输入，两路输出：
    //   · ConfigProvider -> antd 组件自己的 token 系统
    //   · AppThemeScope  -> 我们那套 CSS 变量（渲染 null，只有副作用）
    // 两者喂的是【同一个 iconColor】、经【同一套 antd 算法】算出来的，
    // 所以 antd 组件和我们的 Less 不会分叉成两种颜色 —— 那正是这次要修的病。
    //
    // 包在最外层（而不是只包 Routes 那一支）是有意的：升级提示、异常页、
    // 未发布占位也都属于这个应用，应当同色。
    // id 有无 = 应用详情还在不在 store 里。清空后 iconColor 会回落成平台蓝，
    // 那时不能拿它去覆盖已经刷上去的应用色，详见 AppThemeScope 里的说明。
    const { iconColor, id: loadedAppId } = this.props.appPkg;
    const seed = loadedAppId ? iconColor : this.cachedIconColor();

    return (
      <ConfigProvider theme={{ token: { colorPrimary: seed || iconColor } }}>
        <AppThemeScope seed={seed} loaded={!!seed} />
        {this.renderContent()}
      </ConfigProvider>
    );
  }

  renderContent() {
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
  (state: RootState) => ({
    appPkg: state.appPkg,
  }),
  dispatch => ({
    setAppStatus: status => dispatch(setAppStatus(status)),
  }),
)(Application);
export default Application;
