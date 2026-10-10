import React, { Component, createRef, Fragment } from 'react';
import type { MouseEvent, RefObject } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import { Button, LoadDiv, ScrollView } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import type { ScrollViewHandle } from 'ming-ui/components/ScrollView';
import departmentController from 'src/api/department';
import groupController from 'src/api/group';
import structureController from 'src/api/structure';
import userController from 'src/api/user';
import {
  decodeContact,
  decodeDepartmentList,
  decodeDepartments,
  decodeGroupList,
  decodeUserList,
  decodeUsers,
  savedBoolean,
} from './boundary';
import { ChooseType, RenderTypes, UserTabsId } from './constant';
import DefaultUserList from './DefaultUserList';
import DepartmentGroupUserList from './DepartmentGroupUserList';
import DepartmentList from './DepartmentList';
import DepartmentTree from './DepartmentTree';
import ExtraUserList from './ExtraUserList';
import GDropdown from './GDropdown';
import NoData from './NoData';
import Result from './Result';
import type {
  AbortableRequest,
  ChooseMode,
  CommonSettings,
  DepartmentNode,
  GeneralSelectProps,
  GeneralSelectState,
  MainData,
  SelectDepartment,
  SelectedEntity,
  SelectUser,
  SubmitData,
  UserRequest,
  UserSettings,
  UserTab,
} from './types';
import './style.less';

type DepartmentSettingsResolved = { disabledDepartmentIds: string[]; departmentIds: string[] };

const DefaultUserTabs = (isNetwork: CommonSettings['isSuperWork']): UserTab[] => {
  return [
    {
      id: UserTabsId.CONACT_USER,
      name: _l('全部'), // 按姓氏拼音排序
      type: 1,
      page: true, // 是否分页
      actions: {
        getContactUsers: isNetwork ? userController.getProjectContactUserList : userController.getContactUserList,
      },
    },
    {
      id: UserTabsId.DEPARTMENT,
      name: _l('按部门'),
      type: 2,
      page: false,
      actions: {
        // 常规部门请求
        getDepartments: isNetwork
          ? departmentController.getProjectContactDepartments
          : departmentController.getContactProjectDepartments,
        // 只看与我有关的部门
        getDepartmentUsers: isNetwork
          ? departmentController.getProjectDepartmentUsers
          : departmentController.getDepartmentUsers,
      },
    },
    {
      id: UserTabsId.GROUP,
      name: _l('按群组'),
      type: 6,
      page: true,
      actions: {
        getGroups: groupController.getContactGroups,
        getGroupUsers: groupController.getGroupEffectUsers,
      },
    },
    {
      id: UserTabsId.SUBORDINATE_USER,
      name: _l('按下属'),
      type: 4,
      page: true,
      actions: {
        getUsers: structureController.getSubordinateUsers,
      },
    },
  ];
};

const SearchUserTabs: UserTab[] = [
  {
    id: UserTabsId.RESIGNED,
    name: _l('已离职'),
    type: 7,
    page: true, // 是否分页
    actions: {
      getUsers: userController.getProjectResignedUserList,
    },
  },
];

const ResignedTab: UserTab = {
  id: UserTabsId.RESIGNED,
  name: _l('已离职'),
  type: 7,
  page: true,
  actions: {
    getUsers: userController.getProjectResignedUserList,
  },
};

export default class GeneraSelect extends Component<GeneralSelectProps, GeneralSelectState> {
  declare _resultScrollView: HTMLDivElement | null | undefined;

  boxRef: RefObject<HTMLDivElement | null>;
  declare commonSettings: CommonSettings & {
    projectId: string | null;
    selectModes: ChooseMode[];
    btnName: string;
    callback: (data: SubmitData) => void;
  };
  declare userSettings: UserSettings & {
    defaultTabs: UserTab[];
    showTabs: string[];
    filterAccountIds: Array<string | undefined>;
    filterSystemAccountId: string[];
    callback: NonNullable<UserSettings['callback']>;
  };
  declare departmentSettings: DepartmentSettingsResolved;
  declare scrollView: ScrollViewHandle | null;
  private requestVersion = 0;
  private unmounted = false;
  private retryAction: () => void | Promise<void> | false = () => this.defaultAction();

  static defaultProps = {
    chooseType: ChooseType.USER, // 默认选中的tab
    departmentSettings: {
      departments: [],
    },
  };

  constructor(props: GeneralSelectProps) {
    super(props);
    this.state = Object.assign(this.receiveProps(props), {
      /**
       * 选中的人
       * type selectedData = Array({
       *   type:  ChooseType
       *   data:  any;
       * })
       */
      selectedData: [
        ...(props.departmentSettings?.departments || []).map((department: SelectDepartment) => ({
          type: ChooseType.DEPARTMENT,
          data: department,
        })),
      ],
    });

    this.boxRef = createRef<HTMLDivElement>();
  }

  /** 已经选中的联系人 */
  get selectedUsers(): SelectUser[] {
    let users = this.state.selectedData
      .filter((item): item is SelectedEntity & { type: 'user' } => item.type === ChooseType.USER)
      .map(item => item.data);
    return users;
  }

  /** 已经选中的部门 */
  get selectedDepartment(): SelectDepartment[] {
    let departments = this.state.selectedData
      .filter((item): item is SelectedEntity & { type: 'department' } => item.type === ChooseType.DEPARTMENT)
      .map(item => item.data);
    return departments;
  }

  // 挂的是带 abort 的 ajax promise；写死 null 会被推成 never，下游 .abort() 全报
  promiseObj: AbortableRequest<unknown> | null | '' = null; // 请求promise
  _scrollView = null; // ScrollView 的 ref
  _searchInput: HTMLInputElement | null = null; // 搜索input

  handlePromise(promise: AbortableRequest<unknown>) {
    if (this.promiseObj) {
      this.promiseObj.abort?.();
      this.promiseObj = '';
    }

    this.promiseObj = promise;
    return this.promiseObj;
  }

  override componentDidUpdate(prevProps: GeneralSelectProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const needUpdate =
        this.props.commonSettings.projectId !== this.commonSettings.projectId ||
        this.props.commonSettings.dataRange !== this.commonSettings.dataRange;

      if (needUpdate) {
        let state = this.receiveProps(this.props);
        this.setState(state, () => {
          this.defaultAction();
          this.focusSearchInput();
        });
      }
    }
  }

  override componentDidMount() {
    this.unmounted = false;
    window.addEventListener('keydown', this.handleKeyDown, false);
    this.defaultAction();
    this.focusSearchInput();
  }

  override componentWillUnmount() {
    this.unmounted = true;
    this.requestVersion++;
    this.searchDefault.cancel();
    this.promiseObj && this.promiseObj.abort?.();
    this.promiseObj = null;
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  focusSearchInput = () => {
    this._searchInput?.focus({ preventScroll: true });
  };

  updateEvent() {
    let page = false;

    if (this.state.chooseType === ChooseType.USER) {
      page = !!this.getTabItem()?.page;
    } else if (this.state.chooseType === ChooseType.RESIGNED) {
      page = this.state.haveMore;
    }

    if (this.promiseObj) return;

    if (page) {
      this.setState(
        {
          pageIndex: this.state.pageIndex + 1,
        },
        () => {
          this.defaultAction();
        },
      );
    }
  }

  getResultData() {
    const { mainData } = this.state;

    if (!mainData) {
      return [];
    }

    switch (mainData.renderType) {
      case RenderTypes.CONTACK_USER:
        const data = mainData.data;
        return (data.oftenUsers?.list || []).concat(data.users?.list || []);
      case RenderTypes.RESIGNED:
      case RenderTypes.OTHER_USER:
        return mainData.data.list;
      default:
        return [];
    }
  }

  /**人员搜索结果上下键切换 */
  handleKeyDown = (event: KeyboardEvent) => {
    if (this.promiseObj) {
      return false;
    }

    const { currentIndex, chooseType } = this.state;
    const flattenResult = this.getResultData();

    if (chooseType === ChooseType.USER && $('#dialogBoxSelectUser') && this.scrollView && flattenResult.length) {
      const { which, ctrlKey, metaKey } = event;

      if (which === 38) {
        this.setState(
          {
            currentIndex: currentIndex === -1 || currentIndex === 0 ? flattenResult.length - 1 : currentIndex - 1,
          },
          () => {
            this.adjustViewport('up', flattenResult);
          },
        );
      } else if (which === 40) {
        this.setState(
          {
            currentIndex: currentIndex === flattenResult.length - 1 ? 0 : currentIndex + 1,
          },
          () => {
            this.adjustViewport('down', flattenResult);
          },
        );
        // 单选 ctrl+回车自动提交
      } else if (ctrlKey && which == 13 && this.userSettings.unique) {
        this.submit();
      } else if (which == 13 && (metaKey || ctrlKey)) {
        // ⌘、Ctrl + 回车自动提交
        this.submit();
      } else if (which === 13 && this.state.currentIndex >= 0) {
        const user = flattenResult[this.state.currentIndex];
        if (user) this.toogleUserSelect(user);
      }
    }
    return undefined;
  };

  adjustViewport(direction: 'up' | 'down', flattenResult: SelectUser[]) {
    const { currentIndex } = this.state;
    const scrollViewEl = this.boxRef.current?.querySelector('.GSelect-container');
    const current = flattenResult[currentIndex];
    if (!scrollViewEl || !current || !this.scrollView) return;
    const $scrollViewEl = $(scrollViewEl);
    const $currentEl = $(`#GSelect-User-${current.accountId}`);
    const position = $currentEl.position();
    if (!position) return;
    const height = $currentEl.height() || 0;
    const viewportHeight = $scrollViewEl.height() || 0;
    if (direction === 'up') {
      if (position.top < 0 || position.top + height >= viewportHeight) this.scrollView.scrollToElement($currentEl[0]);
    } else if (position.top + height >= viewportHeight) {
      const { scrollTop = 0, scrollHeight = 0, maxScrollTop = 0 } = this.scrollView.getScrollInfo() || {};
      const bottom = scrollHeight - scrollTop - position.top - height;
      this.scrollView.scrollTo({ top: maxScrollTop - bottom });
    } else if (position.top < 0) this.scrollView.scrollToElement($currentEl[0]);
  }

  getTabItem() {
    return this.userSettings.defaultTabs.filter((tab: UserTab) => tab.id === this.state.selectedUserTabId)[0];
  }

  /** 处理props */
  receiveProps(props: GeneralSelectProps): Omit<GeneralSelectState, 'selectedData'> {
    const defaultCommonSettings = {
      projectId: '', // 网络ID  默认选中某个网络
      dataRange: 0, // 0 全部  1 好友 2 网络
      btnName: _l('确认'), // 按钮文字
      selectModes: props.commonSettings.selectModes || [ChooseType.USER],
      callback: () => {}, // 关闭时的回调
    };
    const defaultUserSettings = {
      _id: 0, // index for defaultTabs
      defaultTabs: DefaultUserTabs(props.commonSettings.isSuperWork),
      showTabs: ['conactUser', 'department', 'group', 'subordinateUser'],
      // 格式和defaultTabs一致,id和page可以为空
      // 方法请求的参数(pageIndex:int,pageSize:int,keywords string，filterAccountIds:[]，projectId string)
      // 返回结果listModel {list:[{accountId:'',avatar:'',fullname:'',department:''}],allCount:1}
      extraTabs: [],
      allowSelectNull: false, // 是否允许选择列表为空
      filterAccountIds: [],
      filterSystemAccountId: [],
      callback: () => {},
      filterProjectId: '',
      filterFriend: false,
      filterResigned: true,
      unique: false, // 是否只可以选一个
      pageIndex: 1,
      pageSize: 50,
      isMore: true, // 当点击要过滤的用户时
    };

    const defaultDepartmentSettings = {
      disabledDepartmentIds: [],
      departmentIds: [],
    };

    this.commonSettings = $.extend(defaultCommonSettings, props.commonSettings || {});
    this.userSettings = $.extend(defaultUserSettings, props.userSettings || {});
    this.departmentSettings = $.extend(defaultDepartmentSettings, props.departmentSettings || {});
    // 兼容老组件，只有选择联系人时，默认不可以不选
    if (this.commonSettings.selectModes.length === 1 && this.commonSettings.selectModes[0] === ChooseType.USER) {
      this.userSettings.allowSelectNull = false;
    }

    let userSettings = this.userSettings;

    // 新添加的tab
    if (userSettings.extraTabs && userSettings.extraTabs.length) {
      userSettings.extraTabs.forEach((item: UserTab) => {
        userSettings.defaultTabs.push(item);
      });
    }

    let tabs: UserTab[] = [];
    let { showTabs = [] } = userSettings;
    showTabs.forEach((id: string) => {
      tabs = tabs.concat(userSettings.defaultTabs.filter((item: UserTab) => item.id === id));
    });
    userSettings.defaultTabs =
      !userSettings.filterResigned && !userSettings.hideResignedTab ? tabs.concat(ResignedTab) : tabs;

    let state: Omit<GeneralSelectState, 'selectedData'> = {
      /** 当期的选择类型 */
      chooseType: props.chooseType || ChooseType.USER,
      /** 关键字 */
      keywords: '',
      /** 选择人员是否出现筛选 */
      isProject: this.checkIsProject(),
      /** 选择的用户筛选范围 */
      selectedUserTabId: userSettings.defaultTabs[0]?.id || UserTabsId.CONACT_USER,
      /** 滚动分页 */
      pageSize: 50,
      pageIndex: 1,
      /** 联系人数据 */
      mainData: null,
      loading: false,
      haveMore: true,
      isSearch: false,
      currentIndex: -1,
    };
    return state;
  }

  /* ---------------------------------------------------------------------------------------------------
    -----------------------------------         内部方法        -----------------------------------------
    ---------------------------------------------------------------------------------------------------- */

  /** 检测选择人员中是否有按部门、群组下属的筛选 */
  checkIsProject() {
    return this.commonSettings.projectId !== '';
  }

  defaultAction() {
    if (this.state.chooseType === ChooseType.USER) {
      this.userAction();
    } else if (this.state.chooseType === ChooseType.DEPARTMENT) {
      this.departmentAction();
    } else if (this.state.chooseType === ChooseType.RESIGNED) {
      this.resignedAction();
    }
  }

  /** Handle a concrete API request and release loading on rejection, including bad payloads. */
  runRequest<T>(
    request: AbortableRequest<unknown>,
    decode: (value: unknown) => T,
    apply: (data: T) => void,
    retry: () => void | Promise<void> | false = () => this.defaultAction(),
  ): Promise<void> {
    const version = ++this.requestVersion;
    this.handlePromise(request);
    this.setState({ loadError: undefined });
    return request
      .then(value => {
        if (this.unmounted || version !== this.requestVersion) return;
        apply(decode(value));
        this.promiseObj = '';
      })
      .catch(() => {
        if (this.unmounted || version !== this.requestVersion) return;
        this.promiseObj = '';
        this.retryAction = retry;
        this.setState({ loading: false, isSearch: false, loadError: _l('加载失败，请重试') });
      });
  }

  /** 请求联系人 */
  userAction = () => {
    const userSettings = this.userSettings;
    const commonSettings = this.commonSettings;
    const tabItem = this.getTabItem();
    if (!tabItem) return undefined;
    const reqData: UserRequest = {
      keywords: _.trim(this.state.keywords),
      projectId: commonSettings.projectId,
      dataRange: commonSettings.dataRange,
      filterAccountIds: userSettings.filterAccountIds,
      prefixAccountIds: userSettings.prefixAccountIds,
      filterFriend: userSettings.filterFriend,
      filterProjectId: userSettings.filterProjectId,
      includeUndefinedAndMySelf:
        tabItem.type === RenderTypes.CONTACK_USER ? userSettings.includeUndefinedAndMySelf : undefined,
      includeSystemField: tabItem.type === RenderTypes.CONTACK_USER ? userSettings.includeSystemField : undefined,
      includeMySelf: userSettings.includeMySelf,
    };
    if (tabItem.page) {
      reqData.pageIndex = this.state.pageIndex;
      reqData.pageSize = this.state.pageSize;
      if (!this.state.haveMore) return false;
    }
    let action: (args: UserRequest) => AbortableRequest<unknown>;
    if (tabItem.type === 1) action = tabItem.actions.getContactUsers;
    else if (tabItem.type === 2) {
      if (this.state.keywords) action = tabItem.actions.getDepartments;
      else {
        action =
          departmentController[commonSettings.isSuperWork ? 'pagedProjectDepartmentTrees' : 'pagedDepartmentTrees'];
        reqData.pageIndex = 1;
        reqData.pageSize = 100;
        reqData.parentId = '';
        reqData.onlyMyJoin = savedBoolean(localStorage.getItem('isCheckedOnlyMyJoin'), false);
      }
    } else if (tabItem.type === 6) {
      action = tabItem.actions.getGroups;
      reqData.searchGroupType = savedBoolean(localStorage.getItem('isCheckedGroupOnlyMyJoin'), true) ? 1 : 0;
    } else action = tabItem.actions.getUsers;
    if (!tabItem.page || reqData.pageIndex === 1) this.setState({ loading: true });
    return this.runRequest(
      action(reqData),
      value => {
        switch (tabItem.type) {
          case 1:
            return { renderType: 1, data: decodeContact(value) } satisfies MainData;
          case 2:
            return {
              renderType: 2,
              data: reqData.keywords ? decodeDepartmentList(value) : decodeDepartments(value),
            } satisfies MainData;
          case 6:
            return { renderType: 6, data: decodeGroupList(value) } satisfies MainData;
          case 4:
          case 7:
            return { renderType: tabItem.type, data: decodeUserList(value) } satisfies MainData;
        }
      },
      incoming => {
        let haveMore = true;
        const previous = this.state.mainData;
        if (incoming.renderType === 2 && Array.isArray(incoming.data) && reqData.onlyMyJoin && !this.state.keywords) {
          this.setState({ defaultCheckedDepId: incoming.data[0]?.departmentId || null });
        }
        if ((reqData.pageIndex || 0) > 1) {
          if (incoming.renderType === 1 && previous?.renderType === 1) {
            const users = incoming.data.users;
            if (users) {
              if (users.list.length < this.state.pageSize) haveMore = false;
              const oldUsers = previous.data.users;
              if (oldUsers) oldUsers.list = [...oldUsers.list, ...users.list];
              incoming.data = previous.data;
            }
          } else if (
            (incoming.renderType === 4 || incoming.renderType === 7) &&
            previous?.renderType === incoming.renderType
          ) {
            if (incoming.data.list.length < this.state.pageSize) haveMore = false;
            incoming.data.list = [...previous.data.list, ...incoming.data.list];
          } else if (incoming.renderType === 6 && previous?.renderType === 6) {
            if (incoming.data.list.length < this.state.pageSize) haveMore = false;
            incoming.data.list = [...previous.data.list, ...incoming.data.list];
          }
        }
        if (incoming.renderType === 1)
          userSettings.filterSystemAccountId.forEach(id => {
            if (incoming.data.oftenUsers) _.remove(incoming.data.oftenUsers.list, item => item.accountId === id);
          });
        this.setState({ mainData: incoming, haveMore, loading: false, isSearch: false });
      },
    );
  };

  /** 请求部门 */
  departmentAction() {
    this.setState({ loading: true });
    return this.runRequest(
      departmentController.searchDepartment({
        projectId: this.commonSettings.projectId,
        keywords: this.state.keywords,
      }),
      decodeDepartments,
      data => {
        this.setState({
          loading: false,
          mainData: {
            renderType: 5,
            data: this.state.keywords ? this.getSearchDepartmentTree(data) : this.getDepartmentTree(data),
          },
        });
      },
    );
  }

  /** Legacy unconnected group selection has no renderer or selected-group contract. */
  groupAction() {
    if (!this.state.haveMore) return false;
    this.setState({ loading: true });
    return this.runRequest(
      groupController.getGroupsSearch({
        projectId: this.commonSettings.projectId,
        pageSize: this.state.pageSize,
        pageIndex: this.state.pageIndex,
        keyword: this.state.keywords,
      }),
      value => value,
      () => {
        throw new Error('Group selection is not connected to GeneralSelect');
      },
    );
  }

  /** 请求已离职 */
  resignedAction() {
    const { pageSize, pageIndex, keywords, mainData } = this.state;
    if (!this.state.haveMore) return false;
    if (pageIndex === 1) this.setState({ loading: true });
    return this.runRequest(
      userController.getProjectResignedUserList({
        projectId: this.commonSettings.projectId,
        pageSize,
        pageIndex,
        keywords,
      }),
      decodeUserList,
      data => {
        const list = (mainData?.renderType === 7 && pageIndex > 1 ? mainData.data.list : []).concat(data.list);
        this.setState({
          // Preserve the legacy boolean-to-number comparison (its paging behavior is a separate issue).
          haveMore: Number(!data.list.length) < this.state.pageSize,
          mainData: { renderType: 7, data: { list, allCount: data.allCount } },
          loading: false,
          isSearch: false,
        });
      },
    );
  }

  getOriginDepartment(list: SelectDepartment[]) {
    return list.map((group: SelectDepartment) => ({
      departmentId: group.departmentId,
      departmentName: group.departmentName,
      haveSubDepartment: group.haveSubDepartment,
      userCount: group.userCount,
    }));
  }

  getDepartmentTree(data: SelectDepartment[]): DepartmentNode[] {
    return data.map((item: SelectDepartment) => {
      const { departmentId, departmentName, userCount, haveSubDepartment } = item;
      let disabled = false;

      if (this.departmentSettings.disabledDepartmentIds.indexOf(departmentId) >= 0) {
        disabled = true;
      }

      return {
        departmentId,
        departmentName,
        userCount,
        haveSubDepartment,
        open: false,
        disabled, // 是否禁用
        subDepartments: [],
      };
    });
  }

  getSearchDepartmentTree(data: SelectDepartment[]): DepartmentNode[] {
    return data.map((item: SelectDepartment) => {
      let { departmentId, departmentName, userCount, haveSubDepartment } = item;
      let subDepartments: DepartmentNode[] = this.getSearchDepartmentTree(item.subDepartments || []);

      let disabled = false;

      if (this.departmentSettings.disabledDepartmentIds.indexOf(departmentId) >= 0) {
        disabled = true;
      }

      return {
        departmentId,
        departmentName,
        userCount,
        haveSubDepartment,
        open: true,
        disabled,
        subDepartments,
      };
    });
  }

  /** 获取部门和群组的key值 */
  getKeys = (tabId: string) => {
    let ID: 'departmentId' | 'groupId' | null = null;
    let NAME: 'departmentName' | 'name' | null = null;
    let COUNT: 'groupMemberCount' | 'userCount' | null = null;

    switch (tabId) {
      case UserTabsId.DEPARTMENT:
        ID = 'departmentId';
        NAME = 'departmentName';
        COUNT = 'userCount';
        break;
      case UserTabsId.GROUP:
        ID = 'groupId';
        NAME = 'name';
        COUNT = 'groupMemberCount';
        break;
    }

    return {
      ID,
      NAME,
      COUNT,
    };
  };

  /** tabId换成renderType */
  getRenderTypeByTabId(tabId: string) {
    let renderType;

    if (tabId === UserTabsId.CONACT_USER) {
      renderType = RenderTypes.CONTACK_USER;
    } else if (tabId === UserTabsId.DEPARTMENT) {
      renderType = RenderTypes.DEPARTMENT_USER;
    } else if (tabId === UserTabsId.GROUP) {
      renderType = RenderTypes.GROUP;
    } else if (tabId === UserTabsId.RESIGNED) {
      renderType = RenderTypes.RESIGNED;
    } else {
      renderType = RenderTypes.OTHER_USER;
    }

    return renderType;
  }

  /**
   * 遍历部门树得到部门
   * @param {*部门树} departmentTree
   * @param {*部门id} id
   * @return {*部门} department
   */
  getDepartmentById(departmentTree: DepartmentNode[], id: string): DepartmentNode | undefined {
    for (let i = 0; i < departmentTree.length; i++) {
      let department = departmentTree[i];
      if (!department) continue;

      if (department.departmentId === id) {
        return department;
      } else if (department.subDepartments.length) {
        let oDepartment = this.getDepartmentById(department.subDepartments, id);

        if (oDepartment) {
          return this.getDepartmentById(department.subDepartments, id);
        }
      }
    }
    return undefined;
  }
  /* ---------------------------------------------------------------------------------------------------
    -----------------------------------         绑定方法        -----------------------------------------
    ---------------------------------------------------------------------------------------------------- */

  /** 成员修改筛选 */
  onChangeUserFilter = (id: string) => {
    this.searchDefault.cancel();
    this.setState(
      {
        selectedUserTabId: id,
        chooseType: ChooseType.USER,
        keywords: '',
        pageIndex: 1,
        currentIndex: -1,
        haveMore: true,
      },
      () => {
        this.userAction();
      },
    );
  };

  changeSelect(entry: SelectedEntity) {
    if (entry.type === 'department') {
      const department = this.selectedDepartment.find(item => item.departmentId === entry.data.departmentId);
      if (department) this.deleteData(entry.type, department.departmentId, 'departmentId');
      else this.addData(entry);
    } else {
      const user = this.selectedUsers.find(item => item.accountId === entry.data.accountId);
      if (user) this.deleteData(entry.type, user.accountId, 'accountId');
      else this.addData(entry);
    }
  }
  toogleUserSelect = (user: SelectUser) => this.changeSelect({ type: 'user', data: user });
  toogleDepargmentSelect = (department: SelectDepartment) =>
    this.changeSelect({ type: 'department', data: department });
  deleteData = (chooseType: ChooseMode, id: string, _idKey: 'accountId' | 'departmentId') => {
    this.setState({
      selectedData: this.state.selectedData.filter(
        item =>
          item.type !== chooseType ||
          (item.type === 'department' ? item.data.departmentId : item.data.accountId) !== id,
      ),
    });
  };
  addData = (entry: SelectedEntity) => {
    let selectedArr = [...this.state.selectedData];
    if (entry.type === 'user' && this.userSettings.unique)
      selectedArr = selectedArr.filter(item => item.type !== 'user');
    selectedArr.push(entry);
    this.setState({ selectedData: selectedArr });
    setTimeout(() => {
      if (!this.unmounted && this._resultScrollView)
        this._resultScrollView.scrollTop = this._resultScrollView.scrollHeight;
    }, 0);
  };

  /**
   * 打开或关闭部门列表
   * @param {*部门id} id
   */
  toggleDepartmentList = (id: string) => {
    if (this.state.mainData?.renderType !== 5) return false;
    let departmentTree = [...this.state.mainData.data];
    let department = this.getDepartmentById(departmentTree, id);

    if (!department || !department.haveSubDepartment) {
      return false;
    }

    if (!department.open) {
      if (department.subDepartments.length) {
        department.open = true;
      } else {
        this.runRequest(
          departmentController.getProjectSubDepartmentByDepartmentId({
            projectId: this.commonSettings.projectId,
            departmentId: department.departmentId,
          }),
          decodeDepartments,
          data => {
            department.subDepartments = this.getDepartmentTree(data);
            department.open = true;
            this.setState({ mainData: { renderType: RenderTypes.DEPARTMENT, data: departmentTree } });
          },
        );
        return false;
      }
    } else {
      department.open = false;
    }

    this.setState({
      mainData: {
        renderType: RenderTypes.DEPARTMENT,
        data: departmentTree,
      },
    });
    return undefined;
  };

  /** 改变字母筛选 */
  changeFirstLetter = () => {
    this.setState(
      {
        pageIndex: 1,
        haveMore: true,
      },
      () => this.userAction(),
    );
  };

  /** 搜索 */
  search = (keywords: string) => {
    this.requestVersion++;
    this.promiseObj && this.promiseObj.abort?.();
    this.promiseObj = null;
    const { showTabs = [] } = this.userSettings;

    if (!keywords) {
      this.closeSearch();
      return;
    }

    let selectedTabId: string = UserTabsId.CONACT_USER;

    if (keywords) {
      const searchTabs = this.getDefaultSearchTabs();
      const curTab = _.find(searchTabs, { id: this.state.selectedUserTabId });

      if (curTab) {
        selectedTabId = curTab.id;
      }
    }

    if (_.includes(showTabs, 'structureUsers')) {
      selectedTabId = 'structureUsers';
    } else if (_.includes(showTabs, 'ruleMember')) {
      selectedTabId = 'ruleMember';
    }

    this.setState(
      {
        keywords,
        pageIndex: 1,
        haveMore: true,
        currentIndex: -1,
        selectedUserTabId: selectedTabId,
        isSearch: true,
      },
      () => {
        this.searchDefault();
      },
    );
  };

  searchDefault = _.debounce(() => this.defaultAction(), 500);

  /** 关闭搜索 */
  closeSearch = () => {
    this.searchDefault.cancel();
    const { showTabs = [] } = this.userSettings;
    let selectedTabId: string = UserTabsId.CONACT_USER;

    if (_.includes(showTabs, 'structureUsers')) {
      selectedTabId = 'structureUsers';
    } else if (_.includes(showTabs, 'ruleMember')) {
      selectedTabId = 'ruleMember';
    }

    this.setState(
      {
        keywords: '',
        pageIndex: 1,
        currentIndex: -1,
        haveMore: true,
        chooseType: ChooseType.USER,
        selectedUserTabId: selectedTabId,
      },
      () => this.defaultAction(),
    );
  };

  getUserBranch(id: string) {
    const main = this.state.mainData;
    const tab = this.getTabItem();
    if (main?.renderType === 2 && !Array.isArray(main.data) && tab?.type === 2) {
      const group = main.data.list.find(item => item.departmentId === id);
      if (!group) return undefined;
      return {
        main,
        group,
        count: group.userCount,
        request: () =>
          tab.actions.getDepartmentUsers({
            departmentId: id,
            keywords: '',
            filterAccountIds: this.userSettings.filterAccountIds,
            projectId: this.commonSettings.projectId,
          }),
        decode: (value: unknown) => decodeUserList(value).list,
      };
    }
    if (main?.renderType === 6 && tab?.type === 6) {
      const group = main.data.list.find(item => item.groupId === id);
      if (!group) return undefined;
      return {
        main,
        group,
        count: group.groupMemberCount,
        request: () =>
          tab.actions.getGroupUsers({
            groupId: id,
            keywords: '',
            filterAccountIds: this.userSettings.filterAccountIds,
          }),
        decode: decodeUsers,
      };
    }
    return undefined;
  }
  /** 打开部门或群组联系人中的部门 */
  toggleUserItem = (id: string): Promise<void> | undefined => {
    const branch = this.getUserBranch(id);
    if (!branch) return undefined;
    const { main, group, count } = branch;
    const update = (users?: SelectUser[]) => {
      if (users) group.users = users;
      group.open = !group.open;
      this.setState({ mainData: main });
    };
    if (group.open || (group.users || []).length === count) update();
    else return this.runRequest(branch.request(), branch.decode, update, () => this.toggleUserItem(id));
    return undefined;
  };
  /** 全选部门或群组联系人 */
  allSelectUserItem = (id: string, checked: boolean): Promise<void> | undefined => {
    const branch = this.getUserBranch(id);
    if (!branch) return undefined;
    const { main, group, count } = branch;
    let selectedData = this.state.selectedData;
    const selectAll = (list: SelectUser[]) => {
      group.users = list;
      const entries: SelectedEntity[] = list
        .filter(user => !_.includes(this.userSettings.selectedAccountIds, user.accountId))
        .map(user => ({ type: 'user', data: user }));
      selectedData = _.uniqBy(selectedData.concat(entries), item => item.type === 'user' && item.data.accountId);
      // Preserve the original shallow list replacement.
      if (main.renderType === 2 && !Array.isArray(main.data)) main.data.list = main.data.list.map(item => item);
      else if (main.renderType === 6) main.data.list = main.data.list.map(item => item);
      this.setState({ mainData: main, selectedData });
    };
    if (count !== undefined && (group.users || []).length < count)
      return this.runRequest(branch.request(), branch.decode, selectAll, () => this.allSelectUserItem(id, checked));
    const list = group.users || [];
    if (checked)
      this.setState({
        selectedData: selectedData.filter(
          item => !list.some(user => user.accountId === (item.type === 'department' ? undefined : item.data.accountId)),
        ),
      });
    else selectAll(list);
    return undefined;
  };

  changeChooseType = (type: ChooseMode) => {
    this.setState(
      {
        chooseType: type,
        keywords: '',
        pageIndex: 1,
        currentIndex: -1,
        haveMore: true,
      },
      () => {
        this.defaultAction();
      },
    );
  };

  dropdownOnClick = () => {
    if (this.state.chooseType !== ChooseType.USER) {
      this.changeChooseType(ChooseType.USER);
      return false;
    }

    return true;
  };

  /** 提交 */
  submit = () => {
    let selectedUsers = this.selectedUsers;
    let selectedDepartments = this.selectedDepartment;
    let selectedResigned = this.state.selectedData
      .filter((item): item is SelectedEntity & { type: 'resigned' } => item.type === 'resigned')
      .map(item => item.data);

    if (
      this.commonSettings.selectModes.indexOf('user') >= 0 &&
      !this.userSettings.allowSelectNull &&
      !selectedUsers.length
    ) {
      alert(_l('请选择用户'), 3);
      return;
    }

    let data: SubmitData = {
      users: [],
      departments: [],
      groups: [],
    };
    let params = this.commonSettings.selectModes.map(mode => {
      if (mode === ChooseType.USER) {
        let users = selectedUsers;
        data.users = users;
        return users;
      }

      if (mode === ChooseType.DEPARTMENT) {
        let departments = this.getOriginDepartment(selectedDepartments);
        data.departments = departments;
        return departments;
      }

      if (mode === ChooseType.RESIGNED) {
        let resigned = selectedResigned;
        data.resigned = selectedResigned;
        return resigned;
      }

      return null;
    });
    Reflect.apply(this.userSettings.callback, this.userSettings, params); // 兼容老的selectUsers回调
    this.commonSettings.callback(data);
  };
  /* ---------------------------------------------------------------------------------------------------
    --------------------------------------         渲染        ------------------------------------------
    ---------------------------------------------------------------------------------------------------- */

  refreshOftenUser = (): Promise<void> | undefined => {
    const mainData = this.state.mainData;
    if (mainData?.renderType !== 1) return undefined;
    return this.runRequest(
      userController.getOftenMetionedUser({
        count: 50,
        filterAccountIds: [md.global.Account.accountId],
        includeUndefinedAndMySelf: this.userSettings.includeUndefinedAndMySelf,
        includeSystemField: this.userSettings.includeSystemField,
        prefixAccountIds: this.userSettings.prefixAccountIds,
        projectId: this.props.commonSettings.projectId,
      }),
      decodeUsers,
      res => {
        const newList = (mainData.data.oftenUsers?.list || [])
          .filter(user => ['user-undefined', md.global.Account.accountId].includes(user.accountId))
          .concat(res);
        this.setState({
          mainData: { ...mainData, data: { ...mainData.data, oftenUsers: { list: _.unionBy(newList, 'accountId') } } },
        });
      },
    );
  };

  renderUsersList() {
    const { commonSettings } = this.props;
    let mainData = this.state.mainData;

    if (!mainData) {
      return null;
    }

    switch (mainData.renderType) {
      /** 渲染所有人列表 */
      case RenderTypes.CONTACK_USER:
        return (
          <DefaultUserList
            projectId={commonSettings.projectId}
            data={mainData.data}
            includeMySelf={this.userSettings.includeMySelf}
            includeUndefinedAndMySelf={this.userSettings.includeUndefinedAndMySelf}
            onChange={this.toogleUserSelect}
            selectedUsers={this.selectedUsers}
            keywords={this.state.keywords}
            currentIndex={this.state.currentIndex}
            selectedAccountIds={this.userSettings.selectedAccountIds}
            hideOftenUsers={this.userSettings.hideOftenUsers}
            hideManageOftenUsers={this.userSettings.hideManageOftenUsers}
            refreshOftenUser={this.refreshOftenUser}
            dialogSelectUser={this.props.dialogSelectUser}
          />
        );
      /** 渲染部门选人列表 */
      case RenderTypes.DEPARTMENT_USER:
        if (this.state.keywords) {
          return (
            <DepartmentGroupUserList
              projectId={commonSettings.projectId}
              data={Array.isArray(mainData.data) ? { list: mainData.data } : mainData.data}
              onChange={this.toogleUserSelect}
              toggleUserItem={this.toggleUserItem}
              allSelectUserItem={this.allSelectUserItem}
              selectedUsers={this.selectedUsers}
              tabType={UserTabsId.DEPARTMENT}
              unique={this.userSettings.unique}
              keywords={this.state.keywords}
              selectedAccountIds={this.userSettings.selectedAccountIds}
              userAction={this.userAction}
            />
          );
        } else {
          return (
            <DepartmentTree
              isNetwork={commonSettings.isSuperWork}
              data={
                (_.isArray(mainData.data) &&
                  mainData.data.map(item => ({
                    ...item,
                    name: item.departmentName,
                    id: item.departmentId,
                    subs: [],
                  }))) ||
                []
              }
              onChange={this.toogleUserSelect}
              selectedUsers={this.selectedUsers}
              userSettings={this.userSettings}
              projectId={commonSettings.projectId}
              removeSelectedData={data => {
                let selectedArr = [...this.state.selectedData];
                this.setState({
                  selectedData: selectedArr.filter(
                    item => item.type === 'department' || !data.includes(item.data.accountId),
                  ),
                });
              }}
              unique={this.userSettings.unique}
              addSelectedData={data => {
                this.setState({
                  selectedData: this.state.selectedData.concat(data),
                });
              }}
              userAction={this.userAction}
              defaultCheckedDepId={this.state.defaultCheckedDepId}
              selectedAccountIds={this.userSettings.selectedAccountIds}
            />
          );
        }

      /** 渲染群组列表 */
      case RenderTypes.GROUP:
        return (
          <DepartmentGroupUserList
            projectId={commonSettings.projectId}
            data={mainData.data}
            onChange={this.toogleUserSelect}
            toggleUserItem={this.toggleUserItem}
            allSelectUserItem={this.allSelectUserItem}
            selectedUsers={this.selectedUsers}
            tabType={UserTabsId.GROUP}
            unique={this.userSettings.unique}
            keywords={this.state.keywords}
            userAction={this.userAction}
            selectedAccountIds={this.userSettings.selectedAccountIds}
          />
        );
      /** 渲染其他类型选人列表 */
      case RenderTypes.RESIGNED:
      case RenderTypes.OTHER_USER:
        return (
          <ExtraUserList
            projectId={commonSettings.projectId}
            data={mainData.data}
            onChange={this.toogleUserSelect}
            selectedUsers={this.selectedUsers}
            keywords={this.state.keywords}
            currentIndex={this.state.currentIndex}
            selectedAccountIds={this.userSettings.selectedAccountIds}
          />
        );
      default:
        return null;
    }
  }

  /** 用户已选择列表 */
  renderResult() {
    return this.state.selectedData.map(item => {
      let avatar: React.JSX.Element | null = null;
      let id = null;
      let name = null;

      let deleteFn: (id: string) => void = () => {};

      switch (item.type) {
        case ChooseType.USER:
        case ChooseType.RESIGNED:
          avatar = <img src={(item.data || {}).avatar} alt="头像" className="GSelect-result-subItem__avatar" />;
          id = (item.data || {}).accountId;
          name = (item.data || {}).fullname;
          deleteFn = (accountId: string) => {
            this.deleteData(item.type, accountId, 'accountId');
          };

          break;
        case ChooseType.DEPARTMENT:
          avatar = (
            <div className="GSelect-result-subItem__avatar">
              <i className="icon-department" />
            </div>
          );
          id = (item.data || {}).departmentId;
          name = (item.data || {}).departmentName;
          deleteFn = departmentId => {
            this.deleteData(item.type, departmentId, 'departmentId');
          };

          break;
      }

      const props = {
        avatar,
        id,
        name,
        deleteFn,
      };
      return <Result {...props} key={id} />;
    });
  }

  /** 选择用户 */
  renderUsersContent() {
    return <div className="GSelect-usersContent h100">{this.renderUsersList()}</div>;
  }

  /** 选择部门 */
  renderDepartmentContent() {
    const main = this.state.mainData;
    if (main?.renderType !== 5) return null;
    return (
      <div className="GSelect-departmentContent">
        {main.data.length ? (
          <DepartmentList
            data={main.data}
            treeData={main.data}
            toogleDepargmentSelect={this.toogleDepargmentSelect}
            toggleDepartmentList={this.toggleDepartmentList}
            selectedDepartment={this.selectedDepartment}
            keywords={this.state.keywords}
          />
        ) : (
          <NoData>{this.state.keywords ? _l('无搜索结果') : _l('暂无成员')}</NoData>
        )}
      </div>
    );
  }
  getCount = (tabId: string): number | undefined => {
    const main = this.state.mainData;
    if (!main || this.getRenderTypeByTabId(tabId) !== main.renderType) return undefined;
    if (main.renderType === 1)
      return _.uniqBy((main.data.users?.list || []).concat(main.data.oftenUsers?.list || []), 'accountId').length;
    if (main.renderType === 7 && tabId === UserTabsId.RESIGNED) return main.data.allCount;
    if (main.renderType === 2) return Array.isArray(main.data) ? undefined : main.data.list.length;
    if (main.renderType === 4 || main.renderType === 6 || main.renderType === 7) return main.data.list.length;
    return undefined;
  };

  getDefaultSearchTabs = () => {
    const searchTabs = (this.userSettings.defaultTabs || []).filter(i =>
      _.includes([UserTabsId.CONACT_USER, UserTabsId.DEPARTMENT, UserTabsId.GROUP], i.id),
    );

    if (!this.userSettings.filterResigned) {
      return searchTabs.concat(SearchUserTabs);
    }

    return searchTabs;
  };

  renderTabs() {
    const { keywords } = this.state;

    if (keywords) {
      const searchTabs = this.getDefaultSearchTabs();

      return (
        <ul className="GSelect-head-search-navbar">
          {searchTabs.map(tab => (
            <li
              key={tab.id}
              onClick={() => {
                this.setState(
                  {
                    selectedUserTabId: tab.id,
                    chooseType: tab.id === UserTabsId.RESIGNED ? ChooseType.RESIGNED : ChooseType.USER,
                    pageIndex: 1,
                    currentIndex: -1,
                    haveMore: true,
                  },
                  () => {
                    this.defaultAction();
                  },
                );
              }}
              className={cx('GSelect-head-search-navbar__item', {
                'GSelect-head-search-navbar__item--active': this.state.selectedUserTabId === tab.id,
              })}
            >
              {tab.id === UserTabsId.CONACT_USER ? _l('成员') : tab.name}
              {!this.state.isSearch && !!this.getCount(tab.id) && (
                <span className="mLeft3">{this.getCount(tab.id)}</span>
              )}
            </li>
          ))}
        </ul>
      );
    } else {
      const userFilterData = this.userSettings.defaultTabs.map(tab => {
        return {
          text: tab.name,
          value: tab.id,
        };
      });
      let Tabs;

      if (this.commonSettings.selectModes.length === 1 && this.commonSettings.selectModes[0] === 'user') {
        // 选择成员模式
        Tabs = this.userSettings.defaultTabs.map(tab => (
          <li
            key={tab.id}
            onClick={() => this.onChangeUserFilter(tab.id)}
            className={cx('GSelect-head-navbar__item', {
              'GSelect-head-navbar__item--active': this.state.selectedUserTabId === tab.id,
            })}
          >
            {tab.name}
          </li>
        ));
      } else {
        // 其他模式
        let SelectUsers: React.JSX.Element | null = (
          <GDropdown
            key="selectUsers"
            data={userFilterData}
            onChange={this.onChangeUserFilter}
            onClick={this.dropdownOnClick}
            value={this.state.selectedUserTabId}
            className={cx('GSelect-head-navbar__item', {
              'GSelect-head-navbar__item--active': this.state.chooseType === ChooseType.USER,
            })}
            renderValue={_l('选择成员（{{value}}）')}
          />
        );
        let SelectDepartments: React.JSX.Element | null = (
          <li
            key="SelectDepartemnts"
            onClick={() => this.changeChooseType(ChooseType.DEPARTMENT)}
            className={cx('GSelect-head-navbar__item', {
              'GSelect-head-navbar__item--active': this.state.chooseType === ChooseType.DEPARTMENT,
            })}
          >
            {_l('选择部门')}
          </li>
        );
        let SelectGroups: React.JSX.Element | null = (
          <li
            key="SelectGroups"
            onClick={() => this.changeChooseType(ChooseType.GROUP)}
            className={cx('GSelect-head-navbar__item borderColorPrimary', {
              'GSelect-head-navbar__item--active': this.state.chooseType === ChooseType.GROUP,
            })}
          >
            {_l('选择群组')}
          </li>
        );

        if (!this.state.isProject) {
          // 不显示联系人的筛选
          SelectUsers = (
            <li
              key="SelectUsers"
              onClick={() => this.changeChooseType(ChooseType.USER)}
              className={cx('GSelect-head-navbar__item', {
                'GSelect-head-navbar__item--active': this.state.chooseType === ChooseType.USER,
              })}
            >
              {_l('选择成员')}
            </li>
          );
          SelectGroups = SelectDepartments = null;
        }

        Tabs = this.commonSettings.selectModes.map(mode => {
          if (mode === ChooseType.USER) {
            return SelectUsers;
          } else if (mode === ChooseType.DEPARTMENT) {
            return SelectDepartments;
          } else if (mode === ChooseType.GROUP) {
            return SelectGroups;
          }

          return null;
        });
      }

      return <ul className="GSelect-head-navbar">{Tabs}</ul>;
    }
  }

  renderHead() {
    const { keywords } = this.state;
    const { showTabs = [] } = this.userSettings;
    return (
      <Fragment>
        <div className="GSelect-head-searchArea">
          <span className="icon-search searchIcon" />
          <input
            name="dialogSelectUserGeneralSelect"
            autoComplete="off"
            type="text"
            value={keywords}
            autoFocus
            onChange={event => this.search(event.target.value)}
            ref={searchInput => {
              this._searchInput = searchInput;
            }}
            placeholder={
              this.checkIsProject() && !_.includes(showTabs, 'structureUsers')
                ? _l('搜索用户 / 部门 / 群组')
                : _l('搜索用户')
            }
          />
          {keywords && (
            <div className="GSelect-head-searchArea--deleteIcon">
              <span className="icon-cancel " onClick={this.closeSearch} />
            </div>
          )}
        </div>
        {this.checkIsProject() && this.renderTabs()}
      </Fragment>
    );
  }

  renderContent() {
    if (this.state.loadError)
      return (
        <div role="alert">
          {this.state.loadError}
          <button onClick={() => this.retryAction()}>{_l('重试')}</button>
        </div>
      );
    if (this.state.loading) {
      return <LoadDiv />;
    }

    if (!this.state.mainData) {
      return null;
    }

    if (
      this.state.mainData.renderType === RenderTypes.CONTACK_USER ||
      this.state.mainData.renderType === RenderTypes.DEPARTMENT_USER ||
      this.state.mainData.renderType === RenderTypes.GROUP ||
      this.state.mainData.renderType === RenderTypes.RESIGNED ||
      this.state.mainData.renderType === RenderTypes.OTHER_USER
    ) {
      return this.renderUsersContent();
    } else if (this.state.mainData.renderType === RenderTypes.DEPARTMENT) {
      return this.renderDepartmentContent();
    }
    return undefined;
  }

  override render() {
    return (
      <div className="GSelect-box" ref={this.boxRef}>
        <div className="GSelect-head">{this.renderHead()}</div>
        <ScrollView
          className="GSelect-container"
          onScrollEnd={this.updateEvent.bind(this)}
          ref={scrollView => {
            this.scrollView = scrollView;
          }}
        >
          {this.renderContent()}
        </ScrollView>
        <div
          className="GSelect-result"
          ref={scrollView => {
            this._resultScrollView = scrollView;
          }}
        >
          <div className="GSelect-result-box">{this.renderResult()}</div>
        </div>
        <div className="GSelect-footer-buttonBox">
          <div className="mRight24">
            <div
              className="closeBtn"
              onClick={evt => {
                evt.nativeEvent.stopImmediatePropagation();
                this.props.handleCancel();
              }}
            >
              {_l('取消')}
            </div>
          </div>
          <div>
            <Tooltip title={_l('确定')} shortcut={window.isMacOs ? '⌘↵' : 'Ctrl + ↵'}>
              <Button
                onClick={(evt: MouseEvent<HTMLButtonElement>) => {
                  evt.nativeEvent.stopImmediatePropagation();
                  this.submit();
                }}
                fullWidth
              >
                {this.commonSettings.btnName +
                  (this.state.selectedData.length ? ` (${this.state.selectedData.length})` : '')}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  }
}
