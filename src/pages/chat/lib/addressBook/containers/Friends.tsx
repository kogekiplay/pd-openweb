import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import API from '../api';
import ContactList from '../components/ContactList';
import ListSearchBar from '../components/ListSearchBar';
import UserDetail from '../components/UserDetail';

import type { AddressBookAccount as AddressBookRow, AddressBookContacts as AddressBookListData, AddressBookContactGroups } from 'src/api/addressBookTypes';

const formatContactsData = (store: AddressBookContactGroups | null, list: AddressBookRow[] | null | undefined): AddressBookContactGroups => {
  const result = store || {};
  _.each(list, item => {
    const { firstCode } = item;
    const title = /[A-Z]/.test((firstCode ?? '').toUpperCase()) ? (firstCode ?? '').toUpperCase() : '#';

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
  // request param
  pageIndex: 1,
  keywords: '',
};

export interface ContactContainerState {
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

export default class Friends extends React.Component<Record<string, never>, ContactContainerState> {
  private requestVersion = 0;
  declare promise: ReturnType<typeof API.fetchFriends> | null;

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
      this.abortRequest();
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
    this.requestVersion += 1;
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

  fetchContacts() {
    const requestVersion = this.requestVersion;
    const { pageIndex, keywords } = this.state;
    this.promise = API.fetchFriends({ pageIndex, keywords });
    return this.promise.then(data => {
      if (requestVersion !== this.requestVersion) return undefined;
      const { listData } = this.state;

      if (keywords) {
        this.setState({
          listData: (Array.isArray(listData) ? listData : []).concat(data.list),
        });
      } else {
        this.setState({
          pageIndex: pageIndex + 1,
          listData: formatContactsData(Array.isArray(listData) ? null : listData, data.list),
        });
      }

      // has more data to load
      return data.list && data.list.length;
    });
  }

  fetch() {
    const requestVersion = this.requestVersion;
    const { isLoading, pageIndex, hasMore } = this.state;
    if (isLoading || !hasMore) return;
    this.setState({
      isLoading: true,
    });
    this.fetchContacts().then(hasMore => {
      if (requestVersion !== this.requestVersion) return;
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

  override render() {
    const { listData, selectedAccountId, isLoading, keywords } = this.state;
    const isSearch = keywords !== '';
    return (
      <React.Fragment>
        <div className="contacts-list">
          <ListSearchBar keywords={keywords} search={this.search} type={'friends'} />
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
