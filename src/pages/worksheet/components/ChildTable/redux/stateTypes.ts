import type {
  CellErrors,
  ChildPagination,
  ChildTableBase,
  FieldSortConfig,
  FieldStoreRecord,
} from '../../../../../utils/subListStoreTypes';
import type { TreeExpansionAction } from '../../../common/TreeTableHelper/types';
import type { WorksheetFilterCondition } from '../../../types';

export type ChildRowsAction =
  | {
      type: 'LOAD_ROWS' | 'INIT_ROWS' | 'FORCE_SET_OUT_ROWS' | 'CLEAR_AND_SET_ROWS' | 'ADD_ROWS';
      rows: FieldStoreRecord[];
      emptyCount?: number | undefined;
      isSetValueFromEvent?: boolean | undefined;
      isSetValueFromRule?: boolean | undefined;
      deleted?: Array<string | undefined> | undefined;
      asyncUpdate?: boolean | undefined;
    }
  | {
      type: 'ADD_ROW';
      row: FieldStoreRecord;
      rowid?: string | undefined;
      insertRowId?: string | undefined;
      emptyCount?: number;
    }
  | {
      type: 'UPDATE_ROW';
      rowid?: string | undefined;
      value: FieldStoreRecord;
      asyncUpdate?: boolean | undefined;
      noRealUpdate?: boolean | undefined;
      emptyCount?: number;
    }
  | {
      type: 'UPDATE_ROWS';
      rowIds: string[];
      value: FieldStoreRecord;
      asyncUpdate?: boolean | undefined;
      noRealUpdate?: boolean | undefined;
      emptyCount?: number;
    }
  | { type: 'DELETE_ROW'; rowid: string; emptyCount?: number }
  | { type: 'DELETE_ROWS'; rowIds: string[]; emptyCount?: number }
  | { type: 'UPDATE_STATE'; state: FieldStoreRecord[]; emptyCount?: number };
export type ChildBaseAction =
  { type: 'UPDATE_BASE'; value: ChildTableBase } | { type: 'LOAD_ROWS' | 'CLEAR_AND_SET_ROWS' | 'RESET' };
export type ChildErrorsAction = { type: 'UPDATE_CELL_ERRORS'; value: CellErrors; persisted?: CellErrors | undefined };
export type ChildPaginationAction = { type: 'UPDATE_PAGINATION'; pagination: Partial<ChildPagination> };
export type ChildSortAction =
  | { type: 'UPDATE_SORT_CONFIG'; sortConfig: FieldSortConfig | null }
  | { type: 'RESET' | 'LOAD_ROWS' | 'CLEAR_AND_SET_ROWS' };
export type ChildFilterAction =
  { type: 'UPDATE_FILTER_CONTROLS'; filterControls?: WorksheetFilterCondition[] | undefined } | { type: 'RESET' };
export type ChildChangesAction = { type: string };

export type ChildTableAction =
  | TreeExpansionAction
  | ChildRowsAction
  | Extract<ChildBaseAction, { type: 'UPDATE_BASE' }>
  | ChildErrorsAction
  | ChildPaginationAction
  | Extract<ChildSortAction, { type: 'UPDATE_SORT_CONFIG' }>
  | ChildFilterAction
  | { type: 'UPDATE_DATA_LOADING' | 'UPDATE_BASE_LOADING'; value: boolean }
  | { type: 'SET_REAL_COUNT'; value: number }
  | { type: 'DELETE_ALL' | 'LOAD_ROWS_COMPLETE' | 'RESET_CHANGES' | 'RESET_TREE' };
