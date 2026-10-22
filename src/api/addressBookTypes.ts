import type { InboxEndpoint } from './inboxTypes';

/** The asynchronous address-book endpoints return the original abortable request. */
export type AddressBookRequest<T> = Promise<T> & { abort: () => void };

/** Fields read or forwarded by the contact and recommendation rows. */
export interface AddressBookAccount {
  accountId?: string | undefined;
  avatar?: string | undefined;
  fullname?: string | undefined;
  companyName?: string | undefined;
  firstCode?: string | null | undefined;
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
export type AddressBookContactGroups = Record<string, AddressBookAccount[]>;
export type AddressBookFlatContacts = AddressBookContactEntry[];
export type AddressBookContacts = AddressBookContactGroups | AddressBookFlatContacts | null;

export interface AddressBookSearchGroup {
  groupId?: string | undefined;
  avatar?: string | undefined;
  name?: string | undefined;
}

/** One finite raw view for mixed search records; all fields are read by SearchMember or GlobalSearch.UserList. */
export interface AddressBookSearchEntry extends AddressBookAccount, AddressBookSearchGroup {
  user?: { userId?: string | undefined } | null | undefined;
  avatarMiddle?: string | undefined;
  profession?: string | undefined;
  userHead?: string | undefined;
  userName?: string | undefined;
  userJob?: string | undefined;
  groupID?: string | undefined;
  groupAvatar?: string | undefined;
  groupName?: string | undefined;
}
export type AddressBookSearchRow = AddressBookSearchEntry | null | undefined;
export interface AddressBookSearchPartition {
  allCount?: number | undefined;
  list?: AddressBookSearchRow[] | null | undefined;
}
export interface AddressBookSearchResult {
  accounts?: AddressBookSearchPartition | null | undefined;
  groups?: AddressBookSearchPartition | null | undefined;
}
export interface AddressBookChatKeywordParams {
  keywords?: string | undefined;
  pageSize?: number | undefined;
}
export type AddressBookChatKeywordEndpoint = InboxEndpoint<AddressBookChatKeywordParams, AddressBookSearchResult>;

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

/** Lookup rows reuse the one account identity/name model; these fields are actually rendered/updated by MobileOrEmailInvite. */
export interface AddressBookAccountLookupRow extends AddressBookAccount {
  avatarBig?: string | undefined;
  subInfo?: string | undefined;
  disabled?: boolean | undefined;
}
export type AddressBookAccountLookupEntry = AddressBookAccountLookupRow | null | undefined;
export interface AddressBookAccountLookupResult {
  list?: AddressBookAccountLookupEntry[] | null | undefined;
}
export interface AddressBookAccountLookupParams {
  account?: string | undefined;
  ticket?: string | undefined;
  randStr?: string | undefined;
  captchaType?: number | undefined;
}
export type AddressBookAccountLookupEndpoint = InboxEndpoint<AddressBookAccountLookupParams, AddressBookAccountLookupResult>;

/** Original lookup payload is validated by quickSelectUser; no raw row is promised to be a decoded QuickUser. */
export interface AddressBookKeywordSearchParams {
  keywords?: string | undefined;
  filterAccountIds?: (string | undefined)[] | undefined;
  projectId?: string | null | undefined;
  currentProjectId?: string | null | undefined;
  /** Endpoint-declared paging fields; quick selector currently omits them. */
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  /** The generator documents this field without a concrete enum; do not invent one. */
  dataRange?: unknown;
}
export interface AddressBookKeywordSearchResult { list?: unknown; }
export type AddressBookKeywordSearchEndpoint = InboxEndpoint<AddressBookKeywordSearchParams, AddressBookKeywordSearchResult | null | undefined>;
