/**
 * 选择成员（按部门或群组）
 */
import { Component } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import { Checkbox } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import { savedBoolean } from './boundary';
import NoData from './NoData';
import type { ListData, SelectDepartment, SelectGroup, SelectUser, UserSettings, UsersListProps } from './types';
import User from './User';
import './css/user.less';

type GroupProps = Omit<UsersListProps, 'currentIndex'> & {
  unique?: UserSettings['unique'];
  userAction?: (() => void) | undefined;
  toggleUserItem: (id: string) => void;
  allSelectUserItem: (id: string, checked: boolean) => void;
} & ({ tabType: 'department'; data: ListData<SelectDepartment> } | { tabType: 'group'; data: ListData<SelectGroup> });

export default class DepartmentGroupUserList extends Component<GroupProps, { onlyJoinGroupChecked: boolean }> {
  constructor(props: GroupProps) {
    super(props);
    const isCheckedGroupOnlyMyJoin = localStorage.getItem('isCheckedGroupOnlyMyJoin');
    this.state = {
      onlyJoinGroupChecked: savedBoolean(isCheckedGroupOnlyMyJoin, true),
    };
  }

  getChecked(user: SelectUser) {
    return (
      !!this.props.selectedUsers.filter(item => item.accountId === user.accountId).length || this.getIncluded(user)
    );
  }

  getIncluded(user: SelectUser) {
    return _.includes(this.props.selectedAccountIds || [], user.accountId);
  }

  onlyShowJoinGroup = (checked: boolean) => {
    this.setState({ onlyJoinGroupChecked: !checked });
    safeLocalStorageSetItem('isCheckedGroupOnlyMyJoin', String(!checked));
    if (_.isFunction(this.props.userAction)) {
      this.props.userAction();
    }
  };

  override render() {
    const list =
      this.props.tabType === 'department'
        ? this.props.data.list.map(item => ({
            id: item.departmentId,
            name: item.departmentName,
            count: item.userCount,
            users: item.users,
            open: item.open,
          }))
        : this.props.data.list.map(item => ({
            id: item.groupId,
            name: item.name,
            count: item.groupMemberCount,
            users: item.users,
            open: item.open,
          }));
    let { selectedUsers = [], selectedAccountIds = [], tabType } = this.props;
    const { onlyJoinGroupChecked } = this.state;

    return (
      <div className="flexColumn flex">
        <Checkbox className="mBottom10 pLeft7 mTop10" checked={onlyJoinGroupChecked} onClick={this.onlyShowJoinGroup}>
          {_l('只看我加入的群组')}
        </Checkbox>
        {list.length > 0 ? (
          <div className="flex">
            {list.map(department => {
              const checked =
                (selectedUsers.length || selectedAccountIds.length) && (department.users || []).length
                  ? _.every(department.users || [], u =>
                      _.includes([...selectedUsers.map(l => l.accountId), ...selectedAccountIds], u.accountId),
                    )
                  : false;
              const isAllSelectedAccountIds =
                checked &&
                !(department.users || []).filter(l => !selectedAccountIds.includes(l.accountId)).length &&
                !!department.count;

              return (
                <div key={department.id}>
                  <div className="GSelect-treeItem">
                    <div className="GSelect-arrow" onClick={() => this.props.toggleUserItem(department.id)}>
                      <i
                        className={cx(
                          'GSelect-arrow__arrowIcon',
                          department.open ? 'GSelect-arrow__arrowIcon--open' : 'GSelect-arrow__arrowIcon--close',
                        )}
                      />
                    </div>
                    <Tooltip
                      title={
                        !isAllSelectedAccountIds
                          ? ''
                          : tabType === 'department'
                            ? _l('部门下所有人已加入')
                            : _l('群组下所有人已加入')
                      }
                    >
                      <span>
                        <Checkbox
                          className="GSelect-treeItem--checkbox"
                          disabled={!!this.props.unique || isAllSelectedAccountIds}
                          checked={checked}
                          onClick={() => this.props.allSelectUserItem(department.id, checked)}
                        />
                      </span>
                    </Tooltip>

                    <div className="flex flexRow pointer" onClick={() => this.props.toggleUserItem(department.id)}>
                      <div className="GSelect-treeItem-name overflow_ellipsis">{department.name}</div>
                      <div className="GSelect-treeItem-number">{`（${department.count}人）`}</div>
                    </div>
                    {/* {this.props.unique ? null : (
                    <div
                      className="GSelect-treeItem-allSelect colorPrimary"
                      onClick={() => }
                    >
                      {_l('全选')}
                    </div>
                  )} */}
                  </div>
                  {!department.open ? null : (
                    <div className="GSelect-userList">
                      {(department.users || []).map(user => {
                        return (
                          <User
                            user={user}
                            checked={this.getChecked(user)}
                            projectId={this.props.projectId}
                            onChange={this.props.onChange}
                            key={user.accountId}
                            disabled={this.getIncluded(user)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <NoData>{this.props.keywords ? _l('无搜索结果') : _l('暂无成员')}</NoData>
        )}
      </div>
    );
  }
}
