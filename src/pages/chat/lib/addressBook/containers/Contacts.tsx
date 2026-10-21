import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import Checkbox from 'ming-ui/components/Checkbox';
import API from '../api';
import ContactList from '../components/ContactList';
import ListSearchBar from '../components/ListSearchBar';
import UserDetail from '../components/UserDetail';

/** 地址簿列表行（各容器从接口拿到后按首字母分组/平铺渲染的同一形态） */
interface AddressBookRow {
  accountId?: string | undefined;
  avatar?: string | undefined;
  fullname?: string | undefined;
  /** 首字母（接口返回，用于分组标题） */
  firstCode?: string | undefined;
  isFriend?: boolean | undefined;
  isContact?: boolean | undefined;
}

/** 列表数据：无关键词时按首字母分组，搜索时是平铺数组 */
type AddressBookListData = Record<string, AddressBookRow[]> | AddressBookRow[] | null;

const formatContactsData = (store: AddressBookListData, list: AddressBookRow[]): AddressBookListData => {
  // 擦除标记：分组结果就是「首字母 → 行数组」字典（原 any 直接当字典用）。
  const result = (store || {}) as Record<string, AddressBookRow[]>;
  _.each(list, item => {
    const { firstCode } = item;
    // 擦除标记：接口行必带 firstCode（原 any 直接 toUpperCase）。
    const title = /[A-Z]/.test((firstCode as string).toUpperCase()) ? (firstCode as string).toUpperCase() : '#';

    if (!result[title]) {
      result[title] = [];
    }

    // 擦除标记：上面刚保证该键存在（原 any 直接 push）。
    result[title]!.push(item);
    // result[title] = _.uniqBy(result[title], (item) => item.accountId);
  });

  return result;
};

const defaultState = {
  // store
  listData: null,
  // list state
  isLoading: false,
  hasMore: true,
  // 选中状态
  selectedAccountId: null,
  // request param
  pageIndex: 1,
  keywords: '',
  isFilterOther: true,
};

interface ContactContainerState {
  listData: AddressBookListData;
  isLoading: boolean;
  /** 首屏为 true，分页后沿用 list && list.length 的条数/缺项。 */
  hasMore: boolean | number | undefined;
  /** 初始为 null，点击行后写入（可能为 undefined——原实现直接赋值） */
  selectedAccountId: string | null | undefined;
  pageIndex: number;
  keywords: string;
  /** 仅 Contacts：是否过滤其它协作关系 */
  isFilterOther?: boolean | undefined;
  /** 仅 Others：选中行的好友/联系人标记 */
  isFriend?: boolean | undefined;
  isContact?: boolean | undefined;
}

export default class Contacts extends React.Component<Record<string, never>, ContactContainerState> {
  declare promise: ApiResult | null;

  constructor(props: Record<string, never>) {
    // 原实现 `super()` 未传 props；React 之后仍会写 this.props，运行等价（Babel 1 行差异）。
    super(props);

    this.state = defaultState;
    this.promise = null;

    this.changeFilter = this.changeFilter.bind(this);
    this.search = this.search.bind(this);
    this.fetch = this.fetch.bind(this);
    this.fetchContacts = this.fetchContacts.bind(this);
    this.itemClickHandler = this.itemClickHandler.bind(this);
  }

  override componentDidUpdate(prevProps: Record<string, never>) {
    if (!shallowEqual(prevProps, this.props)) {
      this.setState(defaultState, this.fetch);
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

  fetchContacts() {
    const { pageIndex, keywords, isFilterOther } = this.state;
    this.promise = API.fetchAllContacts({ pageIndex, isFilterOther, keywords });
    return this.promise.then(data => {
      const { listData } = this.state;

      if (keywords) {
        // 擦除标记：搜索分支 listData 是平铺数组（原 any 直接 concat）。
        this.setState({
          listData: ((listData || []) as AddressBookRow[]).concat(data.list),
        });
      } else {
        this.setState({
          pageIndex: pageIndex + 1,
          listData: formatContactsData(listData, data.list),
        });
      }

      // has more data to load
      return data.list && data.list.length;
    });
  }

  changeFilter() {
    const { isFilterOther } = this.state;
    this.setState(
      {
        isFilterOther: !isFilterOther,
        pageIndex: 1,
        hasMore: true,
        listData: null,
      },
      this.fetch,
    );
  }

  search(keywords: string) {
    this.abortRequest();

    this.setState(
      {
        isLoading: false,
        pageIndex: 1,
        keywords,
        hasMore: true,
        listData: null,
      },
      this.fetch,
    );
  }

  fetch() {
    const { isLoading, pageIndex, hasMore } = this.state;
    if (isLoading || !hasMore) return;
    this.setState({
      isLoading: true,
    });
    this.fetchContacts().then(hasMore => {
      this.setState({
        isLoading: false,
        pageIndex: pageIndex + 1,
        hasMore,
      });
    });
  }

  itemClickHandler({ accountId }: { accountId?: string | undefined }) {
    this.setState({
      selectedAccountId: accountId,
    });
  }

  renderFilter() {
    const { isFilterOther } = this.state;
    return (
      <div className="pBottom2 pTop10 pLeft15 textSecondary">
        <Checkbox checked={isFilterOther} text={_l('不显示其他协作关系')} onClick={this.changeFilter} />
      </div>
    );
  }

  override render() {
    const { listData, keywords, selectedAccountId, isLoading } = this.state;
    const isSearch = keywords !== '';
    return (
      <React.Fragment>
        <div className="contacts-list">
          <ListSearchBar search={this.search} keywords={keywords} type={'contacts'} />
          {/*isSearch ? null : this.renderFilter()*/}
          <div className="contacts-list-content">
            <ContactList
              isSearch={isSearch}
              selectedAccountId={selectedAccountId}
              list={listData}
              isLoading={isLoading}
              fetch={this.fetch}
              itemClickHandler={this.itemClickHandler}
            />
          </div>
        </div>
        <div className="contacts-detail">
          <UserDetail accountId={selectedAccountId} />
        </div>
      </React.Fragment>
    );
  }
}
