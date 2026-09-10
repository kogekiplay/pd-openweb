import React from 'react';
import DocumentTitle from 'react-document-title';
import { Route, Routes } from 'react-router';
import _ from 'lodash';
import { Support } from 'ming-ui';
import ErrorBoundary from 'ming-ui/components/ErrorBoundary';
import { getMyPermissions } from 'src/components/checkPermission';
import { hasPermission } from 'src/components/checkPermission';
import { upgradeVersionDialog } from 'src/components/upgradeVersion';
import { PERMISSION_ENUM } from 'src/pages/Admin/enum';
import { integrationConfig } from 'src/pages/integration/config.js';
import { navigateTo } from 'src/router/navigateTo';
import { addSubPathOfRoute, emitter } from 'src/utils/common';
import { VersionProductType } from 'src/utils/enum';
import { getCurrentProject } from 'src/utils/project';
import { getFeatureStatus } from 'src/utils/project';
import APILibrary from './apiIntegration';
import ConnectList from './apiIntegration/ConnectList';
import Connector from './dataIntegration/connector';
import DataMirror from './dataIntegration/dataMirror';
import DataSource from './dataIntegration/source';
import Stats from './dataIntegration/stats';
import SyncTask from './dataIntegration/task';
import TaskCon from './dataIntegration/TaskCon';
import Sidenav from './Sidenav';
import './svgIcon';

const ROUTE_CONFIG_PATH = {
  connectList: 'connectList',
  dataConnect: 'dataConnect',
  taskCon: 'taskCon',
  task: 'task',
  source: 'source',
  dataMirror: 'dataMirror',
  stats: 'stats',
};
const TYPE_TO_COMP = {
  connectList: ConnectList,
  dataConnect: Connector,
  taskCon: TaskCon,
  task: SyncTask,
  source: DataSource,
  dataMirror: DataMirror,
  stats: Stats,
};
const ENABLE_DATAPIPELINE_KEYS = ['dataConnect', 'taskCon', 'task', 'source', 'dataMirror', 'stats'];

const getRoutes = param => {
  let components = [];
  _.keys(ROUTE_CONFIG_PATH).forEach((key, i) => {
    const path = ROUTE_CONFIG_PATH[key];
    const Component = TYPE_TO_COMP[key];
    const featureType = getFeatureStatus(param.currentProjectId, VersionProductType.dataMirror);
    const noRender = !featureType && key === 'dataMirror';

    if (!noRender) {
      components.push(
        <Route
          key={i}
          path={path}
          component={() => {
            return (window.platformENV.isOverseas || window.platformENV.isLocal) &&
              !md.global.Config.EnableDataPipeline &&
              ENABLE_DATAPIPELINE_KEYS.includes(key) ? (
              <div className="flexColumn alignItemsCenter justifyContentCenter h100">
                {upgradeVersionDialog({
                  hint: window.platformENV.isPlatform ? (
                    _l('数据集成服务未部署，暂不可用')
                  ) : (
                    <span>
                      {_l('数据集成服务未部署，请参考')}
                      <Support
                        type={3}
                        href={
                          window.platformENV.isOverseas
                            ? 'https://docs-pd.nocoly.com/faq/integrate/flink'
                            : 'https://docs-pd.mingdao.com/faq/integrate/flink'
                        }
                        text={_l('帮助')}
                      />
                    </span>
                  ),
                  dialogType: 'content',
                })}
              </div>
            ) : (
              <Component {...param} />
            );
          }}
        />,
      );
    }
  });
  return components;
};

export default class HubContainer extends React.Component<any, any> {
  constructor(props) {
    super(props);

    const projectInfo = this.getProjectInfo();

    this.state = {
      currentProjectId: projectInfo.projectId,
    };
  }

  componentDidMount() {
    $('html').addClass('integration');
    this.loadPermissions();
    emitter.addListener('CHANGE_CURRENT_PROJECT', this.loadPermissions);
  }

  componentWillUnmount() {
    $('html').removeClass('integration');
    emitter.removeListener('CHANGE_CURRENT_PROJECT', this.loadPermissions);
  }

  getProjectInfo = () => {
    const projectInfo = !_.isEmpty(getCurrentProject(localStorage.getItem('currentProjectId')))
      ? getCurrentProject(localStorage.getItem('currentProjectId'))
      : _.get(md, 'global.Account.projects.0');
    return projectInfo || {};
  };

  loadPermissions = () => {
    const projectInfo = this.getProjectInfo();
    this.setState({ currentProjectId: projectInfo.projectId });
  };

  render() {
    // 父路由从 '/integration/:type?/:listType?' 改成了 '/integration/*'
    //（原来父子深度相同、父会把 URL 吃光，子路由无段可匹配），所以 type 不再
    // 由路由参数提供。它本来就是 /integration/ 之后的那一段，直接从路径取。
    const seg = location.pathname.split('/');
    const type = seg[seg.indexOf('integration') + 1] || '';
    const info = integrationConfig.find(o => o.type === type) || {};
    const { currentProjectId } = this.state;
    const myPermissions = getMyPermissions(currentProjectId);
    const menuAuth = {
      noCreateTaskMenu: !hasPermission(myPermissions, PERMISSION_ENUM.CREATE_SYNC_TASK),
      noSyncTaskMenu:
        !hasPermission(myPermissions, PERMISSION_ENUM.CREATE_SYNC_TASK) &&
        !hasPermission(myPermissions, PERMISSION_ENUM.MANAGE_SYNC_TASKS),
      noSourceMenu:
        !hasPermission(myPermissions, PERMISSION_ENUM.CREATE_SYNC_TASK) &&
        !hasPermission(myPermissions, PERMISSION_ENUM.MANAGE_DATA_SOURCES),
      noMirrorMenu: !hasPermission(myPermissions, PERMISSION_ENUM.CREATE_SYNC_TASK),
      noStatsMenu: !hasPermission(myPermissions, PERMISSION_ENUM.CREATE_SYNC_TASK),
    };
    // 同上：父路由改成 '/integration/*' 后 match.params 里的 type / listType 没了。
    // 下游 apiIntegration/index.tsx 读 match.params.listType 来决定选中哪个标签页，
    // 这里把两个都从路径补回去，形状不变，下游不用改。
    const param = {
      ...this.props,
      match: {
        ...(this.props as any).match,
        params: {
          ...((this.props as any).match || {}).params,
          type,
          listType: seg[seg.indexOf('integration') + 2] || '',
        },
      },
      currentProjectId,
      myPermissions,
    };

    if ((type === 'dataMirror' && menuAuth.noMirrorMenu) || (type === 'stats' && menuAuth.noStatsMenu)) {
      navigateTo('/integration');
      return;
    }

    if (
      (type === 'dataConnect' && menuAuth.noCreateTaskMenu) ||
      (type === 'task' && menuAuth.noSyncTaskMenu) ||
      (type === 'source' && menuAuth.noSourceMenu)
    ) {
      const navigateLink = !menuAuth.noCreateTaskMenu
        ? '/integration/dataConnect'
        : !menuAuth.noSyncTaskMenu
          ? '/integration/task'
          : !menuAuth.noSourceMenu
            ? '/integration/source'
            : '/integration';
      navigateTo(navigateLink);
      return;
    }

    return (
      <div className="flexRow h100">
        <DocumentTitle title={!info.txt ? _l('集成') : `${_l('集成')}-${info.txt}`} />
        <Sidenav {...param} menuAuth={menuAuth} />
        <div className="flex overflowHidden">
          <ErrorBoundary>
            {/* 父路由已改成 /integration/*，这里是相对路径，也不再套
                addSubPathOfRoute（部署子路径由父路由那层处理）。 */}
            <Routes>
              {getRoutes(param)}
              <Route path="*" element={<APILibrary {...param} />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </div>
    );
  }
}
