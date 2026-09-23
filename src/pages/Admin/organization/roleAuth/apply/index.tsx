import React from 'react';
import styled from 'styled-components';
import Config from '../../../config';
import RoleList from '../roleList';

const Wrap = styled.div`
  border-radius: var(--radius-sm);
  flex: 1;
  min-height: 0;
  background-color: var(--color-background-primary);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  .roleAuthHeader {
    height: 56px;
    padding: 0 var(--space-6);
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border-secondary);
    box-sizing: border-box;
    .detailTitle {
      display: flex;
      align-items: center;
    }
    .menuTab {
      display: flex;
      height: 100%;
      li {
        height: 100%;
        display: flex;
        align-items: center;
        border-bottom: 2px solid transparent;
        margin-right: var(--space-1);
        padding: 0 var(--space-4);
        &:hover {
          background-color: var(--color-background-hover);
        }
        a {
          font-weight: 600;
          color: var(--color-text-title) !important;
          font-size: 17px;
        }
        &.menuTab-active {
          border-bottom-color: var(--color-primary);
          a {
            color: var(--color-primary-text) !important;
          }
        }
      }
    }
  }
  .roleAuthContent {
    flex: 1;
    min-height: 0;
  }
`;

export default class ApplyRole extends React.Component<any, any> {
  constructor(props) {
    super(props);
  }

  override render() {
    return (
      <Wrap>
        <div className="roleAuthHeader">
          <div className="detailTitle">
            <span className="Font17 Bold">{_l('申请角色权限')}</span>
          </div>
        </div>
        <div className="roleAuthContent pLeft24 pRight24">
          <RoleList entry="apply" projectId={Config.projectId} authority={this.props.authority} />
        </div>
      </Wrap>
    );
  }
}
