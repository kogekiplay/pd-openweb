import { Component } from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import AdminTitle from 'src/pages/Admin/common/AdminTitle';
import Config from '../config';
import AppAndWorksheetLog from './components/AppAndWorksheetLog';

const AppLogWrap = styled.div`
  flex: 1;
  min-height: 0;
  background-color: var(--color-background-primary);
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-sm);
  .tipInfo {
    font-size: var(--font-sm);
    line-height: 36px;
    font-weight: 400;
  }
  .export {
    padding: 0 15px;
    min-width: 0;
  }
`;

export interface AppLogState {
  currentTab: number;
  disabledExportBtn: boolean;
}

export default class AppLog extends Component<any, AppLogState> {
  constructor(props) {
    super(props);
    const globalLogTab = localStorage.getItem('globalLogTab');
    this.state = {
      currentTab: globalLogTab ? +globalLogTab : 0,
      disabledExportBtn: false,
    };
  }

  override render() {
    const { appId, projectId, worksheetId } = _.get(this.props, 'match.params') || '';

    return (
      <AppLogWrap className="orgManagementWrap h100">
        {!appId && <AdminTitle prefix={_l('日志 - 应用')} />}

        <AppAndWorksheetLog projectId={appId ? projectId : Config.projectId} appId={appId} worksheetId={worksheetId} />
      </AppLogWrap>
    );
  }
}
