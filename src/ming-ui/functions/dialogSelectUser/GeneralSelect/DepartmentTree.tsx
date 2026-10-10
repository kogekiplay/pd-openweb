import { Component, Fragment } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Checkbox, Icon, LoadDiv, ScrollView } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import departmentController from 'src/api/department';
import { userObject } from '../../quickSelectUser/boundary';
import { decodeDepartments, decodeUserList, savedBoolean } from './boundary';
import NoData from './NoData';
import type {
  AbortableRequest,
  SelectedEntity,
  SelectUser,
  UserDepartmentNode,
  UserSettings,
  UsersListProps,
} from './types';
import User from './User';

interface TreeProps extends Omit<UsersListProps, 'keywords' | 'currentIndex'> {
  data: UserDepartmentNode[];
  userSettings: UserSettings;
  isNetwork?: boolean | '' | null | undefined;
  unique?: UserSettings['unique'];
  removeSelectedData: (ids: string[]) => void;
  addSelectedData: (items: SelectedEntity[]) => void;
  userAction: () => void;
  defaultCheckedDepId?: string | null | undefined;
}
interface TreeState {
  groupId: string | null;
  selects: Array<string | undefined>;
  groupList: SelectUser[];
  loading: boolean;
  pageIndex: number;
  isMore: boolean;
  pagedDepartmentIndex: number;
  pagedDepartmentSize: number;
  isMoreDepartment: boolean;
  department: UserDepartmentNode[];
  departmentLoading: boolean;
  onlyJoinDepartmentChecked: boolean;
  userError?: string | undefined;
  departmentError?: string | undefined;
}

const DepartmentTreeWrapper = styled.div`
  overflow: auto;
  .subs {
    margin-left: 10px;
  }
`;

const UsersWrapper = styled.div`
  .justifyCenter {
    justify-content: center;
  }
  .GSelect-User {
    padding-left: 15px !important;
  }
`;

const Department = styled.div`
  width: 100%;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  &:hover {
    background-color: var(--color-background-hover);
  }
  &.active {
    background-color: var(--color-primary-transparent);
    .icon,
    div {
      color: var(--color-primary) !important;
    }
    .icon:hover {
      background-color: var(--color-background-hover) !important;
    }
  }
  .iconArrow {
    display: flex;
    padding: 7px 0px 5px 2px;
    border-radius: var(--radius-sm);
    &:hover {
      background-color: var(--color-border-secondary);
    }
  }
`;

// import './css/user.less';

export default class DepartmentTree extends Component<TreeProps, TreeState> {
  declare departAjax: AbortableRequest<unknown> | undefined;

  constructor(props: TreeProps) {
    super(props);
    const project = _.find(md.global.Account.projects, { projectId: props.projectId });
    const isCheckedOnlyMyJoin = localStorage.getItem('isCheckedOnlyMyJoin');
    this.state = {
      groupId: null,
      selects: [_.get(project, 'projectId')],
      groupList: [],
      loading: false,
      pageIndex: 1,
      isMore: true,
      pagedDepartmentIndex: 1,
      pagedDepartmentSize: 100,
      isMoreDepartment: true,
      department: props.data || [],
      departmentLoading: false,
      onlyJoinDepartmentChecked: savedBoolean(isCheckedOnlyMyJoin, false),
    };
  }

  override componentDidMount() {
    const replay = this.unmounted;
    this.unmounted = false;
    const initialize = () => {
      if (this.props.defaultCheckedDepId) this.handleSelectGroup(this.props.defaultCheckedDepId);
    };
    if (replay) this.setState({ loading: false, departmentLoading: false }, initialize);
    else initialize();
  }

  private unmounted = false;
  private userVersion = 0;
  private lifecycleVersion = 0;
  private departmentErrorVersions = new Map<string, number>();
  private retryDepartment: (() => void) | undefined;
  private requests = new Set<AbortableRequest<unknown>>();
  override componentWillUnmount() {
    this.unmounted = true;
    this.lifecycleVersion++;
    this.userVersion++;
    this.requests.forEach(request => request.abort?.());
    this.requests.clear();
  }
  run<T>(
    request: AbortableRequest<unknown>,
    kind: 'user' | 'department',
    decode: (value: unknown) => T,
    apply: (data: T) => void,
    departmentKey = 'root',
  ) {
    const version = kind === 'user' ? ++this.userVersion : (this.departmentErrorVersions.get(departmentKey) || 0) + 1;
    if (kind === 'department') this.departmentErrorVersions.set(departmentKey, version);
    const retryDepartment = this.retryDepartment;
    const lifecycleVersion = this.lifecycleVersion;
    this.requests.add(request);
    this.setState(kind === 'user' ? { userError: undefined } : { departmentError: undefined });
    return request
      .then(raw => {
        if (
          this.unmounted ||
          lifecycleVersion !== this.lifecycleVersion ||
          (kind === 'user' && version !== this.userVersion)
        )
          return;
        apply(decode(raw));
      })
      .catch(() => {
        if (
          this.unmounted ||
          lifecycleVersion !== this.lifecycleVersion ||
          (kind === 'user' ? version !== this.userVersion : version !== this.departmentErrorVersions.get(departmentKey))
        )
          return;
        if (kind === 'user') this.setState({ loading: false, userError: _l('加载失败，请重试') });
        else {
          this.retryDepartment = retryDepartment;
          this.setState({ departmentLoading: false, departmentError: _l('加载失败，请重试') });
        }
      })
      .finally(() => this.requests.delete(request));
  }

  getChecked(user: SelectUser) {
    return (
      !!this.props.selectedUsers.filter(item => item.accountId === user.accountId).length || this.getIncluded(user)
    );
  }

  getIncluded(user: SelectUser) {
    return _.includes(this.props.selectedAccountIds || [], user.accountId);
  }

  handleScrollEnd = () => {
    const { groupId, loading, isMore } = this.state;
    const { projectId } = this.props;

    if (!loading && isMore) {
      if (projectId === groupId) {
        if (groupId) this.handleLoadAll(groupId);
      } else {
        if (groupId) this.handleSelectGroup(groupId);
      }
    }
  };

  getNextPageDepartmentTrees = (id?: string) => {
    this.retryDepartment = () => this.getNextPageDepartmentTrees(id);
    const { pagedDepartmentIndex, pagedDepartmentSize } = this.state;
    const { projectId, isNetwork } = this.props;
    this.setState({ departmentLoading: true });
    this.run(
      departmentController[isNetwork ? 'pagedProjectDepartmentTrees' : 'pagedDepartmentTrees']({
        projectId,
        pageIndex: pagedDepartmentIndex + 1,
        pageSize: pagedDepartmentSize,
        parentId: id,
      }),
      'department',
      decodeDepartments,
      res => {
        let temp =
          (_.isArray(res) &&
            res.map(item => ({ ...item, name: item.departmentName, id: item.departmentId, subs: [] }))) ||
          [];
        const department = this.state.department.concat(temp);
        this.setState({
          isMoreDepartment: department.length % pagedDepartmentSize <= 0,
          departmentLoading: false,
          pagedDepartmentIndex: pagedDepartmentIndex + 1,
          department,
        });
      },
      `page:${id || ''}`,
    );
  };

  handleLoadAll = (id: string) => {
    const { pageIndex } = this.state;
    const { projectId } = this.props;
    this.setState({ groupId: id, loading: true });
    this.run(
      departmentController.getNotInDepartmentUsers({
        projectId,
        pageIndex,
        pageSize: 20,
      }),
      'user',
      value => {
        const data = userObject(value);
        if (!data) throw new TypeError('Invalid root department users');
        return decodeUserList(data['listUser']);
      },
      listUser => {
        const groupList = this.state.groupList.concat(listUser.list);
        this.setState({
          isMore: groupList.length !== listUser.allCount,
          loading: false,
          pageIndex: pageIndex + 1,
          groupList,
        });
      },
    );
  };

  handleSelectGroup = (id: string) => {
    const { pageIndex, loading, isMore } = this.state;
    const { userSettings, projectId, isNetwork } = this.props;

    if ((loading && this.state.groupId === id) || !isMore) return;

    if (this.departAjax) {
      this.departAjax.abort?.();
    }

    this.setState({ groupId: id, loading: true });

    this.departAjax = departmentController[isNetwork ? 'getProjectDepartmentUsers' : 'getDepartmentUsers']({
      filterAccountIds: userSettings.filterAccountIds,
      departmentId: id,
      projectId,
      pageIndex,
      pageSize: 100,
    });
    this.run(this.departAjax, 'user', decodeUserList, data => {
      const groupList = this.state.groupList.concat(data.list);
      this.setState({
        isMore: data.allCount !== undefined && groupList.length < data.allCount,
        loading: false,
        pageIndex: pageIndex + 1,
        groupList,
      });
    });
  };

  updateTreeData = (list: UserDepartmentNode[], key: string, subs: UserDepartmentNode[]): UserDepartmentNode[] => {
    return list.map(node => {
      if (node.id === key) {
        return { ...node, subs };
      }

      if (node.subs) {
        return { ...node, subs: this.updateTreeData(node.subs, key, subs) };
      }

      return node;
    });
  };

  expandNext = (id: string) => {
    this.retryDepartment = () => this.expandNext(id);
    const { projectId, isNetwork } = this.props;
    let { department } = this.state;
    this.setState({ departmentLoading: true });
    this.run(
      departmentController[isNetwork ? 'pagedProjectDepartmentTrees' : 'pagedDepartmentTrees']({
        projectId,
        pageIndex: 1,
        pageSize: 100,
        parentId: id,
      }),
      'department',
      decodeDepartments,
      res => {
        let data = res.map(item => ({ ...item, name: item.departmentName, id: item.departmentId, subs: [] }));
        this.setState({ department: this.updateTreeData(department, id, data), departmentLoading: false });
      },
      `expand:${id}`,
    );
  };

  handleCheckAll = () => {
    const { selectedUsers, selectedAccountIds } = this.props;
    const { groupList, isMore } = this.state;
    const ids = selectedUsers.map(item => item.accountId);
    const res = groupList.filter(item => ids.includes(item.accountId));
    const reallyGroupLength = groupList.filter(l => !(selectedAccountIds || []).includes(l.accountId)).length;
    const isAll = res.length !== reallyGroupLength;

    if (isAll) {
      const ids = [...selectedUsers.map(item => item.accountId), ...(selectedAccountIds || [])];
      const res: SelectedEntity[] = groupList
        .filter(item => !ids.includes(item.accountId))
        .map(item => {
          return {
            data: item,
            type: 'user',
          };
        });
      this.props.addSelectedData(res);

      if (isMore) {
        alert(_l('已选%0，滚动可加载更多。', reallyGroupLength));
      }
    } else {
      const ids = selectedUsers.map(item => item.accountId);
      this.props.removeSelectedData(groupList.filter(item => ids.includes(item.accountId)).map(item => item.accountId));
    }
  };

  renderDepartment(item: UserDepartmentNode): React.JSX.Element {
    const { projectId } = this.props;
    const { selects, groupId } = this.state;
    const subVisible = selects.includes(item.id);
    return (
      <Fragment key={item.id}>
        <Department
          className={cx('flexRow valignWrapper pointer', { active: groupId === item.id })}
          onClick={() => {
            this.setState(
              {
                groupList: [],
                pageIndex: 1,
                isMore: true,
              },
              () => {
                if (projectId === item.id) {
                  this.handleLoadAll(item.id);
                } else {
                  this.handleSelectGroup(item.id);
                }
              },
            );
          }}
        >
          <Icon
            icon={subVisible ? 'arrow-down' : 'arrow-right-tip'}
            className={cx('textSecondary iconArrow', { Visibility: !item.haveSubDepartment })}
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              this.expandNext(item.id);
              const { selects } = this.state;

              if (selects.includes(item.id)) {
                this.setState({
                  selects: selects.filter(id => id !== item.id),
                });
              } else {
                this.setState({
                  selects: selects.concat(item.id),
                });
              }
            }}
          />
          <Icon className="textTertiary Font16 mLeft2 mRight5" icon="folder" />
          <div className="ellipsis Font13">{item.name}</div>
        </Department>
        {subVisible && <div className="subs">{item.subs.map(item => this.renderDepartment(item))}</div>}
      </Fragment>
    );
  }

  onlyShowJoinDepartment = (checked: boolean) => {
    this.setState({ onlyJoinDepartmentChecked: !checked });
    safeLocalStorageSetItem('isCheckedOnlyMyJoin', String(!checked));
    this.props.userAction();
  };

  renderDepartmentTree() {
    const { department = [], departmentLoading, onlyJoinDepartmentChecked } = this.state;
    if (this.state.departmentError)
      return (
        <div role="alert">
          {this.state.departmentError}
          <button onClick={() => this.retryDepartment?.()}>{_l('重试')}</button>
        </div>
      );
    return (
      <DepartmentTreeWrapper className="flexColumn flex h100">
        <Checkbox
          className="mBottom10 pLeft7 mTop10"
          checked={onlyJoinDepartmentChecked}
          onClick={this.onlyShowJoinDepartment}
        >
          {_l('只看我加入的部门')}
        </Checkbox>
        <div className="flex overflowHidden">
          {!departmentLoading && _.isEmpty(department) ? (
            <NoData>{_l('无结果')}</NoData>
          ) : (
            <ScrollView
              className="h100"
              onScrollEnd={() => {
                const { isMoreDepartment } = this.state;

                if (!departmentLoading && isMoreDepartment && department.length >= this.state.pagedDepartmentSize) {
                  this.getNextPageDepartmentTrees();
                }
              }}
            >
              {department.map(item => {
                return this.renderDepartment(item);
              })}
              {departmentLoading && (
                <div className="justifyCenter flexRow valignWrapper">
                  <LoadDiv />
                </div>
              )}
            </ScrollView>
          )}
        </div>
      </DepartmentTreeWrapper>
    );
  }

  renderUsers() {
    const { groupId, loading, groupList } = this.state;

    if (this.state.userError)
      return (
        <div role="alert">
          {this.state.userError}
          <button
            onClick={() => {
              if (groupId) {
                if (groupId === this.props.projectId) this.handleLoadAll(groupId);
                else this.handleSelectGroup(groupId);
              }
            }}
          >
            {_l('重试')}
          </button>
        </div>
      );
    if (loading && !groupList.length) {
      return (
        <div className="justifyCenter flexRow valignWrapper h100">
          <LoadDiv />
        </div>
      );
    } else {
      const ids = this.props.selectedUsers.map(item => item.accountId);
      const res = groupList.filter(item => ids.includes(item.accountId));
      const reallyGroupLength = groupList.filter(
        l => !(this.props.selectedAccountIds || []).includes(l.accountId),
      ).length;
      const isAllSelectedAccountIds = res.length === reallyGroupLength && !reallyGroupLength;

      return (
        <Fragment>
          {groupList.length ? (
            <div className="h100 flexColumn">
              <div className="flexRow valignWrapper pLeft15 pBottom5">
                <Tooltip title={!isAllSelectedAccountIds ? '' : _l('部门下所有人已加入')}>
                  <span>
                    <Checkbox
                      checked={res.length === reallyGroupLength}
                      disabled={!!this.props.unique || isAllSelectedAccountIds}
                      onClick={() => this.handleCheckAll()}
                    />
                  </span>
                </Tooltip>
                <div className="textSecondary">
                  {res.length ? _l('已选 %0/%1', res.length, groupList.length) : _l('全选')}
                </div>
              </div>
              <ScrollView className="flex" onScrollEnd={this.handleScrollEnd}>
                {groupList.map(item => (
                  <User
                    key={item.accountId}
                    user={item}
                    projectId={this.props.projectId}
                    checked={this.getChecked(item)}
                    onChange={this.props.onChange}
                    disabled={this.getIncluded(item)}
                  />
                ))}
                {loading && (
                  <div className="justifyCenter flexRow valignWrapper">
                    <LoadDiv />
                  </div>
                )}
              </ScrollView>
            </div>
          ) : (
            <div className="textTertiary TxtCenter justifyCenter flexRow valignWrapper h100">
              {groupId ? _l('部门下没有可选成员') : _l('从左侧选择部门后显示成员')}
            </div>
          )}
        </Fragment>
      );
    }
  }

  override render() {
    let { departmentLoading, department = [] } = this.state;
    return (
      <div className="flexRow h100">
        {this.renderDepartmentTree()}
        <UsersWrapper className="flex">
          {!departmentLoading && !_.isEmpty(department) ? this.renderUsers() : null}
        </UsersWrapper>
      </div>
    );
  }
}
