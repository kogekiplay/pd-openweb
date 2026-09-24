import type { DataAction } from 'src/redux/types';
import type { RecordRow } from 'src/utils/controlTypes';

export const currentSearchSheetRows = (state: RecordRow[] = [], action: DataAction<RecordRow[]>) => {
  switch (action.type) {
    case 'MOBILE_CHANGE_SEARCH_SHEET_ROWS':
      return Object.assign([], action.data);
    case 'MOBILE_ADD_SEARCH_SHEET_ROWS':
      return Object.assign([], state.concat(action.data));
    default:
      return state;
  }
};
