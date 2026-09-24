import { combineReducers } from 'redux';
import { List, Map, Set } from 'immutable';
import type { ReduxAction, ValueAction } from 'src/redux/types';
import { NODE_SORT_BY, NODE_SORT_TYPE, PICK_TYPE } from '../constant/enum';

/** 列表的只读 / 回收站状态，由 updateRoot 按当前根目录写入 */
interface KcListState {
  isRecycle?: boolean;
  isReadOnly?: boolean;
}

// 节点（文件夹 / 文件）来自接口，形状未类型化，按接口原样值记
type KcListAction =
  | { type: 'KC_CLEAR_LIST' | 'KC_CLEAR_KC' }
  | { type: 'KC_REPLACE_NODES'; value: List<ApiPayload> }
  | { type: 'KC_FETCH_NODES_SUCCESS'; value: ApiPayload[] }
  | { type: 'KC_ADD_NEWFOLDER_SUCCESS'; value: ApiPayload };

type KcSelectedItemsAction =
  | { type: 'KC_UPDATE_SELECTED_ITEMS'; value: Set<ApiPayload> }
  | { type: 'KC_SELECT_ALL_ITEMS'; value: boolean; selectedItems: Set<ApiPayload> };

function kcListElement(state: HTMLDivElement | null = null, action: ValueAction<HTMLDivElement | null>) {
  switch (action.type) {
    case 'KC_UPDATE_LIST_ELEMENT':
      return action.value;
    default:
      return state;
  }
}

function loading(state = true, action: ReduxAction) {
  switch (action.type) {
    default:
      return state;
  }
}

function listLoading(state = true, action: ReduxAction) {
  switch (action.type) {
    case 'KC_FETCH_NODES_START':
      return true;
    case 'KC_FETCH_NODES_SUCCESS':
    case 'KC_FETCH_NODES_ERROR':
      return false;
    default:
      return state;
  }
}

function path(state = '', action: ValueAction<string>) {
  switch (action.type) {
    case 'KC_UPDATE_PATH':
      return action.value;
    default:
      return state;
  }
}

const defaultParams = Map({
  keywords: '',
  skip: 0,
  limit: 20,
  sortBy: NODE_SORT_BY.UPDATE_TIME,
  sortType: NODE_SORT_TYPE.DESC,
});

function params(
  state: Map<string, any> = defaultParams,
  action: ValueAction<Record<string, unknown>>,
): Map<string, any> {
  switch (action.type) {
    case 'KC_CLEAR_KC':
      return defaultParams;
    case 'KC_UPDATE_PARAMS':
      return state.merge(action.value);
    default:
      return state;
  }
}

function currentFolder(state: ApiPayload = {}, action: ValueAction<ApiPayload>) {
  switch (action.type) {
    case 'KC_UPDATE_FOLDER':
      return action.value;
    default:
      return state;
  }
}

// 值是 PICK_TYPE 里的数字，或者（进到某个共享根目录时）那个根节点对象本身
function currentRoot(state: number | ApiPayload = PICK_TYPE.MY, action: ValueAction<number | ApiPayload>) {
  switch (action.type) {
    case 'KC_UPDATE_ROOT':
      return action.value;
    default:
      return state;
  }
}

function list(state: List<ApiPayload> = List(), action: KcListAction) {
  switch (action.type) {
    case 'KC_CLEAR_LIST':
    case 'KC_CLEAR_KC':
      return List();
    case 'KC_REPLACE_NODES':
      return action.value;
    case 'KC_FETCH_NODES_SUCCESS':
      return state.concat(action.value);
    case 'KC_ADD_NEWFOLDER_SUCCESS':
      return state.unshift(action.value);
    default:
      return state;
  }
}

function totalCount(state = 0, action: ValueAction<number>) {
  switch (action.type) {
    case 'KC_UPDATE_TOTALCOUNT':
      return action.value;
    case 'KC_ADD_NEWFOLDER_SUCCESS':
      return state + 1;
    default:
      return state;
  }
}

function kcUsage(state: ApiPayload = {}, action: ValueAction<ApiPayload>) {
  switch (action.type) {
    case 'KC_FETCH_USAGE_SUCCESS':
      return action.value;
    default:
      return state;
  }
}

function isRecycle(state = false, action: ValueAction<KcListState>) {
  switch (action.type) {
    case 'KC_UPDATE_LIST_STATE':
      return action.value.isRecycle || false;
    default:
      return state;
  }
}

function isReadOnly(state = true, action: ValueAction<KcListState>) {
  switch (action.type) {
    case 'KC_UPDATE_LIST_STATE':
      return action.value.isReadOnly || false;
    default:
      return state;
  }
}

function isGlobalSearch(state = false, action: ValueAction<boolean>) {
  switch (action.type) {
    case 'KC_CLEAR_KC':
      return false;
    case 'KC_UPDATE_IS_GLOBAL_SEARCH':
      return action.value;
    default:
      return state;
  }
}

// 选择
export function selectAll(state = false, action: ValueAction<boolean>) {
  switch (action.type) {
    case 'KC_CHANGE_SELECT_ALL':
    case 'KC_SELECT_ALL_ITEMS':
      return action.value;
    default:
      return state;
  }
}

export function selectedItems(state: Set<ApiPayload> = Set(), action: KcSelectedItemsAction) {
  switch (action.type) {
    case 'KC_UPDATE_SELECTED_ITEMS':
      return action.value;
    case 'KC_SELECT_ALL_ITEMS':
      return action.selectedItems;
    default:
      return state;
  }
}

export function rightMenuOption(state = false, action: ReduxAction) {
  switch (action.type) {
    default:
      return state;
  }
}

export function baseUrl(state = '/apps/kc', action: ValueAction<string>) {
  switch (action.type) {
    case 'KC_UPDATE_KC_BASE_URL':
      return action.value;
    default:
      return state;
  }
}

export function temp(state = false, action: ReduxAction) {
  switch (action.type) {
    default:
      return state;
  }
}

export default combineReducers({
  kcListElement,
  loading,
  baseUrl,
  listLoading,
  isGlobalSearch,
  isRecycle,
  isReadOnly,
  path,
  currentRoot,
  currentFolder,
  params,
  list,
  totalCount,
  kcUsage,
  selectAll,
  selectedItems,
  rightMenuOption,
  temp,
});
