import { combineReducers } from 'redux';
import type { DataAction, ReduxAction } from 'src/redux/types';
import type { FormControl } from 'src/utils/controlTypes';

/** 保存前校验出的规则错误，按出错位置分三块（见 actions 里的 checkRules*） */
export interface ColumnRuleError {
  filterError?: unknown[];
  actionError?: Record<string, unknown>;
  setValueError?: Record<string, unknown>;
}

// loading状态
export function loading(state = true, action: ReduxAction) {
  switch (action.type) {
    case 'COLUMNRULES_LOAD_SUCCESS':
      return false;
    case 'COLUMNRULES_FETCH_START':
    case 'COLUMNRULES_FETCH_FAIL':
      return true;
    default:
      return state;
  }
}

export function copyLoading(state = false, action: DataAction<boolean>) {
  switch (action.type) {
    case 'COLUMNRULES_COPY_START':
    case 'COLUMNRULES_COPY_END':
      return action.data;
    default:
      return state;
  }
}

// worksheetId
export function worksheetId(state = '', action: DataAction<string>) {
  switch (action.type) {
    case 'COLUMNRULES_WORKSHEETID':
      return action.data;
    default:
      return state;
  }
}

// 当前表信息
export function worksheetInfo(state: ApiPayload = {}, action: DataAction<ApiPayload>) {
  switch (action.type) {
    case 'WORKSHEET_INFO':
      return action.data;
    default:
      return state;
  }
}

// 当前表显示规则
export function columnRulesListData(state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) {
  switch (action.type) {
    case 'COLUMNRULES_LIST':
      return action.data;
    default:
      return state;
  }
}

//正编辑的规则
export function selectRules(state: ApiPayload = {}, action: DataAction<ApiPayload>) {
  switch (action.type) {
    case 'UPDATE_SELECT_COLUMNRULES_LIST':
      return action.data;
    default:
      return state;
  }
}

// 当前表与关联表数据
export function worksheetRuleControls(state: FormControl[] = [], action: DataAction<FormControl[]>) {
  switch (action.type) {
    case 'WORKSHEET_RULE_CONTROLS':
      return action.data;
    default:
      return state;
  }
}

export function worksheetRelationSearch(state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) {
  switch (action.type) {
    case 'WORKSHEET_RELATION_SEARCH':
      return action.data;
    default:
      return state;
  }
}

// 当前正在编辑的筛选
export function filters(state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) {
  switch (action.type) {
    case 'FILTER_LIST':
      return action.data;
    default:
      return state;
  }
}

// input框提示
export function ruleError(state: ColumnRuleError = {}, action: DataAction<ColumnRuleError>) {
  switch (action.type) {
    case 'COLUMN_RULELIST_ERROR':
      return action.data;
    default:
      return state;
  }
}

export function activeTab(state = 0, action: DataAction<number>) {
  switch (action.type) {
    case 'UPDATE_ACTIVE_TAB':
      return action.data;
    default:
      return state;
  }
}

export function queryConfigs(state: ApiPayload[] = [], action: DataAction<ApiPayload[]>) {
  switch (action.type) {
    case 'WORKSHEET_QUERY_CONFIGS':
      return action.data;
    default:
      return state;
  }
}

export function saveLoading(state = false, action: DataAction<boolean>) {
  switch (action.type) {
    case 'SAVE_LOADING':
      return action.data;
    default:
      return state;
  }
}

export default combineReducers({
  columnRulesListData,
  loading,
  copyLoading,
  filters,
  selectRules,
  worksheetRuleControls,
  worksheetRelationSearch,
  ruleError,
  activeTab,
  worksheetId,
  worksheetInfo,
  queryConfigs,
  saveLoading,
});
