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
