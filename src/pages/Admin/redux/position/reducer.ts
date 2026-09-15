import { combineReducers } from 'redux';
import type { ReduxAction } from 'src/redux/types';

export function projectId(state = '', action: ReduxAction) {
  switch (action.type) {
    case 'CHANGE_PROJECT_ID':
      return action.projectId;
    default:
      return state;
  }
}

export function isLoading(state = false, action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_IS_LOADING':
      return action.isLoading;
    default:
      return state;
  }
}

export function positionList(state = [], action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_POSITION_LIST':
      return action.positionList;
    default:
      return state;
  }
}

export function positionPageInfo(state = { pageIndex: 1, isMore: false }, action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_POSITION_PAGE_INFO':
      return action.data;
    default:
      return state;
  }
}

export function currentPosition(state = {}, action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_CURRENT_POSITION':
      return action.currentPosition;
    default:
      return state;
  }
}

export function searchValue(state = '', action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_SEARCH_VALUE':
      return action.searchValue;
    default:
      return state;
  }
}

export function userPageIndex(state = 1, action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_USER_PAGE_INDEX':
      return action.userPageIndex;
    default:
      return state;
  }
}

export function userList(state = [], action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_USER_LIST':
      return action.userList;
    default:
      return state;
  }
}

export function userLoading(state = true, action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_USER_LOADING':
      return action.userLoading;
    default:
      return state;
  }
}

export function allUserCount(state = 0, action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_USER_COUNT':
      return action.allUserCount;
    default:
      return state;
  }
}

export function selectUserIds(state = [], action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_SELECT_USER_IDS':
      return action.selectUserIds;
    default:
      return state;
  }
}

export function isImportRole(state = false, action: ReduxAction) {
  switch (action.type) {
    case 'UPDATE_IS_IMPORT_ROLE':
      return action.data;
    default:
      return state;
  }
}

export default combineReducers({
  projectId,
  isLoading,
  positionList,
  positionPageInfo,
  currentPosition,
  searchValue,
  userPageIndex,
  userList,
  userLoading,
  allUserCount,
  selectUserIds,
  isImportRole,
});
