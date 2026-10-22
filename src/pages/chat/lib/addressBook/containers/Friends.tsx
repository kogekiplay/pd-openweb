import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import API from '../api';
import ContactList from '../components/ContactList';
import ListSearchBar from '../components/ListSearchBar';
import UserDetail from '../components/UserDetail';

import type { AddressBookAccount as AddressBookRow, AddressBookContactGroups } from 'src/api/addressBookTypes';

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

export type { ContactContainerState } from '../contactViewTypes';
import type { ContactContainerState } from '../contactViewTypes';

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
