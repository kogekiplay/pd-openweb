import { combineReducers } from 'redux';
import type { DataAction, ReduxAction } from 'src/redux/types';

/** 列表分页状态 */
export interface PageInfo {
  pageIndex: number;
  isMore: boolean;
}

export function projectId(state = '', action: ReduxAction<{ projectId: string }>) {
  switch (action.type) {
    case 'CHANGE_PROJECT_ID':
      return action.projectId;
    default:
      return state;
  }
}

export function isLoading(state = false, action: ReduxAction<{ isLoading: boolean }>) {
  switch (action.type) {
    case 'UPDATE_IS_LOADING':
      return action.isLoading;
    default:
      return state;
  }
}

export function roleList(state: ApiPayload[] = [], action: ReduxAction<{ roleList: ApiPayload[] }>) {
  switch (action.type) {
    case 'UPDATE_ROLE_LIST_DATA':
      return action.roleList;
    default:
      return state;
  }
}

export function rolePageInfo(state: PageInfo = { pageIndex: 1, isMore: false }, action: DataAction<PageInfo>) {
  switch (action.type) {
    case 'UPDATE_ROLE_PAGE_INFO':
      return action.data;
    default:
      return state;
  }
}

export function currentRole(state: ApiPayload = {}, action: ReduxAction<{ currentRole: ApiPayload }>) {
  switch (action.type) {
    case 'UPDATE_CURRENT_ROLE':
      return action.currentRole;
    default:
      return state;
  }
}

export function searchValue(state = '', action: ReduxAction<{ searchValue: string }>) {
  switch (action.type) {
    case 'UPDATE_SEARCH_VALUE':
      return action.searchValue;
    default:
      return state;
  }
}

export function userPageIndex(state = 1, action: ReduxAction<{ userPageIndex: number }>) {
  switch (action.type) {
    case 'UPDATE_USER_PAGE_INDEX':
      return action.userPageIndex;
    default:
      return state;
  }
}

export function userList(state: ApiPayload[] = [], action: ReduxAction<{ userList: ApiPayload[] }>) {
  switch (action.type) {
    case 'UPDATE_USER_LIST':
      return action.userList;
    default:
      return state;
  }
}

export function userLoading(state = true, action: ReduxAction<{ userLoading: boolean }>) {
  switch (action.type) {
    case 'UPDATE_USER_LOADING':
      return action.userLoading;
    default:
      return state;
  }
}

export function allUserCount(state = 0, action: ReduxAction<{ allUserCount: number }>) {
  switch (action.type) {
    case 'UPDATE_USER_COUNT':
      return action.allUserCount;
    default:
      return state;
  }
}

export function selectUserIds(state: string[] = [], action: ReduxAction<{ selectUserIds: string[] }>) {
  switch (action.type) {
    case 'UPDATE_SELECT_USER_IDS':
      return action.selectUserIds;
    default:
      return state;
  }
}

export function isImportRole(state = false, action: DataAction<boolean>) {
  switch (action.type) {
    case 'UPDATE_IS_IMPORT_ROLE':
      return action.data;
    default:
      return state;
  }
}

export function isRequestUserList(state = true, action: DataAction<boolean>) {
  switch (action.type) {
    case 'UPDATE_IS_REQUEST_LIST':
      return action.data;
    default:
      return state;
  }
}

export default combineReducers({
  projectId,
  isLoading,
  roleList,
  rolePageInfo,
  currentRole,
  searchValue,
  userPageIndex,
  userList,
  userLoading,
  allUserCount,
  selectUserIds,
  isImportRole,
  isRequestUserList,
});
