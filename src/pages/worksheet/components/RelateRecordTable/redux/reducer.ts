import { combineReducers } from 'redux';
import type { UnknownAction } from '@reduxjs/toolkit';
import { assign, cloneDeep, findIndex, get, includes, uniq, uniqBy } from 'lodash';
import { handleTreeNodeRow, treeTableViewData } from 'worksheet/common/TreeTableHelper/index.js';
import type { FormControl } from 'src/utils/controlTypes';
import type { RelateRecordState } from 'src/utils/subListStoreTypes';
import type { FieldStoreRecord, RelateChanges, RelateRecordBase, RelateTableState } from 'src/utils/subListStoreTypes';
import type { RelateRecordAction } from './stateTypes';

function loading(state = true, action: RelateRecordAction): boolean {
  switch (action.type) {
    case 'UPDATE_LOADING':
      return action.value;
    default:
      return state;
  }
}

function base(state: RelateRecordBase = {}, action: RelateRecordAction): RelateRecordBase {
  switch (action.type) {
    case 'UPDATE_BASE':
      return Object.assign({}, state, action.value);
    default:
      return state;
  }
}

const initialTableState: RelateTableState = {
  pageIndex: 1,
  pageSize: localStorage.getItem('relateRecordTablePageSize')
    ? Number(localStorage.getItem('relateRecordTablePageSize'))
    : 50,
  count: 0,
};

function tableState(
  state: RelateTableState = {
    ...initialTableState,
  },
  action: RelateRecordAction,
): RelateTableState {
  if (
    (action.type === 'APPEND_RECORDS' || action.type === 'DELETE_RECORDS') &&
    !action.saveSync &&
    !(action.type === 'DELETE_RECORDS' && action.recordsDeleted)
  ) {
    const newCount = typeof state.countForShow === 'undefined' ? state.count : state.countForShow;

    if (action.type === 'APPEND_RECORDS') {
      return { ...state, countForShow: Number(newCount) + action.records.length };
    } else if (action.type === 'DELETE_RECORDS') {
      return { ...state, countForShow: Number(newCount) - action.recordIds.length };
    }

    return { ...state };
  }

  switch (action.type) {
    case 'UPDATE_RECORDS':
      return { ...state, count: action.records.length, originalRecords: action.records };
    case 'UPDATE_TABLE_STATE':
      return Object.assign({}, state, action.value);
    case 'APPEND_RECORDS':
      return { ...state, count: Number(state.count) + action.records.length };
    case 'DELETE_RECORDS':
      return {
        ...state,
        count:
          Number(state.count) -
          (action.recordsDeleted ? (action.savedRecordCount ?? action.recordIds.length) : action.recordIds.length),
        ...(action.recordsDeleted && typeof state.countForShow !== 'undefined'
          ? { countForShow: state.countForShow - action.recordIds.length }
          : {}),
      };
    case 'RESET':
      return {
        ...initialTableState,
        sheetColumnWidths: state.sheetColumnWidths,
        ...('doNotClearKeywords' in action && action.doNotClearKeywords ? { keywords: state.keywords } : {}),
      };
    case 'CANCEL_CHANGE':
      return {
        ...state,
        pageIndex: 1,
        count: action.count,
        countForShow: action.count,
        originalRecords: action.records,
        records: action.records,
        keywords: '',
      };
    case 'DELETE_ALL':
      return {
        ...initialTableState,
      };
    default:
      return state;
  }
}

function controls(state: FormControl[] = [], action: RelateRecordAction): FormControl[] {
  switch (action.type) {
    case 'UPDATE_CONTROLS':
      return action.controls;
    default:
      return state;
  }
}

export const initialChanges: RelateChanges = {
  addedRecordIds: [],
  deletedRecordIds: [],
  addedRecords: [],
};

function changes(state: RelateChanges = cloneDeep(initialChanges), action: RelateRecordAction): RelateChanges {
  if ('saveSync' in action && action.saveSync && !(action.type === 'DELETE_RECORDS' && action.recordsDeleted)) {
    if (includes(['APPEND_RECORDS', 'DELETE_RECORDS'], action.type)) {
      return { ...state, changed: true };
    }
  }

  const newRecords = ('records' in action ? action.records || [] : []).map(record => ({ ...record, isNew: true }));

  switch (action.type) {
    case 'APPEND_RECORDS':
      return {
        ...state,
        addedRecordIds: uniq(state.addedRecordIds.concat(newRecords.map(r => r.rowid))),
        addedRecords: uniqBy(state.addedRecords.concat(newRecords), 'rowid'),
      };
    case 'UPDATE_RECORD':
      return {
        ...state,
        // 合并而非整体替换：来自记录详情/操作菜单的更新会 omit allowedit/allowdelete，
        // 若整体替换会丢失这两个权限标记（及 isNew 等本地字段），导致删除按钮消失
        addedRecords: state.addedRecords.map(r =>
          r.rowid === get(action, 'newRecord.rowid') ? assign({}, r, action.newRecord) : r,
        ),
      };
    case 'DELETE_RECORDS':
      return {
        ...state,
        addedRecordIds: state.addedRecordIds.filter(recordId => !includes(action.recordIds, recordId)),
        addedRecords: state.addedRecords.filter(record => !includes(action.recordIds, record.rowid)),
        deletedRecordIds: action.recordsDeleted
          ? state.deletedRecordIds.filter(recordId => !includes(action.recordIds, recordId))
          : uniq(
              state.deletedRecordIds.concat(
                action.recordIds.filter(recordId => !includes(state.addedRecordIds, recordId)),
              ),
            ),
      };
    case 'DELETE_ALL':
      return {
        ...initialChanges,
        isDeleteAll: true,
      };
    case 'CANCEL_CHANGE':
    case 'RESET':
    case 'CLEAR_CHANGES':
      return cloneDeep(initialChanges);
    default:
      return state;
  }
}

function originFirstPageResult(
  state: { records?: FieldStoreRecord[] | undefined; count?: number | undefined } | [] = [],
  action: RelateRecordAction,
): { records?: FieldStoreRecord[] | undefined; count?: number | undefined } | [] {
  switch (action.type) {
    case 'DELETE_RECORDS':
      // 已落库的删除同步到撤销基线，取消表单编辑时不能恢复已删除的记录。
      if (!action.recordsDeleted || Array.isArray(state) || !state.records) return state;
      return {
        ...state,
        count: Number(state.count) - (action.savedRecordCount ?? action.recordIds.length),
        records: state.records.filter(record => !includes(action.recordIds, record.rowid)),
      };
    case 'INIT_FIRST_PAGE_RESULT':
      return action.value;
    default:
      return state;
  }
}

function records(state: FieldStoreRecord[] = [], action: RelateRecordAction): FieldStoreRecord[] {
  let newRecords;

  switch (action.type) {
    case 'UPDATE_RECORDS':
      return action.records;
    case 'UPDATE_ROWS_WITH_CHANGES':
      return state.map(r => (includes(action.rowIds, r.rowid) ? assign({}, r, action.changes) : r));
    case 'UPDATE_RECORD':
      // 合并而非整体替换：更新数据可能 omit allowedit/allowdelete，整体替换会清空这两个权限标记
      return state.map(r => (r.rowid === get(action, 'newRecord.rowid') ? assign({}, r, action.newRecord) : r));
    case 'UPDATE_RECORD_BY_RECORD_ID':
      return state.map(r => (r.rowid === action.recordId ? assign({}, r, action.changes) : r));
    case 'APPEND_RECORDS':
    case 'APPEND_FAKE_RECORDS':
      newRecords = action.records;
      if (!action.saveSync && !!action.recordId) {
        return state;
      } else if (action.afterRecordId) {
        const afterRowIndex = findIndex(state, r => r.rowid === action.afterRecordId);

        if (afterRowIndex < 0) {
          return state;
        }

        return [...state.slice(0, afterRowIndex + 1), ...newRecords, ...state.slice(afterRowIndex + 1)];
      } else {
        return newRecords.concat(state);
      }

    case 'DELETE_RECORDS':
      return state
        .filter(record => !includes(action.recordIds, record.rowid))
        .map(row => handleTreeNodeRow(row, action.recordIds));
    case 'CLEAR_RECORDS':
    case 'DELETE_ALL':
      return [];
    case 'CANCEL_CHANGE':
      return action.records || [];
    default:
      return state;
  }
}

export function initialized(state = false, action: RelateRecordAction) {
  switch (action.type) {
    case 'UPDATE_INIT_STATE':
      return action.value;
    default:
      return state;
  }
}

function lastAction(_state: UnknownAction | undefined, action: RelateRecordAction): UnknownAction {
  return action;
}

function rowsSummary(state: RelateRecordState['rowsSummary'] = { types: {}, values: {} }, action: RelateRecordAction) {
  switch (action.type) {
    case 'START_ROWS_SUMMARY':
      return { ...state, types: action.types, requestId: action.requestId };
    case 'UPDATE_ROWS_SUMMARY':
      if (action.requestId !== undefined && action.requestId !== state.requestId) return state;
      return {
        ...state,
        types: typeof action.types !== 'undefined' ? action.types : state.types,
        values: typeof action.values !== 'undefined' ? action.values : state.values,
      };
    case 'RESET':
      return { types: state.types, values: {}, requestId: (state.requestId || 0) + 1 };
    default:
      return state;
  }
}

const combinedReducer = combineReducers({
  initialized,
  loading,
  base,
  treeTableViewData,
  controls,
  originFirstPageResult,
  records,
  tableState,
  changes,
  rowsSummary,
  lastAction,
});

export default function reducer(state: RelateRecordState | undefined, action: RelateRecordAction): RelateRecordState {
  return combinedReducer(state, action);
}
