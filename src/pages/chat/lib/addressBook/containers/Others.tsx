import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import API from '../api';
import ContactList from '../components/ContactList';
import ListSearchBar from '../components/ListSearchBar';
import UserDetail from '../components/UserDetail';

import type { AddressBookAccount as AddressBookRow, AddressBookContacts as AddressBookListData, AddressBookContactEntry } from 'src/api/addressBookTypes';

const formatContactsData = (store: AddressBookListData, list: AddressBookRow[] | null | undefined): AddressBookListData => {
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
  selectedAccountId: null,
  isFriend: false,
  isContact: true,
  // request param
  pageIndex: 1,
  keywords: '',
};

interface ContactContainerState {
  listData: AddressBookListData;
  isLoading: boolean;
  /** 首屏为 true，分页后沿用 list && list.length 的条数/缺项。 */
  hasMore: boolean | number | null | undefined;
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

export default class Others extends React.Component<Record<string, never>, ContactContainerState> {
  declare promise: ReturnType<typeof API.fetchOthers> | null;

  constructor(props: Record<string, never>) {
    // 原实现 `super()` 未传 props；React 之后仍会写 this.props，运行等价（Babel 1 行差异）。
    super(props);

    this.state = defaultState;

    this.promise = null;

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

  search(keywords: string) {
    // 擦除标记：原实现未判空，首次搜索时 promise 为 null 会抛原生 TypeError（行为保持）。
    this.promise!.abort();
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

  fetchContacts() {
    const { pageIndex, keywords } = this.state;
    this.promise = API.fetchOthers({ pageIndex, keywords });
    return this.promise.then(data => {
      const { listData } = this.state;

      if (keywords) {
        // 擦除标记：搜索分支 listData 是平铺数组（原 any 直接 concat）。
        this.setState({
          listData: ((listData || []) as AddressBookContactEntry[]).concat(data.list),
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

  itemClickHandler({
    accountId,
    isFriend,
    isContact,
  }: {
    accountId?: string | undefined;
    isFriend?: boolean | undefined;
    isContact?: boolean | undefined;
  }) {
    this.setState({
      selectedAccountId: accountId,
      isFriend,
      isContact,
    });
  }

  override render() {
    const { listData, selectedAccountId, isLoading, keywords } = this.state;
    const isSearch = keywords !== '';
    return (
      <React.Fragment>
        <div className="contacts-list">
          <ListSearchBar keywords={keywords} search={this.search} type="contacts" />
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
