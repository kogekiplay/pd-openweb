import type { KeyboardEventHandler, MouseEventHandler, ReactElement } from 'react';

export type UserSource = 'normal' | 'external' | 'range';
export interface UserStatus {
  statusId?: string | undefined;
  accountId?: string | undefined;
  icon?: string | undefined;
  remark?: string | undefined;
  beginTime?: string | undefined;
  endTime?: string | undefined;
  durationOption?: number | undefined;
  [metadata: string]: unknown;
}
/** Actual displayed/selected fields; other member metadata stays unknown. */
export interface QuickUser {
  accountId: string;
  fullname?: string | undefined;
  name?: string | undefined;
  avatar?: string | undefined;
  avatarSmall?: string | undefined;
  phone?: string | undefined;
  mobilePhone?: string | undefined;
  email?: string | undefined;
  job?: string | undefined;
  department?: string | undefined;
  onStatusOption?: UserStatus | undefined;
  [metadata: string]: unknown;
}
export type SelectedQuickUser = Pick<QuickUser, 'accountId' | 'avatar' | 'fullname' | 'job'>;
export type SelectUsers = (users: SelectedQuickUser[]) => void;
export type CloseSelector = (force?: boolean) => void;
export interface RangeOptions {
  appointedAccountIds?: Array<string | number> | undefined;
  appointedDepartmentIds?: Array<string | number> | undefined;
  appointedOrganizeIds?: Array<string | number> | undefined;
  [parameter: string]: unknown;
}
export interface SelectSettings {
  projectId?: string | null | undefined;
  callback?: SelectUsers | undefined;
  unique?: boolean | { accountId?: string | undefined } | undefined;
  selectedAccountIds?: Array<string | undefined> | undefined;
  filterAccountIds?: Array<string | undefined> | undefined;
  includeUndefinedAndMySelf?: boolean | undefined;
  includeSystemField?: boolean | undefined;
  prefixAccountIds?: string[] | undefined;
  filterOtherProject?: boolean | undefined;
  filterResigned?: boolean | undefined;
  hideResignedTab?: boolean | undefined;
  filterAll?: boolean | undefined;
  filterFriend?: boolean | undefined;
  filterOthers?: boolean | undefined;
}
export interface UserSelectorProps extends SelectSettings {
  staticAccounts?: QuickUser[] | undefined;
  prefixAccounts?: QuickUser[] | undefined;
  prefixOnlySystemField?: boolean | undefined;
  isHidAddUser?: boolean | undefined;
  selectRangeOptions?: RangeOptions | false | '' | undefined;
  appId?: string | undefined;
  minHeight?: number | undefined;
  tabType?: number | undefined;
  tabIndex?: number | undefined;
  count?: number | undefined;
  hidePortalCurrentUser?: boolean | undefined;
  onClose?: CloseSelector | undefined;
  selectCb?: SelectUsers | undefined;
  onSelect?: SelectUsers | undefined;
  SelectUserSettings?: SelectSettings | undefined;
  fromAdmin?: boolean | undefined;
  /** Legacy address dialog options forwarded by the actual producers. */
  sourceId?: string | number | null | undefined;
  fromType?: string | number | undefined;
  showMoreInvite?: boolean | undefined;
  isTask?: boolean | undefined;
}
export interface QuickSelectUserProps extends UserSelectorProps {
  offset?: { top?: number | undefined; left?: number | undefined } | undefined;
  zIndex?: number | undefined;
  isDynamic?: boolean | undefined;
  children?: ReactElement;
  /** Older callers send these unused positioning tokens; the target's real rectangle is used. */
  rect?: unknown;
  container?: unknown;
}
export interface AccountsOptions extends Pick<
  UserSelectorProps,
  'includeUndefinedAndMySelf' | 'includeSystemField' | 'prefixOnlySystemField' | 'prefixAccounts'
> {
  list: QuickUser[];
  filterAccountIds: string[];
  prefixAccountIds: string[];
}
export interface GetUsersOptions extends Pick<
  UserSelectorProps,
  | 'appId'
  | 'projectId'
  | 'selectRangeOptions'
  | 'filterOtherProject'
  | 'includeUndefinedAndMySelf'
  | 'includeSystemField'
  | 'prefixAccountIds'
  | 'hidePortalCurrentUser'
> {
  type?: UserSource | undefined;
  keywords?: string | undefined;
  pageIndex?: number | undefined;
  mentionedCount?: number | undefined;
  filterAccountIds?: Array<string | undefined> | undefined;
}
export type UsersRequest = Promise<QuickUser[]> & { abort(): void };
export interface LoadUsersOptions {
  keywords?: string | undefined;
  pageIndex?: number | undefined;
  clear?: boolean | undefined;
  type?: UserSource | undefined;
}
export interface UserItemProps {
  className?: string | undefined;
  notShowCurrentUserName?: boolean | undefined;
  user: QuickUser;
  type?: UserSource | undefined;
  onClick?: MouseEventHandler<HTMLDivElement> | undefined;
  appId?: string | undefined;
  projectId?: string | null | undefined;
  select?: boolean | undefined;
}
export interface UserListProps {
  keywords?: string | undefined;
  activeIndex?: number | undefined;
  loading?: boolean | undefined;
  list: QuickUser[];
  type?: UserSource | undefined;
  showMore?: boolean | undefined;
  limitNum?: number | undefined;
  onSelect: (user: QuickUser) => void;
  appId?: string | undefined;
  projectId?: string | null | undefined;
  showManageBtn?: boolean | undefined;
  notShowCurrentUserName?: boolean | undefined;
  onClose?: CloseSelector | undefined;
  onShowMore?: ((visible: boolean) => void) | undefined;
}
export interface SearchProps {
  type?: UserSource | undefined;
  keywords?: string | undefined;
  setKeywords: (value: string) => void;
  parentProps: UserSelectorProps;
  onSelect: SelectUsers;
  onClose: CloseSelector;
  isHidAddUser?: boolean | undefined;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement> | undefined;
}
