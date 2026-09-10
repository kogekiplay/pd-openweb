import React, { Component, Fragment } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import { Support } from 'ming-ui';
import AdminTitle from 'src/pages/Admin/common/AdminTitle';
import { navigateTo } from 'src/router/navigateTo';
import { VersionProductType } from 'src/utils/enum';
import { getFeatureStatus } from 'src/utils/project';
import DataBase from './container/DataBase';
import ExplanDetail from './container/ExplanDetail';
import ExplanList from './container/ExplanList';
import ManageDataBase from './container/ManageDataBase';
import './index.less';

export default class ExclusiveComp extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      activeKey: _.get(props.match, 'url').includes('computing') ? 'computing' : 'database',
      refresh: -1,
      baseList: [],
    };
  }

  onClick = active => {
    const { match } = this.props;

    if (active === this.state.activeKey) return;

    navigateTo(`/admin/${active}/${match.params.projectId}`);
  };

  onRefresh = () => this.setState({ refresh: !this.state.refresh });

  renderHeader = () => {
    const { activeKey } = this.state;
    const { match } = this.props;
    if (match.params.explanId) return null;
    const projectId = _.get(match, 'params.projectId');
    const computingFeature = getFeatureStatus(projectId, VersionProductType.exclusiveResource);
    const databaseFeature =
      getFeatureStatus(projectId, VersionProductType.dataBase) &&
      (!window.platformENV.isPlatform || (!window.platformENV.isOverseas && !window.platformENV.isLocal));

    return (
      <div className="orgManagementHeader">
        <div className="tabBox flex">
          {computingFeature && (
            <span
              className={cx('tabItem Hand', { active: activeKey === 'computing' })}
              onClick={() => this.onClick('computing')}
            >
              {_l('算力')}
            </span>
          )}
          {databaseFeature && (
            <span
              className={cx('tabItem Hand', { active: activeKey === 'database' })}
              onClick={() => this.onClick('database')}
            >
              {_l('数据库')}
            </span>
          )}
        </div>
        <div className="refresh Hand Font20 mRight24 " onClick={this.onRefresh}>
          <i className="icon-task-later textTertiary" />
        </div>
        <Support text={_l('帮助')} type={2} href="https://help.mingdao.com/application/exclusive-computing-power" />
      </div>
    );
  };

  render() {
    const { refresh, activeKey } = this.state;
    const { projectId, explanId } = _.get(this.props, 'match.params') || {};
    const hasDataBase =
      getFeatureStatus(projectId, VersionProductType.dataBase) === '1' &&
      (!window.platformENV.isPlatform || (!window.platformENV.isOverseas && !window.platformENV.isLocal));
    const hasComputing = getFeatureStatus(projectId, VersionProductType.exclusiveResource);

    return (
      <div className="orgManagementWrap exclusiveComp">
        <AdminTitle
          prefix={activeKey === 'computing' ? _l('应用管理 - 专属资源 - 算力') : _l('应用管理 - 专属资源 - 数据库')}
        />
        {this.renderHeader()}

        {/* 原来这里是 4 条【裸的】<Route>（不在 Switch 里，靠各自匹配决定渲染谁）。
            v7 的 <Route> 必须放在 <Routes> 内，而且这几条也留不住 ——
            判别段已经被父路由 'computing/:projectId/:explanId?' /
            'database/:projectId/:explanId?' 消费掉了，相对化后全部撞在一起。
            这两个维度组件本来就有：activeKey（computing / database）由 state 维护，
            有没有 id 看父路由给的 explanId。直接按它们渲染，等价且更直白。 */}
        {hasComputing &&
          activeKey === 'computing' &&
          (explanId ? (
            <ExplanDetail projectId={projectId} id={explanId} />
          ) : (
            <ExplanList projectId={projectId} refresh={refresh} />
          ))}
        {hasDataBase &&
          activeKey === 'database' &&
          (explanId ? (
            <ManageDataBase projectId={projectId} id={explanId} />
          ) : (
            <DataBase projectId={projectId} refresh={refresh} />
          ))}
      </div>
    );
  }
}
