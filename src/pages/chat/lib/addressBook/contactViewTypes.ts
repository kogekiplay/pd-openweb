import type { AddressBookContacts as AddressBookListData } from 'src/api/addressBookTypes';

/** One actual state contract for all contact grouping/search producers. */
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
