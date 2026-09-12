import React, { Component } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import AdminTitle from 'src/pages/Admin/common/AdminTitle';
import { navigateTo } from 'src/router/navigateTo';
import Config from '../../config';
import CertInfo from './component/CertInfo';
import ProjectInfo from './component/ProjectInfo';

const TABS = [
  { key: 'sysinfo', label: _l('组织信息'), path: '/admin/sysinfo/:projectId' },
  { key: 'certinfo', label: _l('认证信息'), path: '/admin/certinfo/:projectId' },
];

const Comp = { sysinfo: ProjectInfo, certinfo: CertInfo };

export default class SystemSetting extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      showHeader: true,
    };
  }

  changeTab = key => {
    const projectId = Config.projectId;
    navigateTo(`/admin/${key}/${projectId}`);
  };

  render() {
    const { showHeader } = this.state;
    // 从路径派生而不是存 state：原来内层用两条 <Route> 来决定渲染哪个 Tab
    //（state 只是同步用的）。路由迁到 v7 后这两条没法保留 —— 它们的判别段
    // （sysinfo / certinfo）已经被父路由 '/admin/*' 下的 'sysinfo/*' / 'certinfo/*'
    // 消费掉了，相对化之后两条都会变成 ':projectId'、直接撞车。
    // 改成按路径取当前 Tab，顺带修掉一个既有隐患：原来 changeTab 只在点击时
    // setState，浏览器【后退】时 state 不会变（v4 是靠 <Route> 重新匹配兜住的）。
    const seg = location.pathname.split('/');
    const currentTab = seg[seg.indexOf('admin') + 1] || 'sysinfo';
    const ActiveComp = Comp[currentTab] || Comp.sysinfo;

    return (
      <div className="orgManagementWrap">
        <AdminTitle prefix={_l(`组织 - ${(_.find(TABS, v => v.key === currentTab) || {}).label || '组织信息'}`)} />
        {showHeader && (
          <div className="orgManagementHeader">
            <div className="tabBox">
              {TABS.filter(
                item => !(item.key === 'certinfo' && window.platformENV.isOverseas && window.platformENV.isPlatform),
              ).map(item => {
                return (
                  <span
                    key={item.key}
                    className={cx('tabItem Hand', { active: currentTab === item.key })}
                    onClick={() => this.changeTab(item.key)}
                  >
                    {item.key === 'certinfo' && (window.platformENV.isOverseas || window.platformENV.isLocal)
                      ? _l('短信签名')
                      : item.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className={cx('flexColumn', { orgManagementContent: showHeader, orgManagementWrap: !showHeader })}>
          <ActiveComp
            ref={ele => { this.com = ele; }}
            projectId={Config.projectId}
            changeTab={this.changeTab}
            changeShowHeader={visible => this.setState({ showHeader: visible })}
          />
        </div>
      </div>
    );
  }
}
