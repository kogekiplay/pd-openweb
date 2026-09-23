import type { ReduxAction } from 'src/redux/types';
import * as ACTIONS from '../actions/search';

// 不同 action 各带其中一个字段：UPDATE_IS_SEARCHING 带 isSearching、SEARCH_SUCCESS 带 result（接口原样值）、
// UPDATE_SEARCH_VALUYE 带 data（搜索框文字）
type SearchAction = ReduxAction<{ isSearching?: boolean; result?: ApiPayload; data?: string }>;

const initialState = {
  keywords: '',
  isSearching: false,
  result: {},
  searchValue: '',
};

export default (state = initialState, action: SearchAction) => {
  const { type, isSearching, result } = action;

  switch (type) {
    case 'PROJECT_ID_CHANGED':
      return initialState;
    case 'UPDATE_IS_SEARCHING':
      return { ...state, isSearching };
    case 'SEARCH_SUCCESS':
      return { ...state, result };
    case ACTIONS.CLEAR_KEYWORDS:
      return {
        ...state,
        keywords: '',
        result: {},
        isSearching: false,
      };
    case 'UPDATE_SEARCH_VALUYE':
      return {
        ...state,
        searchValue: action.data,
      };
    default:
      return state;
  }
};
