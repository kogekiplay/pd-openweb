import type { ReduxAction } from 'src/redux/types';
export const currentSearchSheetRows = (state = [], action: ReduxAction) => {
  switch (action.type) {
    case 'MOBILE_CHANGE_SEARCH_SHEET_ROWS':
      return Object.assign([], action.data);
    case 'MOBILE_ADD_SEARCH_SHEET_ROWS':
      return Object.assign([], state.concat(action.data));
    default:
      return state;
  }
};
