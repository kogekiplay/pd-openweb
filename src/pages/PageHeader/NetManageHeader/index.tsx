import React, { Component } from 'react';
import _ from 'lodash';
import { match } from 'path-to-regexp';
import styled from 'styled-components';
import { Tooltip } from 'ming-ui/antd-components';
import { navigateTo } from 'src/router/navigateTo';
import { getPathWithoutSubPath } from 'src/utils/common';
import CommonUserHandle from '../components/CommonUserHandle';
import './index.less';

const HomeEntry = styled.div`
  display: inline-block;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  border: 1px solid var(--color-border-secondary);
  margin: 0 12px 0 16px;
  color: var(--color-text-tertiary);
  text-align: center;
  line-height: 29px;
  cursor: pointer;
  &:hover {
    border-color: var(--color-border-primary);
    color: var(--color-primary);
  }
`;

const MODULE_TO_TEXT = {
  account: _l('个人账户'),
  admin: _l('组织管理'),
  user: _l('个人资料'),
  group: _l('群组信息'),
  systemSetting: _l('系统配置'),
  search: _l('超级搜索'),
  certification: _l('认证'),
};

const PAGE_HEADER_ROUTE = {
  systemSetting: ['/appInstallSetting'],
  account: ['/personal'],
  admin: ['/admin/:roleType/:projectId'],
  group: ['/group/groupValidate'],
  user: ['/user', '/user_:userId?'],
  search: ['/search'],
  certification: ['/certification/:roleType?'],
};

// decode: false 保持 path-to-regexp 6 的语义：v8 默认拿 decodeURIComponent 解参数，
// 遇到畸形百分号会抛 URIError 把调用方带崩；v6 原样返回。参数都是 ID，本就不该解码。
// 泛型不能省：v8 的 ParamData 是 Partial<Record<string, string | string[]>>，
// 不指定就推成 string | string[]，下面 localStorage.setItem(params.projectId) 会
// 报 TS2345。数组形态只有重复段（*x / {…}*）才会出现，这个 pattern 是两个普通
// 段，写清楚实际形状比在调用处 String() 强转诚实。
const fn = match<{ roleType: string; projectId: string }>('/admin/:roleType/:projectId', { decode: false });
export default class NetManageHeader extends Component<any, any> {
  static propTypes = {};
  static defaultProps = {};
  state = {
    indexSideVisible: false,
  };

  getModule = () => {
    const firstPath = _.isArray(this.props.path) ? this.props.path[0] : this.props.path || '';
    const path = getPathWithoutSubPath(firstPath);
    if (_.includes(PAGE_HEADER_ROUTE.user, path)) return 'user';
    if (_.includes(PAGE_HEADER_ROUTE.account, path)) return 'account';
    if (_.includes(PAGE_HEADER_ROUTE.admin, path)) return 'admin';
    if (_.includes(PAGE_HEADER_ROUTE.group, path)) return 'group';
    if (_.includes(PAGE_HEADER_ROUTE.search, path)) return 'search';
    if (_.includes(PAGE_HEADER_ROUTE.systemSetting, path)) return 'systemSetting';
    if (_.includes(PAGE_HEADER_ROUTE.certification, path)) return 'certification';
    return '';
  };
  render() {
    const text = MODULE_TO_TEXT[this.getModule()];
    return (
      <div className="netManageHeaderWrap">
        <div className="netManageLogo">
          <Tooltip title={_l('工作台')}>
            <HomeEntry
              onClick={() => {
                const { params } = fn(getPathWithoutSubPath(location.pathname)) || {};

                if (!_.isEmpty(params)) {
                  localStorage.setItem('currentProjectId', params.projectId);
                }

                navigateTo('/dashboard');
              }}
            >
              <i className="icon-home_page Font18"></i>
            </HomeEntry>
          </Tooltip>
          {text && <div className="netManageTitle">{text}</div>}
        </div>
        <CommonUserHandle />
      </div>
    );
  }
}
