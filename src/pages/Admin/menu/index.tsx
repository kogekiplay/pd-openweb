import React, { Component } from 'react';
import { shallowEqual } from 'react-redux';
import { generatePath, matchPath } from 'react-router';
import cx from 'classnames';
import _ from 'lodash';
import Trigger from '@rc-component/trigger';
import { MdLink, UpgradeIcon } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import { navigateTo } from 'src/router/navigateTo';
import { getPathWithoutSubPath } from 'src/utils/common';
import { VersionProductType } from 'src/utils/enum';
import { getCurrentProject, getFeatureStatus } from 'src/utils/project';
import withRouter from '../../../router/withRouter';
import { getProjectIdFromPath } from '../config';
import './index.less';

// 路由迁到 v7 后，router.config.ts 里的 path 已经【相对化】了（'home/:projectId'
// 而不是 '/admin/home/:projectId'）—— 因为 v7 的嵌套 Routes 匹配的是父路由
// '/admin/*' 消费之后剩下的那段。而这里是拿它去比【完整 pathname】做菜单高亮，
// 不补回前缀就一条都匹配不上、菜单再也不会高亮。
const toAbsoluteAdminPath = path => (!path ? '' : path.startsWith('/') ? path : `/admin/${path}`);

/**
 * 【这里必须用 react-router 的 matchPath / generatePath，不能再用 path-to-regexp】
 *
 * router.config.ts 里的 path 现在是 v7 语法，而 v7 的通配段 `/*` 在
 * path-to-regexp 6 里是个孤立的 MODIFIER —— compile('structure/*') 和
 * pathToRegexp('/admin/structure/*') 都会当场抛
 * 「Unexpected MODIFIER at 10, expected END」。
 * 这个异常是在渲染期抛的，被 ErrorBoundary 接住后整个后台变成「程序错误」。
 * 迁移时只把「相对路径要补回 /admin 前缀」这一半改了，漏了「路径语法也换了」这一半。
 *
 * 参数键也跟着变：v4 的路径是 '/admin/structure/(.*)'，projectId 落在
 * path-to-regexp 的无名分组上、键名是下标 '0'；v7 的通配段键名是 '*'。
 */
const isRoutePathMatched = (path, pathname) => !!matchPath(toAbsoluteAdminPath(path), getPathWithoutSubPath(pathname));

const buildMenuHref = (pattern, projectId) =>
  generatePath(pattern, pattern.includes(':projectId') ? { projectId } : { '*': projectId });

let AdminLeftMenu = class AdminLeftMenu extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      currentCompanyName: '',
      isExtend: this.props.isExtend,
    };
  }

  componentDidMount() {
    const {
      location: { pathname },
      menuList,
    } = this.props;
    // 父路由已改成 '/admin/*'，不再提供 projectId 参数，从路径取（同值）
    const projectId = getProjectIdFromPath(pathname);
    const currentProject = getCurrentProject(projectId, true);
    this.setState({
      currentCompanyName: currentProject.companyName,
    });

    const nav = _.find(menuList, item =>
      _.some(item.subMenuList, it => _.some(it.routes, ({ path }) => isRoutePathMatched(path, pathname))),
    );

    if (pathname.indexOf('home') > -1) {
      this.setState({
        userExpand: true,
      });
    }

    if (pathname.indexOf('home') === -1 && !_.isEmpty(nav)) {
      this.setState({
        [`${nav.key}Expand`]: true,
      });
    }
  }

  componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const {
        location: { pathname },
        menuList,
      } = this.props;
      const nav = _.find(menuList, item =>
        _.some(item.subMenuList, it => _.some(it.routes, ({ path }) => isRoutePathMatched(path, pathname))),
      );

      if (pathname.indexOf('home') === -1 && !_.isEmpty(nav)) {
        this.setState({
          [`${nav.key}Expand`]: true,
        });
      }
    }
  }

  renderLinkItem = ({ icon, name, menuPath, routes, featureId, key, hasBeta = false, featureIds }) => {
    const { subListVisible, isExtend } = this.state;
    const {
      location: { pathname },
    } = this.props;
    // 同上：父路由 '/admin/*' 不再提供 projectId
    const projectId = getProjectIdFromPath(pathname);
    if (
      key === 'billinfo' &&
      (window.platformENV.isLocal || window.platformENV.isOverseas) &&
      !window.platformENV.isPlatform
    )
      return;
    if (
      key === 'weixin' &&
      (window.platformENV.isLocal || window.platformENV.isOverseas) &&
      md.global.SysSettings.hideWeixin
    )
      return;

    if (
      key === 'platformintegration' &&
      (window.platformENV.isLocal || window.platformENV.isOverseas) &&
      md.global.SysSettings.hideWorkWeixin &&
      md.global.SysSettings.hideDingding &&
      md.global.SysSettings.hideWelink &&
      md.global.SysSettings.hideFeishu &&
      md.global.SysSettings.hideLark &&
      md.global.SysSettings.hideMicrosoftEntra
    ) {
      return;
    }

    const isActive = () => _.some(routes, route => isRoutePathMatched(route.path, pathname));

    let routeIndex = undefined;
    let featureType = getFeatureStatus(projectId, featureId);

    if (featureIds) {
      featureIds.forEach((l, i) => {
        let itemFeatureType = getFeatureStatus(projectId, l);

        if (itemFeatureType) {
          routeIndex === undefined && (routeIndex = i);
          featureType = featureType ? Math.min(itemFeatureType, featureType).toString() : itemFeatureType;
        }
      });
    }

    const route = routes[routeIndex || 0] || {};
    const path = buildMenuHref(toAbsoluteAdminPath(menuPath || route.path), projectId);
    const isHome = key === 'home';

    const platIntegrationUpgrade = _.every(
      [
        VersionProductType.workwxIntergration,
        VersionProductType.dingIntergration,
        VersionProductType.feishuIntergration,
        VersionProductType.WelinkIntergration,
      ],
      item => getFeatureStatus(projectId, item) === '2',
    );

    const licenseType = (md.global.Account.projects.find(o => o.projectId === projectId) || {}).licenseType;

    const isFreeUpgrade = licenseType === 0 && _.includes(['groups', 'orgothers', 'loginlog', 'orglog'], key);

    return (
      <li
        key={key}
        className={cx('item', {
          active: isActive() && subListVisible,
        })}
      >
        <MdLink
          to={path}
          className={cx('stopPropagation', {
            pLeft12: isHome,
            pLeft42: !isHome,
            'activeItem bold': isActive(),
            activeExtend: isActive() && isExtend,
          })}
          onClick={() =>
            this.setState({
              subListVisible: false,
              menuGroupKey: null,
            })
          }
        >
          {icon && <i className={cx('Font20 textPrimary mRight10 homeIcon', icon)} />}
          {!isExtend && key === 'home' ? (
            ''
          ) : (
            <div className="subName">
              {name}
              {hasBeta && <i className="icon-beta1 betaIcon" />}
              {(featureType === '2' || (key === 'platformintegration' && platIntegrationUpgrade) || isFreeUpgrade) && (
                <UpgradeIcon />
              )}
            </div>
          )}
        </MdLink>
      </li>
    );
  };

  handleTransition() {
    this.setState(
      {
        isExtend: !this.state.isExtend,
      },
      () => {
        safeLocalStorageSetItem('adminList_isUp', this.state.isExtend);
      },
    );
  }

  render() {
    const { currentCompanyName, isExtend, subListVisible, menuGroupKey } = this.state;
    const { menuList = [], match, location } = this.props;
    const { params } = match;
    const { pathname } = location;
    return (
      <div id="menuList" className={cx(isExtend ? 'extendList' : 'closeList')}>
        <div className="h100 Relative menuContainer">
          <div className="title">
            <div
              className="companyName Hand"
              onClick={() => {
                navigateTo(`/admin/home/${params.projectId}`);
              }}
            >
              {currentCompanyName}
            </div>
            <Tooltip
              placement="right"
              align={{
                offset: [10, 0],
              }}
              title={isExtend ? _l('隐藏侧边栏') : _l('展开侧边栏')}
            >
              <span
                className={cx(
                  'Hand Font12 textSecondary titleIconBox Block',
                  isExtend ? 'icon-back-02' : 'icon-next-02',
                )}
                onClick={this.handleTransition.bind(this)}
              ></span>
            </Tooltip>
          </div>
          <div className="listContainer pTop8 pBottom30">
            {isExtend
              ? menuList.map((item, index) => {
                  const { key, title, icon } = item;
                  let { subMenuList = [] } = item;
                  subMenuList = _.filter(
                    subMenuList,
                    ({ featureId, key }) =>
                      (!featureId || (featureId && getFeatureStatus(params.projectId, featureId))) &&
                      !(!window.platformENV.isPlatform && key === 'billinfo'),
                  );
                  return (
                    <div
                      key={index}
                      className={cx({
                        Hidden: !subMenuList.length,
                      })}
                    >
                      {title ? (
                        <div
                          className="subTitle flexRow alignItemsCenter Hand"
                          onClick={() => {
                            this.setState({
                              [`${key}Expand`]: !this.state[`${key}Expand`],
                            });
                          }}
                        >
                          <i className={cx('Font20 textPrimary mRight10', icon)} />
                          <span className="flex">{title}</span>
                          <i
                            className={cx('expandIcon Font16 textSecondary mRight12', {
                              'icon-arrow-up-border': !this.state[`${key}Expand`],
                              'icon-arrow-down-border': this.state[`${key}Expand`],
                            })}
                          />
                        </div>
                      ) : (
                        _.map(subMenuList, this.renderLinkItem)
                      )}
                      {key === 'home' ? (
                        ''
                      ) : (
                        <ul
                          className="manageItems overflowHidden"
                          style={{
                            height: !this.state[`${key}Expand`] ? 0 : subMenuList.length * 48,
                          }}
                        >
                          {_.map(subMenuList, this.renderLinkItem)}
                        </ul>
                      )}
                    </div>
                  );
                })
              : menuList.map(item => {
                  const { key, title, icon, subMenuList = [] } = item;

                  const currentPathNames = _.reduce(
                    subMenuList,
                    (result, { routes = [] }) => {
                      let temp = routes.map(r => r.path);
                      return result.concat(temp);
                    },
                    [],
                  );

                  return (
                    <div
                      key={key}
                      className={cx({
                        Hidden: !subMenuList.length,
                      })}
                    >
                      {key === 'home' ? (
                        _.map(subMenuList, this.renderLinkItem)
                      ) : (
                        <Trigger
                          action={['click']}
                          popupVisible={subListVisible && menuGroupKey === key}
                          onPopupVisibleChange={visible =>
                            this.setState({
                              subListVisible: visible,
                            })
                          }
                          popup={
                            <div className="hoverMenuWrap">
                              <div className="textTertiary Font12 pLeft20 mBottom10">{title}</div>
                              <ul
                                className="manageItems overflowHidden"
                                style={{
                                  height: subMenuList.length * 48,
                                }}
                              >
                                {_.map(subMenuList, this.renderLinkItem)}
                              </ul>
                            </div>
                          }
                          popupAlign={{
                            points: ['tr', 'br'],
                            offset: [-40, -40],
                            overflow: {
                              adjustX: true,
                              adjustY: true,
                            },
                          }}
                        >
                          <div
                            className={cx('shrinkNav flexRow alignItemsCenter Hand', {
                              activeSubTitle: _.some(currentPathNames, path => isRoutePathMatched(path, pathname)),
                            })}
                            onMouseEnter={() =>
                              this.setState({
                                subListVisible: true,
                                menuGroupKey: key,
                              })
                            }
                          >
                            <i className={cx('Font20 textPrimary mRight10', icon)} />
                          </div>
                        </Trigger>
                      )}
                    </div>
                  );
                })}
          </div>
        </div>
      </div>
    );
  }
};
AdminLeftMenu = withRouter(AdminLeftMenu);
export default AdminLeftMenu;
