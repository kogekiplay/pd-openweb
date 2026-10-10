import type {
  DepartmentChoice,
  DepartmentPage,
  DepartmentSelectorOptions,
  DepartmentTree,
} from '../dialogSelectDept/types';

export type QuickDepartmentSelectCallback = (
  departments: DepartmentChoice[],
  includedChildrenOrRemoval: DepartmentChoice[] | true | null,
) => unknown;
export interface QuickDepartmentOptions extends Omit<DepartmentSelectorOptions, 'selectFn'> {
  selectFn?: QuickDepartmentSelectCallback | undefined;
  minHeight?: number | string | undefined;
  immediate?: boolean | undefined;
  isDynamic?: boolean | undefined;
  offset?: { top?: number | undefined; left?: number | undefined } | undefined;
  zIndex?: number | string | undefined;
  key?: string | undefined;
}
export interface QuickDepartmentState {
  rootPageIndex: number;
  rootPageAll: boolean;
  rootLoading: boolean;
  loading: boolean;
  keywords: string;
  selectedDepartment: DepartmentChoice[];
  departmentMoreIds: DepartmentPage[];
  showProjectAll: boolean;
  activeIds: string[];
  activeIndex: number;
  list?: DepartmentTree[] | undefined;
  allList?: DepartmentTree[] | undefined;
  loadError?: boolean | undefined;
}
export interface QuickDepartmentHandle {
  destory(): void;
}
