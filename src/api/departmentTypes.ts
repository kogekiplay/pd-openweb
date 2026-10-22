import type { InboxEndpoint } from './inboxTypes';
/** The finite department tree read by address-book containers before client expansion state is added. */
export interface DepartmentTreeNode {
  departmentId?: string | undefined;
  departmentName?: string | undefined;
  haveSubDepartment?: boolean | undefined;
  subDepartments?: DepartmentTreeNode[] | undefined;
}
export interface DepartmentTreeParams {
  projectId?: string | null | undefined;
  parentId?: string | undefined;
  keyword?: string | undefined;
  keywords?: string | undefined;
  onlyMyJoin?: boolean | undefined;
  includeDisabled?: boolean | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  dataRange?: number | undefined;
  filterAccountIds?: (string | undefined)[] | undefined;
  prefixAccountIds?: (string | undefined)[] | undefined;
  filterFriend?: boolean | undefined;
  firstLetter?: string | undefined;
}
export type DepartmentTreeReply = DepartmentTreeNode[] | null | undefined;
export type DepartmentTreeEndpoint = InboxEndpoint<DepartmentTreeParams, DepartmentTreeReply>;
