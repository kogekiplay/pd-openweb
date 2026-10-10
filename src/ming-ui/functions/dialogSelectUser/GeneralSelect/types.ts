import type { CSSProperties, ReactNode } from 'react';
import type { QuickUser } from '../../quickSelectUser/types';

export type ChooseMode = 'user' | 'department' | 'group' | 'resigned';
/** Fields displayed by the dialog; other server member metadata remains unknown. */
export interface SelectUser extends QuickUser {
  companyName?: string | undefined;
  departmentInfo?: { departmentId?: string | undefined; departmentName?: string | undefined } | null | undefined;
}
export interface SelectDepartment {
  departmentId: string;
  departmentName: string;
  userCount?: number | undefined;
  haveSubDepartment?: boolean | undefined;
  subDepartments?: SelectDepartment[] | undefined;
  parentId?: string | undefined;
  disabled?: boolean | undefined;
  open?: boolean | number | undefined;
  checkIncludeChilren?: boolean | undefined;
  users?: SelectUser[] | undefined;
  [metadata: string]: unknown;
}
export interface DepartmentNode extends SelectDepartment {
  subDepartments: DepartmentNode[];
  open: boolean;
  disabled: boolean;
}
export interface UserDepartmentNode extends SelectDepartment {
  id: string;
  name: string;
  subs: UserDepartmentNode[];
}
export interface SelectGroup {
  groupId: string;
  name: string;
  groupMemberCount?: number | undefined;
  open?: boolean | undefined;
  users?: SelectUser[] | undefined;
  [metadata: string]: unknown;
}
export type SelectedEntity =
  { type: 'user' | 'resigned'; data: SelectUser } | { type: 'department'; data: SelectDepartment };
export interface ListData<T> {
  list: T[];
  allCount?: number | undefined;
}
export interface ContactData {
  oftenUsers?: ListData<SelectUser> | null | undefined;
  users?: ListData<SelectUser> | null | undefined;
}
export type MainData =
  | { renderType: 1; data: ContactData }
  | { renderType: 2; data: ListData<SelectDepartment> | SelectDepartment[] }
  | { renderType: 4 | 7; data: ListData<SelectUser> }
  | { renderType: 5; data: DepartmentNode[] }
  | { renderType: 6; data: ListData<SelectGroup> };
export type AbortableRequest<T> = Promise<T> & { abort?: (() => void) | undefined };
export interface UserRequest {
  keywords?: string | undefined;
  projectId?: string | null | undefined;
  dataRange?: number | undefined;
  filterAccountIds?: Array<string | undefined> | undefined;
  prefixAccountIds?: Array<string | undefined> | undefined;
  filterFriend?: boolean | undefined;
  filterProjectId?: string | undefined;
  includeUndefinedAndMySelf?: boolean | undefined;
  includeSystemField?: boolean | undefined;
  includeMySelf?: boolean | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  parentId?: string | undefined;
  onlyMyJoin?: unknown;
  searchGroupType?: number | undefined;
  departmentId?: string | undefined;
  groupId?: string | undefined;
}
export type UserAction = (args: UserRequest) => AbortableRequest<unknown>;
interface TabBase {
  id: string;
  name?: string | undefined;
  page?: boolean | undefined;
}
export type UserTab =
  | (TabBase & { type: 1; actions: { getContactUsers: UserAction } })
  | (TabBase & { type: 2; actions: { getDepartments: UserAction; getDepartmentUsers: UserAction } })
  | (TabBase & { type: 6; actions: { getGroups: UserAction; getGroupUsers: UserAction } })
  | (TabBase & { type: 4 | 7; actions: { getUsers: UserAction } });
export interface CommonSettings {
  projectId?: string | null | undefined;
  dataRange?: number | undefined;
  btnName?: string | undefined;
  selectModes?: ChooseMode[] | undefined;
  isSuperWork?: boolean | '' | null | undefined;
  callback?: ((data: SubmitData) => void) | undefined;
}
export interface SubmitData {
  users: SelectUser[];
  departments: SelectDepartment[];
  groups: SelectGroup[];
  resigned?: SelectUser[] | undefined;
}
export interface UserSettings {
  _id?: number | undefined;
  defaultTabs?: UserTab[] | undefined;
  showTabs?: string[] | undefined;
  extraTabs?: UserTab[] | undefined;
  allowSelectNull?: boolean | undefined;
  filterAccountIds?: Array<string | undefined> | undefined;
  prefixAccountIds?: Array<string | undefined> | undefined;
  selectedAccountIds?: Array<string | undefined> | undefined;
  filterSystemAccountId?: string[] | undefined;
  filterProjectId?: string | undefined;
  filterFriend?: boolean | undefined;
  filterResigned?: boolean | undefined;
  filterAll?: boolean | undefined;
  filterOthers?: boolean | undefined;
  inProject?: boolean | undefined;
  showMoreInvite?: boolean | undefined;
  projectCallback?: ((projectId: string) => void) | undefined;
  filterOtherProject?: boolean | undefined;
  unique?: boolean | { accountId?: string | undefined } | undefined;
  includeMySelf?: boolean | undefined;
  includeUndefinedAndMySelf?: boolean | undefined;
  includeSystemField?: boolean | undefined;
  hideResignedTab?: boolean | undefined;
  hideOftenUsers?: boolean | undefined;
  hideManageOftenUsers?: boolean | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  isMore?: boolean | undefined;
  projectId?: string | null | undefined;
  dataRange?: number | undefined;
  callback?:
    | ((users: SelectUser[], departments?: SelectDepartment[] | undefined, groups?: SelectGroup[] | undefined) => void)
    | undefined;
}
export interface DepartmentSettings {
  departments?: SelectDepartment[] | undefined;
  disabledDepartmentIds?: string[] | undefined;
  departmentIds?: string[] | undefined;
}
export interface GeneralSelectProps {
  chooseType?: ChooseMode | undefined;
  commonSettings: CommonSettings;
  userSettings?: UserSettings | undefined;
  departmentSettings?: DepartmentSettings | undefined;
  groupSettings?: unknown;
  isChat?: boolean | undefined;
  handleCancel: () => void;
  dialogSelectUser: OpenUserDialog;
}
export type NonEmptyUsers = [SelectUser, ...SelectUser[]];
export interface DialogUserSettings extends Omit<UserSettings, 'callback'> {
  callback?:
    | ((users: NonEmptyUsers, departments?: SelectDepartment[] | undefined, groups?: SelectGroup[] | undefined) => void)
    | undefined;
}
export interface DialogOptions {
  SelectUserSettings?: DialogUserSettings | undefined;
  SelectDepartmentSettings?: DepartmentSettings | undefined;
  SelectGroupSettings?: unknown;
  chooseType?: ChooseMode | undefined;
  title?: string | undefined;
  projectId?: string | null | undefined;
  isChat?: boolean | undefined;
  fromAdmin?: boolean | undefined;
  overlayClosable?: boolean | undefined;
  showMoreInvite?: boolean | undefined;
  sourceId?: string | number | null | undefined;
  sourceProjectId?: string | undefined;
  fromType?: string | number | undefined;
  isTask?: boolean | undefined;
  zIndex?: number | undefined;
  onCancel?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
}
export type OpenUserDialog = (options: DialogOptions) => void;
export interface GeneralSelectState {
  selectedData: SelectedEntity[];
  chooseType: ChooseMode;
  keywords: string;
  isProject: boolean;
  selectedUserTabId: string;
  pageSize: number;
  pageIndex: number;
  mainData: MainData | null;
  loading: boolean;
  haveMore: boolean;
  isSearch: boolean;
  currentIndex: number;
  defaultCheckedDepId?: string | null | undefined;
  loadError?: string | undefined;
}
export interface UserProps {
  user: SelectUser;
  projectId?: string | null | undefined;
  checked?: boolean | undefined;
  disabled?: boolean | undefined;
  hideChecked?: boolean | undefined;
  includeMySelf?: boolean | undefined;
  includeUndefinedAndMySelf?: boolean | undefined;
  currentId?: string | undefined;
  onChange: (user: SelectUser) => void;
}
export interface UsersListProps {
  projectId?: string | null | undefined;
  onChange: (user: SelectUser) => void;
  selectedUsers: SelectUser[];
  selectedAccountIds?: Array<string | undefined> | undefined;
  keywords: string;
  currentIndex: number;
}
export interface DefaultUserListProps extends UsersListProps {
  data: ContactData;
  includeMySelf?: boolean | undefined;
  includeUndefinedAndMySelf?: boolean | undefined;
  hideOftenUsers?: boolean | undefined;
  hideManageOftenUsers?: boolean | undefined;
  refreshOftenUser: () => void;
  dialogSelectUser: OpenUserDialog;
}
export interface DepartmentListProps {
  data: SelectDepartment[];
  treeData?: SelectDepartment[] | undefined;
  selectedDepartment: Array<Pick<SelectDepartment, 'departmentId' | 'checkIncludeChilren'>>;
  toogleDepargmentSelect: (department: SelectDepartment) => void;
  toggleDepartmentList: (departmentId: string) => void;
  onChangeSelectedOnly?: ((department: SelectDepartment) => void) | undefined;
  activeIds?: string[] | undefined;
  departmentMoreIds?: Array<{ departmentId: string }> | undefined;
  keywords?: string | undefined;
  showUserCount?: boolean | undefined;
  checkIncludeChilren?: boolean | undefined;
  unique?: boolean | undefined;
}
export interface DropdownItem {
  type?: 'hr' | 'default' | undefined;
  text?: string | undefined;
  value?: string | undefined;
  disabled?: boolean | undefined;
  desc?: string | undefined;
  iconName?: string | undefined;
  children?: DropdownItem[] | undefined;
}
export interface DropdownProps {
  onClick?: (() => boolean) | undefined;
  onChange?: ((value: string) => void) | undefined;
  placeholder?: string | undefined;
  defaultValue?: string | undefined;
  value?: string | undefined;
  menuStyle?: CSSProperties | undefined;
  maxHeight?: number | undefined;
  className?: string | undefined;
  hoverTheme?: boolean | undefined;
  noData?: ReactNode;
  style?: CSSProperties | undefined;
  data: DropdownItem[];
  renderValue?: string | undefined;
}
export interface DialogState {
  dataRange: number;
  projectId: string | null | undefined;
  currentProject: {
    projectId?: string | undefined;
    companyName?: string | undefined;
    projectStatus?: number | undefined;
  };
  list?: Array<{ value: string | number | undefined; text: string | undefined }> | undefined;
}
