import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import styled from 'styled-components';
import departmentController from 'src/api/department';
import API from '../api';
import ContactList from '../components/ContactList';
import DepartmentUsers from '../components/DepartmentUsers';
import ListSearchBar from '../components/ListSearchBar';
import ProjectContactsList from '../components/ProjectContactsList';
import type { DepartmentNode } from '../types';

const SearchContainer = styled.div`
  width: 100%;
  height: 100%;
  .searchUsers {
    padding-top: var(--space-6);
    height: 50%;
    .userTxt {
      font-size: var(--font-md);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-2);
      padding-left: var(--space-6);
    }
    .searchResult {
      width: 100%;
      flex: 1;
    }
  }
  .searchDepartment {
    height: 50%;
    padding-top: 10px;
    .departmentTxt {
      font-size: var(--font-md);
      color: var(--color-text-secondary);
      padding-left: var(--space-6);
    }
    .searchResult {
      width: 100%;
      flex: 1;
      .departmentItem {
        color: var(--color-text-title);
        font-size: var(--font-sm);
        padding-left: var(--space-6);
        line-height: 32px;
        .icon {
          line-height: 32px;
          color: var(--color-text-disabled);
        }
        .departmentName {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
      .departmentItem:hover {
        background-color: var(--color-background-hover);
      }
    }
  }
`;


/** 地址簿用户（hap-api 的 `UserModel`；本容器只透传/计数，不读内部字段） */
type AddressUser = HapApi.MD.Web.Ajax.ResultModel.User.UserModel;

/** 部门折叠面板的本地模型（`formatDepartmentData` 构造、`updateDeptModel` 局部更新） */
interface DepartmentBucket {
  departmentName?: string | undefined;
  departmentId?: string | undefined;
  isOpen: boolean;
  isLoading: boolean;
  list: AddressUser[];
}

type DepartmentMap = Record<string, DepartmentBucket>;

/** 容器由 `lib/addressBook/index.tsx` 渲染：`<ProjectContacts projectId={projectId} />` */
interface ProjectContactsProps {
  projectId?: string | null | undefined;
}

interface ProjectContactsState {
  listData: AddressUser[];
  departments: DepartmentMap | null;
  selectedAccountId?: string | null | undefined;
  isLoading: boolean;
  keywords: string;
  hasMore: boolean;
  pageIndex: number;
  pageSize: number;
  groupList: AddressUser[];
  usersPageIndex: number;
  usersLoading: boolean;
  hideBackBtn?: boolean | undefined;
  isFriend?: boolean | undefined;
  /** 首屏由 `fetchDepartments` 写入（初值缺省） */
  isMore?: boolean | undefined;
  isMoreUsers?: boolean | undefined;
  allCount?: number | undefined;
  groupName?: string | undefined;
  groupId?: string | undefined;
  departmentLoading?: boolean | undefined;
  /** 部门分页累积（首屏前缺省） */
  departmentsList?: DepartmentNode[];
}

const formatDepartmentData = (list: DepartmentNode[] | undefined): DepartmentMap => {
  const departments: DepartmentMap = {};
  const concatedList = (list || []).concat({
    departmentName: _l('未分配部门的联系人'),
    departmentId: '',
  });
  _.forEach(concatedList, item => {
    const { departmentId, departmentName } = item;
    // 擦除标记：真实部门数据都带 departmentId（末尾追加项显式给 ''）；缺省时索引得到 undefined 键。
    departments[departmentId as string] = {
      departmentName,
      departmentId,
      isOpen: false,
      isLoading: false,
      list: [],
    };
  });

  return departments;
};

export default class ProjectContacts extends React.Component<ProjectContactsProps, ProjectContactsState> {
  declare promise: ApiResult | null;

  constructor(props: ProjectContactsProps) {
    super(props);

    this.state = {
      // store
      listData: [],
      departments: null,
      // list state
      selectedAccountId: null,
      isLoading: false,
      keywords: '',
      hasMore: true,
      pageIndex: 1,
      pageSize: 20,
      groupList: [],
      usersPageIndex: 1,
      usersLoading: true,
    };

    this.promise = null;

    this.fetch = this.fetch.bind(this);
    this.search = this.search.bind(this);
    this.fetchDepartmentUser = this.fetchDepartmentUser.bind(this);
    this.updateDeptModel = this.updateDeptModel.bind(this);
    this.itemClickHandler = this.itemClickHandler.bind(this);
    this.fetchDepartments = this.fetchDepartments.bind(this);
  }

  override componentDidMount() {
    this.fetchDepartments();
  }

  override componentDidUpdate(prevProps: ProjectContactsProps) {
    if (!shallowEqual(prevProps, this.props)) {
      this.setState({}, this.fetchDepartments);
      if (!_.isEqual(prevProps.projectId, this.props.projectId)) {
        this.setState({
          pageIndex: 1,
          groupId: '',
          groupList: [],
          keywords: '',
        });
      }
    }
  }

  override componentWillUnmount() {
    this.abortRequest();
  }

  abortRequest() {
    if (this.promise && this.promise.abort) {
      this.promise.abort();
    }
  }

  search(keywords: string) {
    this.abortRequest();
    this.setState(
      {
        isLoading: false,
        pageIndex: 1,
        keywords,
        hasMore: true,
        listData: [],
        hideBackBtn: keywords ? true : false,
      },
      this.fetch,
    );
  }

  fetch() {
    const { isLoading, hasMore, keywords } = this.state;
    if (!keywords || isLoading || !hasMore) return;
    this.setState({
      isLoading: true,
    });
    this.fetchContacts().then(() => {
      this.setState({
        isLoading: false,
        pageIndex: 1,
        usersLoading: false,
        // hasMore,
      });
    });
  }

  fetchContacts() {
    const { pageIndex, keywords } = this.state;
    const { projectId } = this.props;
    this.promise = API.searchAddressbookAndDepartment({
      pageIndex,
      keywords,
      projectId,
      pageSize: 100,
      range: 0,
      isFilterOther: false,
    });
    return this.promise.then(data => {
      const { listData } = this.state;
      this.setState({
        listData: (listData || []).concat(data.userResult),
      });
      return data.userResult && data.userResult.length;
    });
  }

  fetchDepartments() {
    const { projectId } = this.props;
    let { pageIndex, pageSize } = this.state;
    this.setState({ isMore: false });
    this.promise = departmentController.pagedDepartmentTrees({
      dataRange: 2,
      filterAccountIds: [md.global.Account.accountId],
      filterFriend: false,
      keywords: '',
      parentId: '',
      prefixAccountIds: [],
      firstLetter: '',
      projectId,
      pageIndex,
      pageSize,
    });
    return this.promise.then(data => {
      const { pageIndex, departmentsList = [] } = this.state;

      let currentPageData = (data || []).map((item: DepartmentNode) => ({ ...item, subs: [] }));
      let result = pageIndex > 1 ? departmentsList.concat(currentPageData) : currentPageData;
      this.setState({
        departments: formatDepartmentData(result),
        isMore: _.isArray(data) && data.length === pageSize,
        departmentsList: result,
      });
    });
  }

  loadNextPage = () => {
    this.setState({ pageIndex: this.state.pageIndex + 1 }, () => {
      this.fetchDepartments();
    });
  };

  fetchDepartmentUser(departmentId: string) {
    const { projectId } = this.props;
    this.updateDeptModel(departmentId, {
      isLoading: true,
      isOpen: true,
    });
    return API.fetchDepartmentUsers({
      projectId,
      departmentId,
    })
      .then(({ list }) => {
        return list || [];
      })
      .then(list => {
        this.updateDeptModel(departmentId, {
          list,
          isLoading: false,
        });
      });
  }

  updateDeptModel(id: string, payload: Partial<DepartmentBucket>) {
    // 擦除标记：`updateDeptModel` 只在部门已加载后调用（首屏 departments 为 null，原实现同样解构抛 TypeError）。
    const {
      departments: { [id]: department },
    } = this.state as { departments: DepartmentMap };

    this.setState({
      departments: {
        ...this.state.departments,
        [id]: _.extend({}, department, payload),
      },
    });
  }

  itemClickHandler({
    accountId,
    isFriend,
  }: {
    accountId?: string | undefined;
    isFriend?: boolean | undefined;
    isContact?: boolean | undefined;
  }) {
    this.setState({
      selectedAccountId: accountId,
      isFriend,
      hideBackBtn: true,
    });
  }

  handleSelectGroup = (id: string | undefined) => {
    const { usersPageIndex } = this.state;
    const { projectId } = this.props;
    this.setState({ isMoreUsers: false });
    departmentController
      .getDepartmentUsers({
        filterAccountIds: [],
        departmentId: id ? id : this.state.groupId,
        projectId,
        pageIndex: usersPageIndex,
        pageSize: 20,
      })
      .then(data => {
        const groupList = usersPageIndex > 1 ? this.state.groupList.concat(data.list) : data.list;
        this.setState({
          isMoreUsers: groupList.length !== data.allCount,
          usersLoading: false,
          usersPageIndex: usersPageIndex + 1,
          groupList,
          allCount: data.allCount,
        });
      });
  };

  handleLoadAll = () => {
    const { usersPageIndex } = this.state;
    const { projectId } = this.props;
    this.setState({ isMoreUsers: false });
    departmentController
      .getNotInDepartmentUsers({
        projectId,
        pageIndex: usersPageIndex,
        pageSize: 20,
      })
      .then(({ listUser }) => {
        // 擦除标记：`listUser` 在 `ProjectRootDepartmentModel` 里声明为可选，但真实响应必带（原 any 直接读）。
        // 擦除标记：`list` 在 `ListModel_UserModel` 里声明为可选，真实响应必带（原 any 直接读）。
        const groupList =
          usersPageIndex > 1 ? this.state.groupList.concat(listUser!.list!) : listUser!.list!;
        this.setState({
          isMoreUsers: groupList.length !== listUser!.allCount,
          usersLoading: false,
          usersPageIndex: usersPageIndex + 1,
          groupList,
          allCount: listUser!.allCount,
        });
      });
  };

  selectCurrentDepartment = (id: string, name: string) => {
    this.setState({ groupId: id, groupList: [], usersPageIndex: 1, groupName: name, usersLoading: true }, () => {
      if (this.props.projectId === id) {
        // 擦除标记：`handleLoadAll` 实际不接收参数（原实现多传的 id 被忽略）；为保持运行表达式不变，仅做类型层收窄。
        (this.handleLoadAll as (id?: string) => void)(id);
      } else {
        this.handleSelectGroup(id);
      }
    });
  };

  renderList() {
    const { departments, listData, selectedAccountId, isLoading, keywords, isMore, departmentsList } = this.state;
    const isSearch = !!keywords;

    if (isSearch) {
      return (
        <SearchContainer>
          <ContactList
            isSearch={isSearch}
            selectedAccountId={selectedAccountId}
            list={listData}
            isLoading={isLoading}
            fetch={() => {}}
            itemClickHandler={this.itemClickHandler}
            searchDepartmentUsers={true}
          />
          {/* <div className="searchUsers flexColumn">
            <div className="userTxt">{_l('成员')}</div>
            <div className="Relative searchResult">

            </div>
          </div>
          <div className="searchDepartment flexColumn">
            <div className="departmentTxt">{_l('部门')}</div>
            <div className="Relative searchResult">
              <ScrollView>
                {departmentResult.map(item => {
                  return (
                    <div
                      className="departmentItem flexRow"
                      key={item.id}
                      onClick={() => {
                        this.selectCurrentDepartment(item.id, item.name);
                      }}
                    >
                      <Icon icon="folder" className="mRight8" />
                      <span className="flex departmentName">{item.name}</span>
                    </div>
                  );
                })}
              </ScrollView>
            </div>
          </div> */}
        </SearchContainer>
      );
    } else {
      return (
        <ProjectContactsList
          selectedAccountId={selectedAccountId}
          list={departments}
          isLoading={isLoading}
          loadNextPage={this.loadNextPage}
          departmentLoading={this.state.departmentLoading}
          isMore={isMore}
          departmentsList={departmentsList}
          projectId={this.props.projectId}
          groupId={this.state.groupId}
          selectCurrentDepartment={this.selectCurrentDepartment}
        />
      );
    }
  }

  override render() {
    const { selectedAccountId, keywords, usersLoading, groupList = [], groupId } = this.state;
    return (
      <React.Fragment>
        <div className="contacts-list">
          <ListSearchBar
            keywords={keywords}
            type="projectContacts"
            search={this.search}
            projectId={this.props.projectId}
          />
          <div className="contacts-list-content">{this.renderList()}</div>
        </div>
        <div className="contacts-detail">
          {(groupId || selectedAccountId) && (
            <DepartmentUsers
              usersLoading={usersLoading}
              groupList={groupList}
              {...{ groupId }}
              projectId={this.props.projectId}
              isMoreUsers={this.state.isMoreUsers}
              handleSelectGroup={this.handleSelectGroup}
              handleLoadAll={this.handleLoadAll}
              allCount={this.state.allCount || 0}
              groupId={this.state.groupId}
              selectedAccountId={selectedAccountId}
              groupName={this.state.groupName}
              hideBackBtn={this.state.hideBackBtn}
            />
          )}
        </div>
      </React.Fragment>
    );
  }
}
