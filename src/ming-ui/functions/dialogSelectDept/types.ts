import type { ReactNode } from 'react';
import type { ProjectInfo } from '../../../utils/projectTypes';
import type { SelectDepartment } from '../dialogSelectUser/GeneralSelect/types';

/** Selection input can be an organization pseudo-row whose bootstrap name is absent. */
export interface DepartmentChoice {
  departmentId: string;
  departmentName?: string | undefined;
  haveSubDepartment?: boolean | undefined;
  userCount?: number | undefined;
  checkIncludeChilren?: boolean | undefined;
  departmentPath?: DepartmentPath[] | undefined;
  [metadata: string]: unknown;
}
export interface DepartmentPath {
  departmentId: string;
  departmentName: string;
  depth: number;
}
export type DepartmentTree = SelectDepartment;
export type DepartmentSelectCallback = (
  departments: DepartmentChoice[],
  includedChildren: DepartmentChoice[] | null,
) => unknown;
export interface DepartmentSelectorOptions {
  projectId?: string | null | undefined;
  title?: ReactNode;
  className?: string | undefined;
  selectedDepartment?: DepartmentChoice[] | null | undefined;
  selectFn?: DepartmentSelectCallback | undefined;
  onClose?: ((selected?: boolean) => unknown) | undefined;
  unique?: boolean | undefined;
  includeProject?: boolean | undefined;
  checkIncludeChilren?: boolean | undefined;
  showCreateBtn?: boolean | undefined;
  showCurrentUserDept?: boolean | undefined;
  allProject?: boolean | undefined;
  fetchCount?: boolean | undefined;
  returnCount?: boolean | undefined;
  allPath?: boolean | undefined;
  isAnalysis?: boolean | undefined;
  fromAdmin?: boolean | undefined;
  departrangetype?: string | number | undefined;
  appointedDepartmentIds?: Array<string | null | undefined> | undefined;
  appointedUserIds?: Array<string | null | undefined> | undefined;
  displayType?: string | undefined;
  width?: string | number | undefined;
  /** Historical options retained by the public entry point; not consumed by this selector. */
  isIncludeRoot?: boolean | undefined;
  isShowAllOrg?: boolean | undefined;
  dialogBoxID?: string | undefined;
  data?: DepartmentChoice[] | undefined;
}
export interface DepartmentDialogState {
  loading: boolean;
  keywords: string;
  project: ProjectInfo;
  selectedDepartment: DepartmentChoice[];
  pageSize: number;
  departmentMoreIds: DepartmentPage[];
  rootPageIndex: number;
  rootPageAll: boolean;
  rootLoading: boolean;
  showProjectAll: boolean;
  activeIds: string[];
  activeIndex: number;
  list?: DepartmentTree[] | undefined;
  allList?: DepartmentTree[] | undefined;
  loadError?: boolean | undefined;
  selectionError?: boolean | undefined;
}
export interface DepartmentPage {
  departmentId: string;
  pageIndex: number;
}
export interface DepartmentRequest {
  projectId?: string | null | undefined;
  returnCount?: boolean | undefined;
  keyword?: string | undefined;
  keywords?: string | undefined;
  includeDisabled?: boolean | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  appointedDepartmentIds?: string[] | undefined;
  appointedUserIds?: string[] | undefined;
  rangeTypeId?: 10 | 20 | 30 | undefined;
  departmentId?: string | undefined;
  parentId?: string | undefined;
  departmentIds?: string[] | undefined;
  departmentIdsInTree?: string[] | undefined;
}
export interface DepartmentRootResult {
  departments: DepartmentTree[];
  showProjectAll: boolean;
}
