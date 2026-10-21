import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import PropTypes from 'prop-types';
import API from '../api';
import GroupDetail from '../components/GroupDetail';
import GroupFilter from '../components/GroupFilter';
import GroupList from '../components/GroupList';
import JoinGroup from '../components/JoinGroup';
import ListSearchBar from '../components/ListSearchBar';
import { GROUP_STATUS, SEARCH_GROUP_TYPES } from '../constants';
import type { AddressBookGroupDetail, AddressBookGroupPatch } from '../types';

/** 群列表数据的两种形态：不带关键词时按首字母分组，带关键词时是平铺数组 */
type GroupListData = Record<string, AddressBookGroupDetail[]> | AddressBookGroupDetail[];

interface GroupsProps {
  projectId?: string | null | undefined;
}

interface GroupsState {
  /** store */
  listData: GroupListData | null;
  /** list state */
  selectedGroupId: string | null | undefined;
  isLoading: boolean;
  /**
   * 是否还能继续加载。初始化/刷新时是 `true`；翻页后被写成 `fetchGroups()` 返回的**本次条数**
   * （number，0 表示没有更多）。唯一读取处是 `!hasMore` 的真值判定，故如实标成两态而非强称 boolean。
   */
  hasMore: boolean | number;
  /** request param */
  pageIndex: number;
  keywords: string;
  /** Dropdown 可能回传 undefined（未选），原实现同样原样写入 */
  searchGroupType: number | undefined;
  groupStatus: number;
}

const formatGroupsData = (
  store: Record<string, AddressBookGroupDetail[]> | null | undefined,
  list: AddressBookGroupDetail[],
) => {
  const result = store || {};
  _.each(list, (item: AddressBookGroupDetail) => {
    const { firstCode } = item;
    // 缺失值仍在同一读取点抛原生异常，不伪称接口字段必有。
    const title = /[A-Z]/.test(firstCode!.toUpperCase()) ? firstCode!.toUpperCase() : '#';

    if (!result[title]) {
      result[title] = [];
    }

    result[title]!.push(item);
  });

  return result;
};

const defaultState: GroupsState = {
  // store
  listData: null,
  // list state
  selectedGroupId: null,
  isLoading: false,
  hasMore: true,
  // request param
  pageIndex: 1,
  keywords: '',
  searchGroupType: SEARCH_GROUP_TYPES.JOINED,
  groupStatus: GROUP_STATUS.OPEN,
};

export default class ProjectGroups extends React.Component<GroupsProps, GroupsState> {
  declare promise: ApiResult | null;
  declare listContent: HTMLDivElement | null | undefined;

  static override propTypes = {
    projectId: PropTypes.string,
  };

  static defaultProps = {
    projectId: '',
  };

  constructor(props: GroupsProps) {
    super(props);

    this.state = defaultState;

    this.promise = null;

    this.search = this.search.bind(this);
    this.changeFilter = this.changeFilter.bind(this);
    this.changeStatus = this.changeStatus.bind(this);
    this.fetch = this.fetch.bind(this);
    this.fetchGroups = this.fetchGroups.bind(this);
    this.itemClickHandler = this.itemClickHandler.bind(this);
    this.updateGroupModel = this.updateGroupModel.bind(this);
  }

  override componentDidUpdate(prevProps: GroupsProps) {
    if (!shallowEqual(prevProps, this.props)) {
      this.setState(defaultState, this.fetch.bind(this));
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

  fetchGroups() {
    const { pageIndex, keywords, searchGroupType, groupStatus } = this.state;
    const { projectId } = this.props;
    const params = { pageIndex, keywords, projectId, searchGroupType };
    this.promise = API.fetchAllGroups(keywords ? { ...params } : { ...params, groupStatus });
    return this.promise.then((data: { list: AddressBookGroupDetail[] }) => {
      const { listData } = this.state;

      if (keywords) {
        this.setState({
          // 擦除标记：带关键词时 listData 是平铺数组（原 any 直接 concat）。
          listData: ((listData as AddressBookGroupDetail[] | null) || []).concat(data.list),
        });
      } else {
        this.setState({
          listData: formatGroupsData(listData as Record<string, AddressBookGroupDetail[]> | null, data.list),
        });
      }

      // has more data to load
      return data.list && data.list.length;
    });
  }

  fetch() {
    const { isLoading, hasMore, pageIndex } = this.state;
    if (isLoading || !hasMore) return;
    this.setState({
      isLoading: true,
    });
    this.fetchGroups().then((_hasMore: number) => {
      this.setState({
        pageIndex: pageIndex + 1,
        isLoading: false,
        hasMore: _hasMore,
      });
    });
  }

  updateGroupModel(groupId: string, info: AddressBookGroupPatch) {
    const { listData } = this.state;
    const keys = _.keys(listData);
    const result: Record<string, AddressBookGroupDetail[]> = {};
    _.forEach(keys, (key: string) => {
      // 擦除标记：该分支只处理分组形态（原 any 直接取）。
      const list = (listData as Record<string, AddressBookGroupDetail[]>)[key]!;
      result[key] = _.map(list, (group: AddressBookGroupDetail) => {
        if (group.groupId === groupId) {
          return {
            ...group,
            ...info,
          };
        } else {
          return group;
        }
      }).filter((l: AddressBookGroupDetail) => !l.isDelete);
    });
    this.setState({
      listData: result,
    });
  }

  getGroupModel(groupId: string | null | undefined): AddressBookGroupDetail | null | undefined {
    const { listData, keywords } = this.state;
    let result: AddressBookGroupDetail | null | undefined = null;

    if (keywords) {
      result = _.find(listData as AddressBookGroupDetail[], (group: AddressBookGroupDetail) => group.groupId === groupId);
    } else {
      const keys = _.keys(listData);
      _.forEach(keys, (key: string) => {
        const list = (listData as Record<string, AddressBookGroupDetail[]>)[key]!;
        result = _.find(list, (group: AddressBookGroupDetail) => {
          return group.groupId === groupId;
        });
        if (result) return false;
        return undefined;
      });
    }

    return result;
  }

  itemClickHandler(id: string) {
    this.setState({
      selectedGroupId: id,
    });
  }

  renderFilter() {
    return (
      <GroupFilter
        isProject={!!this.props.projectId}
        changeGroupFilter={this.changeFilter}
        changeGroupStatus={this.changeStatus}
        searchGroupType={this.state.searchGroupType}
        groupStatus={this.state.groupStatus}
      />
    );
  }

  search(keywords: string) {
    this.abortRequest();
    this.setState(
      {
        isLoading: false,
        keywords,
        pageIndex: 1,
        hasMore: true,
        listData: null,
        selectedGroupId: null,
      },
      this.fetch,
    );
  }

  // 擦除标记：Dropdown 回传 number|undefined；未选时原实现同样写入 state（原 any 透传）。
  changeFilter(searchGroupType: number | undefined) {
    this.setState(
      {
        pageIndex: 1,
        hasMore: true,
        listData: null,
        searchGroupType,
      },
      this.fetch,
    );
  }

  changeStatus() {
    this.setState(({ groupStatus }) => {
      if (groupStatus === GROUP_STATUS.ALL) {
        return {
          pageIndex: 1,
          hasMore: true,
          listData: null,
          groupStatus: GROUP_STATUS.OPEN,
        };
      } else {
        return {
          pageIndex: 1,
          hasMore: true,
          listData: null,
          groupStatus: GROUP_STATUS.ALL,
        };
      }
    }, this.fetch);
  }

  // updateFixedTip(position) {
  //     if (position < 32) {
  //         this.setState({
  //             showTip: false,
  //         });
  //         return;
  //     }
  //     const $lists = $(this.listContent).find('.list-wrapper');
  //     for (var i = 0, len = $lists.length; i < len; i++) {
  //         var $list = $lists.eq(i);
  //         var _top = parseInt($list.position().top, 10);
  //         var _height = $list.height();

  //         if (_top < 32 && Math.abs(_top) + 32 < _height) {
  //             this.setState({
  //                 showTip: true,
  //                 tip: $list.find('.list-packet').html(),
  //             });
  //             break;
  //         } else {
  //             this.setState({
  //                 showTip: false,
  //             });
  //         }
  //     }
  // }

  // renderTip() {
  //     const { showTip, tip } = this.state;
  //     if (showTip && tip) {
  //         return <div className='list-packet fixed textSecondary Font12'>{tip}</div>
  //     } else {
  //         return null;
  //     }
  // }

  renderDetail() {
    const { selectedGroupId, groupStatus } = this.state;
    const selectedGroup = this.getGroupModel(selectedGroupId);

    // 擦除标记：群列表项的成员标记在索引签名里（原 any 直接读）。
    if (
      selectedGroupId &&
      selectedGroup &&
      !selectedGroup.isMember
    ) {
      return <JoinGroup groupId={selectedGroupId} />;
    }

    return <GroupDetail group={selectedGroup as AddressBookGroupDetail | undefined} groupStatus={groupStatus} updateGroupModel={this.updateGroupModel} />;
  }

  override render() {
    const { listData, isLoading, selectedGroupId, keywords } = this.state;
    return (
      <React.Fragment>
        <div className="contacts-list">
          <ListSearchBar search={this.search} keywords={keywords} type={'groups'} projectId={this.props.projectId} />
          {keywords ? null : this.renderFilter()}
          <div
            className="contacts-list-content"
            ref={el => {
              this.listContent = el;
            }}
          >
            <GroupList
              isSearch={!!keywords}
              selectedGroupId={selectedGroupId}
              list={listData}
              isLoading={isLoading}
              fetch={this.fetch}
              itemClickHandler={this.itemClickHandler}
            />
          </div>
        </div>
        <div className="contacts-detail">{this.renderDetail()}</div>
      </React.Fragment>
    );
  }
}
