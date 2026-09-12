import React, { lazy, PureComponent, Suspense } from 'react';
import { shallowEqual } from 'react-redux';
import { Route, Routes } from 'react-router';
import _ from 'lodash';
import { navigateTo } from 'router/navigateTo';
import { LoadDiv, WaterMark } from 'ming-ui';
import withoutPermission from 'src/pages/worksheet/assets/withoutPermission.png';
import expandRoutePaths from 'src/router/expandRoutePaths';
import { RouteElement } from 'src/router/routeProps';
import { addSubPathOfRoute } from 'src/utils/common';
import { getCurrentProject, getFeatureStatus } from 'src/utils/project';
import AdminCommon from './common/common';
import Empty from './common/TableEmpty';
import Config from './config';
import { getProjectIdFromPath } from './config';
import { PERMISSION_ENUM, ROUTE_CONFIG } from './enum';
import Menu from './menu';
import ApplyRole from './organization/roleAuth/apply';
import MyRole from './organization/roleAuth/myRole';
import { menuList } from './router.config.js';
import { allPlatformsHidden } from './util';
import './index.less';

// 【按工厂缓存，不要每次渲染都 lazy() 一个新的】本函数是在 render 里被调的
//（childRoutes.flatMap(...)），而 lazy() 每调一次都产出新组件类型、必然先 suspend。
// v7 的导航包在 startTransition 里，撞上一个已挂载的 <Suspense> 边界就会
// 「resolve → 重渲染 → 又造新 lazy → 又 suspend」无限打转、永不 commit。
// 这里今天侥幸没炸，只是因为 withParams 每次也返回新的组件类型，边界跟着重新挂载、
// 于是允许直接显示 fallback。这个侥幸不能依赖 —— 同一个坑已经在
// src/router/genRouteComponent.tsx 和 src/pages/Personal/index.tsx 各炸过一次。
// 顺带也省掉了每次渲染整棵后台页面重新挂载的开销。
const lazyCache = new Map();
const getComponent = component => {
  if (!lazyCache.has(component)) lazyCache.set(component, lazy(component));

  return lazyCache.get(component);
};

const withParams = (Component, params) => {
  const ParamsComponent = props => (
    <Suspense fallback={<LoadDiv className="mTop10" />}>
      <Component {...props} {...params} />
    </Suspense>
  );

  return ParamsComponent;
};

const CommonEmpty = (
  <div className="commonIndexEmpty">
    <Empty
      detail={{
        icon: 'icon-task_custom_ic_task_internet',
        desc: _l('您的账号不是该组织成员'),
      }}
    />
  </div>
);
const NoPermission = (
  <div className="noPermissionWrapper">
    <img className="img" src={withoutPermission} />
    <div className="textSecondary Font17 mTop30">{_l('无权限，请联系管理员')}</div>
  </div>
);
export default class AdminEntryPoint extends PureComponent<any, any> {
  state = {
    isLoading: true,
    authority: [],
    routeKeys: [],
  };

  componentDidMount() {
    if (_.isNull(localStorage.getItem('adminList_isUp'))) {
      safeLocalStorageSetItem('adminList_isUp', true);
    }

    $('html').addClass('AppAdmin');
    this.init();
  }

  componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const projectId = getProjectIdFromPath();

      if (projectId !== Config.projectId) {
        this.setState({
          isLoading: true,
        });
        this.init();
      } else {
        Config.getParams();
      }
    }
  }

  componentWillUnmount() {
    $('html').removeClass('AppAdmin');
  }

  init() {
    AdminCommon.getAuthority().then(authority => {
      this.setState({
        isLoading: false,
        authority,
        routeKeys: this.getRouterKeys(authority),
      });
    });
  } //获取权限模块

  getRouterKeys(authority) {
    const projectId = getProjectIdFromPath();

    if (_.isArray(authority)) {
      let keys = [];
      authority.map(item => {
        keys = keys.concat(ROUTE_CONFIG[item] || []);
      });

      const subMenuArray = _.flatten(menuList.map(item => item.subMenuList));

      const result = _.uniq(keys).filter(key => {
        if (window.platformENV.isOverseas || window.platformENV.isLocal) {
          if (key === 'aggregationTable' && !md.global.Config.EnableDataPipeline) return;
          if (key === 'billinfo' && !window.platformENV.isPlatform) return;
          if (key === 'weixin' && md.global.SysSettings.hideWeixin) return;
          if (key === 'platformintegration' && allPlatformsHidden()) return;
        }

        if (!window.platformENV.isOverseas && !window.platformENV.isLocal && key === 'quota') return;
        const itemMenu = subMenuArray.filter(sub => sub.key === key)[0] || {};
        let featureType = getFeatureStatus(projectId, itemMenu.featureId);
        let hasFeatureIdsAuth = false;

        if (itemMenu.featureIds) {
          itemMenu.featureIds
            .filter(l => !window.platformENV.isPlatform || !itemMenu.platformHiddenIds.includes(l))
            .forEach(l => {
              let itemFeatureType = getFeatureStatus(projectId, l);

              if (itemFeatureType) {
                hasFeatureIdsAuth = true;
                featureType = featureType ? Math.min(itemFeatureType, featureType).toString() : itemFeatureType;
              }
            });
        }

        if (itemMenu.featureId && !featureType) return false;
        if (itemMenu.featureIds && !hasFeatureIdsAuth) return false;
        return true;
      });

      return result;
    }
  }

  renderHomeContent(routes) {
    const { authority } = this.state; // 过滤掉所有平台都被隐藏时的 platformintegration 菜单项

    const filteredRoutes = _.map(routes, route => ({
      ...route,
      subMenuList: _.filter(
        route.subMenuList || [],
        item => item.key !== 'platformintegration' || !allPlatformsHidden(),
      ),
    }));

    const childRoutes = _.reduce(
      filteredRoutes,
      (result, { subMenuList = [] }) => {
        return result.concat(...subMenuList.map(item => item.routes));
      },
      [],
    );

    const isExtend = JSON.parse(localStorage.getItem('adminList_isUp'));

    const projectId = getProjectIdFromPath();

    return (
      <WaterMark projectId={projectId}>
        <div className="adminMainContent w100">
          <div className="flexRow w100 mainContainerWrapper">
            <Menu isExtend={isExtend} menuList={filteredRoutes} />
            <div id="mainContainer" className="Relative">
              <Routes>
                {/* 子路径已相对化（见 router.config.ts），这里不能再套 addSubPathOfRoute ——
                    子路径部署在父路由 /admin/* 之下，子路径本身不带 /admin 前缀，
                    也就不该再被拼上部署子路径（那是父路由那一层的事）。
                    expandRoutePaths 负责摊平数组 path 并按「非精确」补 /*。 */}
                {childRoutes.flatMap(({ path, exact, component }) => {
                  const Comp = withParams(getComponent(component), { authority });

                  return expandRoutePaths({ path, exact }).map(p => (
                    <Route key={p} path={p} element={<RouteElement component={Comp} />} />
                  ));
                })}
              </Routes>
            </div>
          </div>
        </div>
      </WaterMark>
    );
  }

  renderRoutes() {
    const { routeKeys, authority = [] } = this.state; // 根据权限控制模块展示

    const routesWithAuthority = _.reduce(
      menuList,
      (result, { title, subMenuList = [], key, icon }) => {
        let item = {
          title,
          subMenuList: subMenuList.filter(item => routeKeys.includes(item.key)),
          key,
          icon,
        };
        return result.concat([item]);
      },
      [],
    );

    return (
      // 本组件挂在父路由 '/admin/*' 之下，所以这里写相对路径、也不再套
      // addSubPathOfRoute（部署子路径由父路由那层处理）。
      // 最后那条原本是 '/admin/:routeType/:projectId'，作用是「其余都走后台主内容」，
      // 相对化后就是 '*'（v7 里排序恒定最低，与放在 Switch 末尾同效）。
      <Routes>
        <Route path="mycharacter/:projectId" element={<MyRole authority={authority} />} />
        <Route path="apply/:projectId/:roleId?" element={<ApplyRole authority={authority} />} />
        <Route path="*" element={this.renderHomeContent(routesWithAuthority)} />
      </Routes>
    );
  }

  getCurrentAuth(routeKeys = []) {
    const pathNameArr = (location.pathname.toLocaleLowerCase().split('/') || []).filter(item => item);
    const currentItem = routeKeys.filter(item => pathNameArr.includes(item.toLocaleLowerCase()));
    return !currentItem.length;
  }

  render() {
    const { authority = [], isLoading, routeKeys } = this.state;
    let { isSuperAdmin } = getCurrentProject(Config.projectId, true);

    if (isLoading) {
      return <LoadDiv className="mTop10" />;
    } //没有任何权限

    if (!authority.length) {
      return NoPermission;
    } //不是组织成员

    if (authority.includes(PERMISSION_ENUM.NOT_MEMBER)) {
      return CommonEmpty;
    } //没有权限，可以申请管理员

    if (authority.includes(PERMISSION_ENUM.SHOW_APPLY) && !location.href.includes('admin/apply')) {
      navigateTo('/admin/apply/' + Config.projectId);
      return null;
    } //有权限，但是没有组织后台菜单权限

    if (authority.includes(PERMISSION_ENUM.SHOW_MY_CHARACTER) && !location.href.includes('admin/mycharacter')) {
      navigateTo('/admin/mycharacter/' + Config.projectId);
      return null;
    } //超管跳转到首页

    if ((location.href.includes('admin/index') || location.href.includes('admin/apply')) && isSuperAdmin) {
      navigateTo('/admin/home/' + Config.projectId);
      return null;
    }

    if (
      this.getCurrentAuth(routeKeys) &&
      routeKeys.filter(route => !ROUTE_CONFIG[PERMISSION_ENUM.CAN_PURCHASE].includes(route)).length
    ) {
      navigateTo('/admin/' + (routeKeys.includes('home') ? 'home' : routeKeys[0]) + '/' + Config.projectId);
      return null;
    }

    return this.renderRoutes();
  }
}
