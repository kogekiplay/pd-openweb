import type { InboxEndpoint } from './inboxTypes';

/** The asynchronous address-book endpoints return the original abortable request. */
export type AddressBookRequest<T> = Promise<T> & { abort: () => void };

/** Fields read or forwarded by the contact and recommendation rows. */
export interface AddressBookAccount {
  accountId?: string | undefined;
  avatar?: string | undefined;
  fullname?: string | undefined;
  companyName?: string | undefined;
  firstCode?: string | undefined;
  isContact?: boolean | undefined;
  isFriend?: boolean | undefined;
  departments?: string[] | undefined;
}

export interface AddressBookRecommendation extends AddressBookAccount {
  mobileName?: string | undefined;
}

export interface AddressBookFriendApplication {
  createAccount?: AddressBookAccount | null | undefined;
  message?: string | undefined;
}

/** A missing/null list is observed by the existing list && list.length branches. */
export interface AddressBookPage<T> {
  allCount?: number | undefined;
  list?: T[] | null | undefined;
}

/** concat(list) appends a missing/null list as a single value in search mode. */
export type AddressBookContactEntry = AddressBookAccount | null | undefined;
export type AddressBookContacts =
  | Record<string, AddressBookAccount[]>
  | AddressBookContactEntry[]
  | null;

export interface AddressBookSearchGroup {
  groupId?: string | undefined;
  avatar?: string | undefined;
  name?: string | undefined;
}

export interface AddressBookSearchResult {
  accounts: { list: AddressBookAccount[] };
  groups: { list: AddressBookSearchGroup[] };
}

/** Actual page-query and SDK-mode contracts, shared with the existing wrappers/consumers. */
export interface AddressBookContactsParams {
  projectId?: string | null | undefined;
  keywords?: string | undefined;
  /** 0 所有协作人 / 1 好友 / 2 网络同事 / 3 其他协作关系（RANGES，调用方以 number 传入） */
  range?: number | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  isFilterOther?: boolean | undefined;
  /** Supported by the endpoint contract; page consumers currently leave this absent. */
  takeTotalCount?: boolean | undefined;
}

export interface AddressBookPageQueryParams {
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
}

export type AddressBookContactsEndpoint = InboxEndpoint<AddressBookContactsParams, AddressBookPage<AddressBookAccount>>;

export type AddressBookNewFriendsEndpoint = InboxEndpoint<AddressBookPageQueryParams, AddressBookPage<AddressBookFriendApplication>>;

export type AddressBookRecommendsEndpoint = InboxEndpoint<AddressBookPageQueryParams, AddressBookPage<AddressBookRecommendation>>;

export interface AddressBookSearchDeptParams {
  projectId?: string | null | undefined;
  keywords?: string | undefined;
  range?: number | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  isFilterOther?: boolean | undefined;
}

/** Actual search consumer concatenates a missing/null result as a single sentinel. */
export interface AddressBookSearchDeptResult { userResult?: AddressBookAccount[] | null | undefined; }
export type AddressBookSearchDeptEndpoint = InboxEndpoint<AddressBookSearchDeptParams, AddressBookSearchDeptResult>;
