/// <reference path="../../types/hap-api.d.ts" />
import type { Store } from 'redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { FormQueryConfig } from '../components/Form/core/queryTypes';
import type { MasterData } from '../components/Form/core/types';
import type { TreeViewState } from '../pages/worksheet/common/TreeTableHelper/types';
import type { ChildTableAction } from '../pages/worksheet/components/ChildTable/redux/stateTypes';
import type { RelateRecordAction } from '../pages/worksheet/components/RelateRecordTable/redux/stateTypes';
import type { WorksheetFilterCondition } from '../pages/worksheet/types';
import type { ControlAdvancedSetting, FormControl } from './controlTypes';

/** Worksheet columns are arbitrary, but public store consumers must inspect values before using them. */
export interface FieldStoreRecord {
  rowid?: string | undefined;
  pid?: string | undefined;
  childrenids?: string | undefined;
  titleValue?: string | undefined;
  name?: string | undefined;
  empty?: boolean | undefined;
  isCopy?: boolean | undefined;
  [fieldId: string]: unknown;
  allowedit?: boolean | undefined;
  allowdelete?: boolean | undefined;
  addTime?: string | number | undefined;
  initRowIsCreate?: boolean | undefined;
  updatedControlIds?: string[] | undefined;
  needShowLoading?: boolean | undefined;
  isNew?: boolean | undefined;
  isAddByTree?: boolean | undefined;
}
export type FieldStoreWorksheet = Partial<
  Omit<HapApi.MD.Web.Ajax.ResultModel.Worksheet.WorksheetModel, 'advancedSetting'>
> & { advancedSetting?: ControlAdvancedSetting | undefined };
export interface FieldStoreControl extends FormControl {
  discussId?: string | undefined;
  initialValue?: unknown;
  isCharge?: boolean | undefined;
}
export interface FieldStoreMasterData extends MasterData {
  recordId?: string | undefined;
}
export interface ChildTableBase {
  initializationError?: string | undefined;
  rowLoadError?: string | undefined;
  loaded?: boolean | undefined;
  reset?: boolean | undefined;
  from?: number | undefined;
  control?: FieldStoreControl | undefined;
  max?: number | undefined;
  searchConfig?: FormQueryConfig[] | undefined;
  controls?: FormControl[] | undefined;
  originControls?: FormControl[] | undefined;
  masterData?: FieldStoreMasterData | undefined;
  recordId?: string | undefined;
  instanceId?: string | undefined;
  workId?: string | undefined;
  worksheetInfo?: FieldStoreWorksheet | undefined;
  initRowIsCreate?: boolean | undefined;
  discussId?: string | undefined;
  isTreeTableView?: boolean | undefined;
  projectId?: string | undefined;
}
export interface ChildTableChanges {
  isDirty?: boolean | undefined;
  isDeleteAll?: boolean | undefined;
}
export interface ChildPagination {
  pageIndex: number;
  pageSize: number;
  count: number;
}
export interface FieldSortConfig {
  controlId?: string | undefined;
  isAsc?: boolean | undefined;
}
export type CellErrors = Record<string, string | undefined>;
export interface ChildTableState {
  cellErrors: CellErrors;
  persistedCellErrors: CellErrors;
  baseLoading: boolean;
  dataLoading: boolean;
  base: ChildTableBase;
  treeTableViewData: TreeViewState;
  originRows: FieldStoreRecord[];
  lastAction: UnknownAction;
  rows: FieldStoreRecord[];
  changes: ChildTableChanges;
  pagination: ChildPagination;
  realCount: number | null;
  sortConfig: FieldSortConfig | null;
  filterControls: WorksheetFilterCondition[];
}
export interface RelateRecordBase {
  from?: number | undefined;
  isCharge?: boolean | undefined;
  worksheetId?: string | undefined;
  control?: FieldStoreControl | undefined;
  appId?: string | undefined;
  recordId?: string | undefined;
  allowEdit?: boolean | undefined;
  direction?: string | undefined;
  formData?: FormControl[] | undefined;
  instanceId?: string | undefined;
  workId?: string | undefined;
  saveSync?: boolean | undefined;
  treeLayerControlId?: string | undefined;
  isTreeTableView?: boolean | undefined;
  initialCount?: number | undefined;
  isDraft?: boolean | undefined;
  isDialog?: boolean | undefined;
  isTab?: boolean | undefined;
  relateWorksheetInfo?: FieldStoreWorksheet | undefined;
  relationControls?: FormControl[] | undefined;
  fixedColumnCount?: number | undefined;
  viewId?: string | undefined;
  searchConfig?: FormQueryConfig[] | undefined;
  sheetSwitchPermit?: HapApi.MD.Entity.Worksheet.SwitchPermitModel[] | undefined;
  showNumber?: boolean | undefined;
  controlPermission?: { visible: boolean; editable: boolean } | undefined;
  addVisible?: boolean | undefined;
  selectVisible?: boolean | undefined;
  allowBatchEdit?: boolean | undefined;
  allowRemoveRelation?: boolean | undefined;
  allowDeleteFromSetting?: boolean | undefined;
  allowExportFromSetting?: boolean | undefined;
  searchMaxCount?: number | undefined;
  isHiddenOtherViewRecord?: boolean | undefined;
  isInForm?: boolean | undefined;
}
export interface RelateTableState {
  pageIndex: number;
  pageSize: number;
  count: number | undefined;
  countForShow?: number | undefined;
  originalRecords?: FieldStoreRecord[] | undefined;
  records?: FieldStoreRecord[] | undefined;
  sheetColumnWidths?: Record<string, number> | undefined;
  keywords?: string | undefined;
  error?: string | undefined;
  defaultScrollLeft?: number | undefined;
  sheetHiddenColumnIds?: string[] | undefined;
  layoutChanged?: boolean | undefined;
  selectedRowIds?: string[] | undefined;
  isBatchEditing?: boolean | undefined;
  tableLoading?: boolean | undefined;
  highlightRows?: Record<string, boolean> | undefined;
  filterControls?: WorksheetFilterCondition[] | undefined;
  sortControl?: FieldSortConfig | undefined;
  fixedColumnCount?: number | undefined;
}
export interface RelateChanges {
  addedRecordIds: Array<string | undefined>;
  deletedRecordIds: string[];
  addedRecords: FieldStoreRecord[];
  isDeleteAll?: boolean | undefined;
  changed?: boolean | undefined;
}
export interface RelateRecordState {
  initialized: boolean;
  loading: boolean;
  base: RelateRecordBase;
  treeTableViewData: TreeViewState;
  controls: FormControl[];
  /** Historical initial value is [] until INIT_FIRST_PAGE_RESULT. */
  originFirstPageResult: { records?: FieldStoreRecord[] | undefined; count?: number | undefined } | [];
  records: FieldStoreRecord[];
  tableState: RelateTableState;
  changes: RelateChanges;
  rowsSummary: { types: Record<string, number>; values: Record<string, unknown> };
  lastAction: UnknownAction;
}
export type ChildTableDispatch = ThunkDispatch<ChildTableState, undefined, ChildTableAction>;
export type RelateRecordDispatch = ThunkDispatch<RelateRecordState, undefined, RelateRecordAction>;
interface StoreLoadingHooks {
  setLoadingInfo?: ((key: string, loading: boolean) => void) | undefined;
}
export interface ChildTableStore extends Store<ChildTableState, ChildTableAction>, StoreLoadingHooks {
  getState(): ChildTableState;
  dispatch: ChildTableDispatch;
  subscribe(listener: () => void): () => void;
  name: number;
  initialized?: boolean | undefined;
  ref?: { handleAddRowByLine?(): unknown } | null | undefined;
  init(options?: { noMountInit?: boolean | undefined }): Promise<void>;
  waitList: Array<() => void>;
  waitListForLoadRows: Array<() => void>;
  reset(): void;
  resetRows(): void;
  setEmpty(): void;
  cancelChange(): void;
  clearSubListErrors(): void;
  /** Starts row loading. Completion is LOAD_ROWS_COMPLETE, not this promise resolving. */
  initAndLoadRows(options?: {
    worksheetId?: string | undefined;
    recordId?: string | undefined;
    controlId?: string | undefined;
  }): Promise<void>;
  setUniqueError(options?: { badData?: string[] | undefined }): void;
}
export interface RelateRecordTableStore extends Store<RelateRecordState, RelateRecordAction>, StoreLoadingHooks {
  getState(): RelateRecordState;
  dispatch: RelateRecordDispatch;
  subscribe(listener: () => void): () => void;
  version: string;
  init(): Promise<void>;
  reset(): void;
  setEmpty(options?: { ignoreControlId?: string[] | undefined }): void;
  cancelChange(): void;
}
export type SubListStore = ChildTableStore | RelateRecordTableStore;
export type SubListState = ChildTableState | RelateRecordState;
export function isChildTableStore(store: SubListStore | undefined): store is ChildTableStore {
  return !!store && 'initAndLoadRows' in store;
}
export function isRelateRecordTableStore(store: SubListStore | undefined): store is RelateRecordTableStore {
  return !!store && 'version' in store;
}

type StoreMethodTarget<Method extends string> = Method | { fnName: Method; controlId?: string | undefined };
export type SubListStoreCall =
  | [target: StoreMethodTarget<'reset' | 'cancelChange' | 'clearSubListErrors'>]
  | [target: StoreMethodTarget<'setUniqueError'>, options?: Parameters<ChildTableStore['setUniqueError']>[0]]
  | [target: StoreMethodTarget<'setEmpty'>, options?: Parameters<RelateRecordTableStore['setEmpty']>[0]]
  | [target: StoreMethodTarget<'dispatch'>, action: ChildTableAction | RelateRecordAction];

export function isChildTableAction(action: ChildTableAction | RelateRecordAction): action is ChildTableAction {
  return [
    'LOAD_ROWS',
    'INIT_ROWS',
    'FORCE_SET_OUT_ROWS',
    'CLEAR_AND_SET_ROWS',
    'ADD_ROWS',
    'ADD_ROW',
    'UPDATE_ROW',
    'UPDATE_ROWS',
    'DELETE_ROW',
    'DELETE_ROWS',
    'UPDATE_STATE',
    'UPDATE_BASE',
    'UPDATE_CELL_ERRORS',
    'UPDATE_PAGINATION',
    'UPDATE_SORT_CONFIG',
    'UPDATE_FILTER_CONTROLS',
    'UPDATE_DATA_LOADING',
    'UPDATE_BASE_LOADING',
    'SET_REAL_COUNT',
    'DELETE_ALL',
    'LOAD_ROWS_COMPLETE',
    'RESET_CHANGES',
    'RESET_TREE',
    'RESET',
    'UPDATE_TREE_TABLE_VIEW_DATA',
    'UPDATE_TREE_TABLE_VIEW_ITEM',
    'UPDATED_TREE_NODE_EXPANSION',
    'UPDATE_TREE_TABLE_VIEW_EXPANDED',
    'UPDATE_TREE_TABLE_VIEW_TREE_MAP',
    'WORKSHEET_SHEETVIEW_APPEND_ROWS',
    'WORKSHEET_INIT',
    'WORKSHEET_SHEETVIEW_CLEAR',
  ].includes(action.type);
}
export function isRelateRecordAction(action: ChildTableAction | RelateRecordAction): action is RelateRecordAction {
  return [
    'UPDATE_BASE',
    'UPDATE_LOADING',
    'UPDATE_RECORDS',
    'APPEND_RECORDS',
    'DELETE_RECORDS',
    'UPDATE_TABLE_STATE',
    'CANCEL_CHANGE',
    'RESET',
    'DELETE_ALL',
    'APPEND_FAKE_RECORDS',
    'UPDATE_ROWS_WITH_CHANGES',
    'UPDATE_RECORD',
    'UPDATE_RECORD_BY_RECORD_ID',
    'CLEAR_RECORDS',
    'UPDATE_INIT_STATE',
    'UPDATE_CONTROLS',
    'INIT_FIRST_PAGE_RESULT',
    'UPDATE_ROWS_SUMMARY',
    'UPDATE_TREE_TABLE_VIEW_DATA',
    'UPDATE_TREE_TABLE_VIEW_ITEM',
    'UPDATED_TREE_NODE_EXPANSION',
    'UPDATE_TREE_TABLE_VIEW_EXPANDED',
    'UPDATE_TREE_TABLE_VIEW_TREE_MAP',
    'WORKSHEET_SHEETVIEW_APPEND_ROWS',
    'WORKSHEET_INIT',
    'WORKSHEET_SHEETVIEW_CLEAR',
  ].includes(action.type);
}
