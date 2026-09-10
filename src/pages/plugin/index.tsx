import React from 'react';
import DocumentTitle from 'react-document-title';
import { Route, Routes } from 'react-router';
import _ from 'lodash';
import ErrorBoundary from 'ming-ui/components/ErrorBoundary';
import { getMyPermissions } from 'src/components/checkPermission';
import { hasPermission } from 'src/components/checkPermission';
import { upgradeVersionDialog } from 'src/components/upgradeVersion';
import { PERMISSION_ENUM } from 'src/pages/Admin/enum';
import { addSubPathOfRoute, emitter, getRequest } from 'src/utils/common';
import { getCurrentProject } from 'src/utils/project';
import { PLUGIN_TYPE } from './config';
import PluginComponent from './pluginComponent';
import SideNav from './SideNav';

export default class PluginContainer extends React.Component<any, any> {
  constructor(props) {
    super(props);

    const request = getRequest();
    const projectInfo = this.getProjectInfo(request.projectId);
    const { projectId = '', companyName } = projectInfo;

    this.state = {
      currentProjectId: projectId,
      currentProjectName: companyName,
      myPermissions: [],
    };
  }

  componentDidMount() {
    const request = getRequest();
    $('html').addClass('plugin');
    this.loadPermissions(request.projectId);
    emitter.addListener('CHANGE_CURRENT_PROJECT', () => this.loadPermissions());
  }

  componentWillUnmount() {
    $('html').removeClass('plugin');
    emitter.removeListener('CHANGE_CURRENT_PROJECT', () => this.loadPermissions());
  }

  getProjectInfo = initProjectId => {
    const currentProject = getCurrentProject(initProjectId || localStorage.getItem('currentProjectId'));
    return (!_.isEmpty(currentProject) ? currentProject : _.get(md, 'global.Account.projects.0')) || {};
  };

  loadPermissions = initProjectId => {
    const projectInfo = this.getProjectInfo(initProjectId);
    const { projectId = '', companyName } = projectInfo;
    const myPermissions = getMyPermissions(projectId);
    this.setState({
      currentProjectId: projectInfo.projectId,
      currentProjectName: companyName,
      myPermissions,
    });
  };

  render() {
    const { currentProjectId, currentProjectName, myPermissions } = this.state;
    // 父路由从 '/plugin/:type?' 改成了 '/plugin/*'（否则内层嵌套 Routes 无段可匹配），
    // 于是 match.params.type 没了。而 SideNav 靠它高亮当前导航项、并写
    // localStorage 的 pluginUrl —— 这里把它从路径补回去，形状与原来一致，
    // 下游组件（SideNav 读的是 props.match.params.type）不用改。
    const seg = location.pathname.split('/');
    const pluginType = seg[seg.indexOf('plugin') + 1] || '';
    const param = {
      ...this.props,
      match: {
        ...(this.props as any).match,
        params: { ...((this.props as any).match || {}).params, type: pluginType },
      },
      currentProjectId,
      currentProjectName,
      myPermissions,
    };
    const hasPluginAuth =
      _.get(
        _.find(md.global.Account.projects, item => item.projectId === currentProjectId),
        'allowPlugin',
      ) || hasPermission(myPermissions, [PERMISSION_ENUM.DEVELOP_PLUGIN, PERMISSION_ENUM.MANAGE_PLUGINS]);

    if (!hasPluginAuth) {
      return upgradeVersionDialog({
        dialogType: 'content',
        removeFooter: true,
        hint: _l('未启用插件中心'),
        explainText: '',
        projectId: currentProjectId,
      });
    }

    return (
      <div className="flexRow h100">
        <DocumentTitle title={_l('插件')} />
        <SideNav {...param} />
        <div className="flex">
          <ErrorBoundary>
            {/* 父路由已改成 /plugin/*（见 src/router/config.ts）。v7 的嵌套 Routes
                匹配父消费后剩下的那段，所以这里写相对路径 'view' / 'node'，
                且不再套 addSubPathOfRoute —— 部署子路径是父路由那一层的事。 */}
            <Routes>
              <Route path="view" element={<PluginComponent {...param} myPermissions={myPermissions} />} />
              <Route
                path="node"
                element={<PluginComponent {...param} myPermissions={myPermissions} pluginType={PLUGIN_TYPE.WORKFLOW} />}
              />
              <Route path="*" element={<PluginComponent {...param} myPermissions={myPermissions} />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </div>
    );
  }
}
